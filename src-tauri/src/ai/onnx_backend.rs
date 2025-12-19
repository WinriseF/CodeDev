use anyhow::{anyhow, bail, Result};
use async_trait::async_trait;
use hf_hub::api::tokio::ApiBuilder;
use ndarray::{Array, Array2, Axis};
use ort::{
    environment::Environment,
    session::{Session, SessionBuilder},
    value::Value,
    GraphOptimizationLevel,
};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager}; // 添加 Manager 以支持 path()
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

    fn mean_pool(&self, last_hidden_state: Array<f32, 3>, attention_mask: Array<f32, 2>) -> Result<Array2<f32>> {
        let masked_hidden_state = last_hidden_state * attention_mask.insert_axis(Axis(2));
        let sum_hidden_state = masked_hidden_state.sum_axis(Axis(1));
        let sum_attention_mask = attention_mask.sum_axis(Axis(1)).insert_axis(Axis(1));
        let mean_pooled = sum_hidden_state / sum_attention_mask;
        Ok(mean_pooled)
    }

    fn normalize_l2(&self, embeddings: &Array2<f32>) -> Result<Array2<f32>> {
        let norms = embeddings.mapv(|x| x.powi(2)).sum_axis(Axis(1)).mapv(f32::sqrt).insert_axis(Axis(1));
        Ok(embeddings / norms)
    }
}

#[async_trait]
impl Embedder for LocalOnnxEmbedder {
    async fn init(&mut self) -> Result<()> {
        let ModelSource::LocalOnnx { repo_id, file_name, tokenizer_name } = &self.config.source else {
            return Err(anyhow!("Invalid model source for LocalOnnxEmbedder"));
        };

        let cache_dir = self.app_handle.path().app_local_data_dir()?.join("models");

        let mut last_error: Option<anyhow::Error> = None;
        let mut model_path: Option<PathBuf> = None;
        let mut tokenizer_path: Option<PathBuf> = None;

        for endpoint in HF_MIRRORS {
            println!("Attempting to download from endpoint: {}", endpoint);
            let api = ApiBuilder::new()
                .with_endpoint(endpoint.to_string())
                .with_cache_dir(cache_dir.clone())
                .build()?;

            let repo = api.repo(hf_hub::Repo::model(repo_id.clone()));

            let tz_repo_id = tokenizer_name.as_deref().unwrap_or(repo_id);
            let tz_repo = api.repo(hf_hub::Repo::model(tz_repo_id.to_string()));
            match tz_repo.get("tokenizer.json").await {
                Ok(path) => {
                    tokenizer_path = Some(path);
                }
                Err(e) => {
                    last_error = Some(anyhow!("Tokenizer download failed: {}", e));
                    continue;
                }
            }

            match repo.get(file_name).await {
                Ok(path) => {
                    model_path = Some(path);
                    last_error = None;
                    break;
                }
                Err(e) => {
                    last_error = Some(anyhow!("Model download failed: {}", e));
                    continue;
                }
            }
        }

        let model_path = model_path.ok_or_else(|| last_error.unwrap_or_else(|| anyhow!("All mirror endpoints failed.")))?;
        let tokenizer_path = tokenizer_path.ok_or_else(|| anyhow!("Tokenizer path not found"))?;

        let mut tokenizer = Tokenizer::from_file(&tokenizer_path).map_err(|e| anyhow!(e))?;
        self.tokenizer = Some(tokenizer);

        let session = SessionBuilder::new(&self.environment)?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_inter_op_num_threads(1)?
            .with_model_from_file(model_path)?;

        self.session = Some(session);

        println!("Successfully initialized local model: {}", self.config.id);
        Ok(())
    }

    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        let (Some(session), Some(tokenizer)) = (&self.session, &self.tokenizer) else {
            return Err(anyhow!("Model is not initialized. Call init() first."));
        };

        let texts_with_prefix: Vec<String> = texts
            .iter()
            .map(|s| format!("passage: {}", s))
            .collect();

        let owned_tokenizer = tokenizer.clone();
        let normalized = tokio::task::spawn_blocking(move || -> Result<Array2<f32>> {
            let encodings = owned_tokenizer.encode_batch(texts_with_prefix, true).map_err(|e| anyhow!(e))?;

            let batch_size = encodings.len();
            let seq_len = encodings.get(0).map_or(0, |e| e.get_ids().len());

            let ids_array = Array::from_shape_vec(
                (batch_size, seq_len),
                encodings.iter().flat_map(|e| e.get_ids().iter().map(|&x| x as i64)).collect(),
            )?;
            let mask_array = Array::from_shape_vec(
                (batch_size, seq_len),
                encodings.iter().flat_map(|e| e.get_attention_mask().iter().map(|&x| x as i64)).collect(),
            )?;
            let type_ids_array = Array::from_shape_vec(
                (batch_size, seq_len),
                encodings.iter().flat_map(|e| e.get_type_ids().iter().map(|&x| x as i64)).collect(),
            )?;

            let inputs = ort::inputs![
                "input_ids" => Value::from_array(ids_array)?,
                "attention_mask" => Value::from_array(mask_array)?,
                "token_type_ids" => Value::from_array(type_ids_array)?
            ]?;

            let outputs = session.run(inputs)?;
            let last_hidden_state = outputs["last_hidden_state"].try_extract_tensor::<f32>()?;
            let attention_mask_f32 = mask_array.mapv(|x| x as f32);
            let pooled = self.mean_pool(last_hidden_state.view().to_owned(), attention_mask_f32)?;
            self.normalize_l2(&pooled)
        }).await??;

        Ok(normalized.outer_iter().map(|row| row.to_vec()).collect())
    }

    fn dimension(&self) -> usize {
        self.config.dimension
    }

    fn model_id(&self) -> &str {
        &self.config.id
    }
}