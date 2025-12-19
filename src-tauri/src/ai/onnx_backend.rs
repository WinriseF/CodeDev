use anyhow::{anyhow, Result};
use hf_hub::api::sync::Api;
use ndarray::{Array3, Axis};
use ort::{
    session::{Session, builder::GraphOptimizationLevel},
    value::Value,
};
use std::path::PathBuf;
use std::sync::Mutex;
use tokenizers::Tokenizer;
use tokio::fs;
use tauri::Manager;

use crate::ai::traits::{Embedder, ModelConfig};

pub struct LocalOnnxEmbedder {
    // Session 需要包装在 Mutex 中，因为 Session::run 需要 &mut self，
    // 而 embed 方法只有 &self。
    session: Mutex<Option<Session>>, 
    tokenizer: Option<Tokenizer>,
    config: ModelConfig,
    app_data_dir: PathBuf,
}

impl LocalOnnxEmbedder {
    pub fn new(config: ModelConfig, app_handle: tauri::AppHandle) -> Self {
        let app_data_dir = app_handle
            .path()
            .app_local_data_dir()
            .expect("Failed to get app local data dir");

        Self {
            session: Mutex::new(None),
            tokenizer: None,
            config,
            app_data_dir,
        }
    }

    async fn ensure_model_files(&self) -> Result<(PathBuf, PathBuf)> {
        let api = Api::new()?;

        let repo_id = match &self.config.source {
            crate::ai::traits::ModelSource::LocalOnnx { repo_id, .. } => repo_id.clone(),
            _ => return Err(anyhow!("Invalid model source")),
        };

        let repo = api.model(repo_id);

        let model_path = self.app_data_dir.join("models").join(&self.config.id);
        fs::create_dir_all(&model_path).await?;

        let onnx_file = model_path.join("model.onnx");
        let tokenizer_file = model_path.join("tokenizer.json");

        if !onnx_file.exists() {
            let file_name = match &self.config.source {
                crate::ai::traits::ModelSource::LocalOnnx { file_name, .. } => file_name.clone(),
                _ => return Err(anyhow!("Invalid model source")),
            };
            let file = repo.get(&file_name)?;
            fs::copy(&file, &onnx_file).await?;
        }

        if !tokenizer_file.exists() {
            if let crate::ai::traits::ModelSource::LocalOnnx {
                tokenizer_name: Some(name),
                ..
            } = &self.config.source
            {
                let tokenizer_repo = api.model(name.clone());
                let tokenizer_src = tokenizer_repo.get("tokenizer.json")?;
                fs::copy(&tokenizer_src, &tokenizer_file).await?;
            }
        }

        Ok((onnx_file, tokenizer_file))
    }

    async fn load_session_and_tokenizer(&mut self) -> Result<()> {
        let (model_path, tokenizer_path) = self.ensure_model_files().await?;

        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)?
            .commit_from_file(&model_path)?;
        
        // 我们有 &mut self，所以可以直接通过 get_mut 修改 Mutex 内部的值
        *self.session.get_mut().unwrap() = Some(session);

        self.tokenizer = Some(if tokenizer_path.exists() {
            Tokenizer::from_file(&tokenizer_path)
                .map_err(|e| anyhow!("Failed to load tokenizer from file: {e:?}"))?
        } else {
            Tokenizer::from_pretrained(&self.config.id, None)
                .map_err(|e| anyhow!("Failed to load pretrained tokenizer: {e:?}"))?
        });

        Ok(())
    }
}

#[async_trait::async_trait]
impl Embedder for LocalOnnxEmbedder {
    async fn init(&mut self) -> Result<()> {
        self.load_session_and_tokenizer().await
    }

    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let tokenizer = self.tokenizer.as_ref()
            .ok_or_else(|| anyhow!("Tokenizer not initialized. Call init() first."))?;

        let batch_size = self.batch_size().min(texts.len());
        let mut all_embeddings = Vec::with_capacity(texts.len());

        for batch_texts in texts.chunks(batch_size) {
            let encodings = tokenizer
                .encode_batch(batch_texts.to_vec(), true)
                .map_err(|e| anyhow!("Tokenization error: {e:?}"))?;

            let max_len = encodings
                .iter()
                .map(|e| e.get_ids().len())
                .max()
                .unwrap_or(0);

            let mut input_ids: Vec<i64> = Vec::with_capacity(batch_texts.len() * max_len);
            let mut attention_mask: Vec<i64> = Vec::with_capacity(batch_texts.len() * max_len);

            for encoding in &encodings {
                let ids = encoding.get_ids();
                let mask = encoding.get_attention_mask();

                input_ids.extend(ids.iter().map(|&id| id as i64));
                input_ids.resize(input_ids.len() + max_len - ids.len(), 0);

                attention_mask.extend(mask.iter().map(|&m| m as i64));
                attention_mask.resize(attention_mask.len() + max_len - mask.len(), 0);
            }

            let batch = batch_texts.len();
            let shape = vec![batch as i64, max_len as i64];

            let input_ids_value = Value::from_array((shape.clone(), input_ids))?;
            let attention_mask_value = Value::from_array((shape.clone(), attention_mask))?;

            // 获取 Session 的锁以进行推理
            let mut session_guard = self.session.lock().map_err(|_| anyhow!("Failed to lock session"))?;
            let session = session_guard.as_mut()
                .ok_or_else(|| anyhow!("Session not initialized. Call init() first."))?;

            // 修正：移除了 ort::inputs! 宏后面的 ?
            let outputs = session.run(ort::inputs![
                "input_ids" => input_ids_value,
                "attention_mask" => attention_mask_value
            ])?;

            let output_value = outputs
                .get("last_hidden_state")
                .ok_or_else(|| anyhow!("Missing last_hidden_state in model output"))?;

            let (shape, data) = output_value.try_extract_tensor::<f32>()?;
            let dim = shape[2] as usize; 
            
            let hidden_arr = Array3::from_shape_vec(
                (batch, max_len, dim),
                data.to_vec(),
            )?;

            let mut pooled = hidden_arr.mean_axis(Axis(1)).unwrap();

            let norms = pooled
                .map_axis(Axis(1), |row| row.mapv(|v| v.powi(2)).sum().sqrt());

            for (mut row, norm) in pooled.rows_mut().into_iter().zip(norms) {
                if norm > 0.0 {
                    row /= norm;
                }
            }

            for row in pooled.outer_iter() {
                all_embeddings.push(row.to_vec());
            }
        }

        Ok(all_embeddings)
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