use anyhow::{anyhow, Result};
use async_trait::async_trait;
use hf_hub::api::tokio::ApiBuilder;
use ndarray::{Array2, Axis};
use ort::{
    Environment, GraphOptimizationLevel, Session, SessionBuilder, Value,
};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokenizers::Tokenizer;

use super::traits::{Embedder, ModelConfig, ModelSource};

const HF_MIRRORS: &[&str] = &[
    "https://hf-mirror.com",
    "https://huggingface.co",
];

pub struct LocalOnnxEmbedder {
    config: ModelConfig,
    session: Option<Session>,
    tokenizer: Option<Tokenizer>,
    environment: Arc<Environment>,
    app_handle: AppHandle,
}

impl LocalOnnxEmbedder {
    pub fn new(config: ModelConfig, environment: Arc<Environment>, app_handle: AppHandle) -> Self {
        Self {
            config,
            session: None,
            tokenizer: None,
            environment,
            app_handle,
        }
    }

    fn mean_pool(&self, last_hidden_state: Array2<f32>, attention_mask: Array2<f32>) -> Array2<f32> {
        let masked = last_hidden_state * attention_mask.clone().insert_axis(Axis(2)); // 注意这里维度的广播
        let sum = masked.sum_axis(Axis(1));
        
        // 计算 Mask 的和，避免除以0
        let mask_sum = attention_mask.sum_axis(Axis(1)).mapv(|x| x.max(1e-9));
        
        sum / mask_sum.insert_axis(Axis(1))
    }

    fn normalize_l2(&self, embeddings: &Array2<f32>) -> Array2<f32> {
        let norms = embeddings.map_axis(Axis(1), |row| row.mapv(|v| v.powi(2)).sum().sqrt().max(1e-12));
        embeddings / &norms.insert_axis(Axis(1))
    }
}

#[async_trait]
impl Embedder for LocalOnnxEmbedder {
    async fn init(&mut self) -> Result<()> {
        let ModelSource::LocalOnnx { repo_id, file_name, tokenizer_name } = &self.config.source else {
            return Err(anyhow!("Invalid model source"));
        };

        let cache_dir = self.app_handle.path().app_local_data_dir()?.join("models");

        let mut model_path = None;
        let mut tokenizer_path = None;

        // 简单的重试逻辑
        for endpoint in HF_MIRRORS {
            println!("Trying to download model from {}", endpoint);
            let api = ApiBuilder::new()
                .with_endpoint(endpoint.to_string())
                .with_cache_dir(cache_dir.clone())
                .build()?;

            let repo = api.repo(hf_hub::Repo::model(repo_id.clone()));
            let tz_repo_id = tokenizer_name.as_deref().unwrap_or(repo_id);
            let tz_repo = api.repo(hf_hub::Repo::model(tz_repo_id.to_string()));

            // 尝试下载 Tokenizer
            if tokenizer_path.is_none() {
                if let Ok(path) = tz_repo.get("tokenizer.json").await {
                    tokenizer_path = Some(path);
                }
            }

            // 尝试下载 Model
            if let Ok(path) = repo.get(file_name).await {
                model_path = Some(path);
                // 如果两个都找到了，就退出循环
                if tokenizer_path.is_some() {
                    break;
                }
            }
        }

        let model_path = model_path.ok_or_else(|| anyhow!("Failed to download model file: {}", file_name))?;
        let tokenizer_path = tokenizer_path.ok_or_else(|| anyhow!("Failed to download tokenizer.json"))?;

        let tokenizer = Tokenizer::from_file(tokenizer_path).map_err(|e| anyhow!(e))?;
        self.tokenizer = Some(tokenizer);

        // ort 2.0 session builder
        let session = SessionBuilder::new(&self.environment)?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)? // 适当增加线程数
            .with_model_from_file(&model_path)?;

        self.session = Some(session);

        Ok(())
    }

    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let session = self.session.as_ref().ok_or_else(|| anyhow!("Session not initialized"))?;
        let tokenizer = self.tokenizer.as_ref().ok_or_else(|| anyhow!("Tokenizer not initialized"))?;

        // 添加 query 前缀 (对于某些模型是必须的，如 e5, jina 等，这里简单处理)
        // 注意：Jina V3 对 query 和 passage 有不同的前缀需求，这里暂时假设是 passage
        // 生产环境应根据 task type 动态调整
        let texts_prefixed: Vec<String> = texts; //.iter().map(|s| format!("passage: {}", s)).collect();

        let encodings = tokenizer.encode_batch(texts_prefixed, true).map_err(|e| anyhow!(e))?;

        let batch_size = encodings.len();
        let seq_len = encodings[0].get_ids().len();

        let input_ids: Vec<i64> = encodings.iter().flat_map(|e| e.get_ids().iter().map(|&id| id as i64)).collect();
        let attention_mask: Vec<i64> = encodings.iter().flat_map(|e| e.get_attention_mask().iter().map(|&m| m as i64)).collect();

        // 构造 ndarray
        let input_ids_arr = ndarray::Array2::from_shape_vec((batch_size, seq_len), input_ids)?;
        let attention_mask_arr = ndarray::Array2::from_shape_vec((batch_size, seq_len), attention_mask)?;

        // 创建 ORT Values
        // 注意：ORT 2.0 中，Value::from_array 接受 &Array
        let inputs = vec![
            ("input_ids", Value::from_array(input_ids_arr.view())?),
            ("attention_mask", Value::from_array(attention_mask_arr.view())?),
        ];

        let outputs = session.run(inputs)?;
        
        // 提取输出，BERT模型通常输出是 last_hidden_state (batch, seq, hidden)
        // 有些模型可能是 pooler_output，这里假设是 last_hidden_state (索引0)
        let last_hidden_state = outputs[0].try_extract_tensor::<f32>()?;
        
        // 将 OutputTensor 转换为 ndarray 以便进行池化操作
        // 注意：last_hidden_state 是 View，我们需要 copy 出数据或者直接操作
        // 这里为了代码清晰，我们构建一个新的 Array2/3
        let shape = last_hidden_state.shape(); // [batch, seq, dim]
        let dim = shape[2];
        
        // 将数据复制到 ndarray 中进行计算
        let hidden_data = last_hidden_state.view().to_slice().ok_or(anyhow!("Failed to get tensor slice"))?;
        let hidden_arr = Array2::from_shape_vec((batch_size * seq_len, dim), hidden_data.to_vec())?
            .into_shape((batch_size, seq_len, dim))?;

        let attention_mask_f32 = attention_mask_arr.mapv(|v| v as f32);

        // 执行 Mean Pooling
        let mut pooled = self.mean_pool(hidden_arr, attention_mask_f32);
        pooled = self.normalize_l2(&pooled);

        Ok(pooled.outer_iter().map(|row| row.to_vec()).collect())
    }

    fn dimension(&self) -> usize {
        self.config.dimension
    }

    fn model_id(&self) -> &str {
        &self.config.id
    }

    fn batch_size(&self) -> usize {
        self.config.batch_size
    }
}