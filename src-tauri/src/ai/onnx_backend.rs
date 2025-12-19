// src/ai/onnx_backend.rs 完整代码
use anyhow::{Result};
use hf_hub::{Api, Repo, RepoType};
use ndarray::{Array2, Array3, Axis};
use ort::{
    environment::Environment,
    session::builder::SessionBuilder,
    value::Value,
    inputs,
};
use std::path::PathBuf;
use std::sync::Arc;
use tokenizers::Tokenizer;
use tokio::fs;
use tauri::Manager;

use crate::ai::traits::{Embedder, ModelConfig};

pub struct LocalOnnxEmbedder {
    session: Session,
    tokenizer: Tokenizer,
    config: ModelConfig,
    app_data_dir: PathBuf,
    environment: Arc<Environment>,
}

impl LocalOnnxEmbedder {
    pub fn new(config: ModelConfig, app_handle: tauri::AppHandle) -> Self {
        let app_data_dir = app_handle.path().app_local_data_dir().expect("Failed to get app local data dir");

        let environment = Arc::new(
            Environment::builder()
                .with_name("CodeForgeAI_ONNX")
                .build()
                .expect("Failed to create ONNX environment"),
        );

        let session = SessionBuilder::new(&environment)
            .unwrap()
            .commit_from_memory(&[])
            .unwrap();

        let tokenizer = Tokenizer::new(tokenizers::models::bpe::BPE::default());

        Self {
            session,
            tokenizer,
            config,
            app_data_dir,
            environment,
        }
    }

    async fn ensure_model_files(&self) -> Result<(PathBuf, PathBuf)> {
        let api = Api::new()?;
        let repo = api.repo(Repo::with_revision(
            match &self.config.source {
                crate::ai::traits::ModelSource::LocalOnnx { repo_id, .. } => repo_id.clone(),
                _ => return Err(anyhow!("Invalid source")),
            },
            RepoType::Model,
            "main".to_string(),
        ));

        let model_path = self.app_data_dir.join("models").join(&self.config.id);
        fs::create_dir_all(&model_path).await?;

        let onnx_file = model_path.join("model.onnx");
        let tokenizer_file = model_path.join("tokenizer.json");

        if !onnx_file.exists() {
            let file_name = match &self.config.source {
                crate::ai::traits::ModelSource::LocalOnnx { file_name, .. } => file_name,
                _ => return Err(anyhow!("Invalid source")),
            };
            let file = repo.get(file_name)?;
            fs::copy(file, &onnx_file).await?;
        }

        if !tokenizer_file.exists() {
            if let crate::ai::traits::ModelSource::LocalOnnx { tokenizer_name: Some(name), .. } = &self.config.source {
                let tokenizer_repo = api.repo(Repo::with_revision(
                    name.clone(),
                    RepoType::Model,
                    "main".to_string(),
                ));
                let tokenizer_src = tokenizer_repo.get("tokenizer.json")?;
                fs::copy(tokenizer_src, &tokenizer_file).await?;
            }
        }

        Ok((onnx_file, tokenizer_file))
    }

    async fn load_session_and_tokenizer(&mut self) -> Result<()> {
        let (model_path, tokenizer_path) = self.ensure_model_files().await?;

        self.session = SessionBuilder::new(&self.environment)
            .unwrap()
            .commit_from_file(&model_path)?;

        self.tokenizer = if tokenizer_path.exists() {
            Tokenizer::from_file(tokenizer_path).map_err(|e| anyhow!("Tokenizer file error: {:?}", e))?
        } else {
            Tokenizer::from_pretrained(&self.config.id, None).map_err(|e| anyhow!("Pretrained tokenizer error: {:?}", e))?
        };

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

        let batch_size = self.batch_size().min(texts.len());
        let mut all_embeddings = Vec::with_capacity(texts.len());

        for batch_texts in texts.chunks(batch_size) {
            let encodings = self.tokenizer.encode_batch(batch_texts.to_vec(), true)
                .map_err(|e| anyhow!("Encode error: {:?}", e))?;

            let max_len = encodings.iter().map(|e| e.get_ids().len()).max().unwrap_or(0);
            let mut input_ids: Vec<i64> = Vec::with_capacity(batch_texts.len() * max_len);
            let mut attention_mask: Vec<i64> = Vec::with_capacity(batch_texts.len() * max_len);

            for encoding in &encodings {
                let ids = encoding.get_ids();
                let mask = encoding.get_attention_mask();

                input_ids.extend(ids.iter().map(|&id| id as i64));
                input_ids.resize(input_ids.len() + max_len - ids.len(), 0);

                attention_mask.extend(mask.iter().map(|&m| m as i64);
                attention_mask.resize(attention_mask.len() + max_len - mask.len(), 0);
            }

            let batch = batch_texts.len();

            let input_ids_arr = Array2::<i64>::from_shape_vec((batch, max_len), input_ids)?;
            let attention_mask_arr = Array2::<i64>::from_shape_vec((batch, max_len), attention_mask)?;

            let inputs = inputs![
                "input_ids" => input_ids_arr.view().into_dyn(),
                "attention_mask" => attention_mask_arr.view().into_dyn()
            ]?;

            let outputs = self.session.run(inputs)?;

            let output_value = outputs
                .get("last_hidden_state")
                .ok_or_else(|| anyhow!("Missing last_hidden_state"))?
                .clone();

            let hidden_states: ndarray::ArrayViewD<f32> = output_value.try_extract_tensor()?;

            let dim = hidden_states.shape()[2];

            let hidden_arr = Array3::from_shape_vec((batch, max_len, dim), hidden_states.to_owned().to_vec())?;

            let attention_mask_f32 = attention_mask_arr.mapv(|v| v as f32);

            let mut pooled = hidden_arr.mean_axis(Axis(1)).unwrap();

            let norms = pooled.map_axis(Axis(1), |row| row.mapv(|v| v.powi(2)).sum().sqrt());
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

    fn dimension(&self) -> usize { self.config.dimension }
    fn model_id(&self) -> &str { &self.config.id }
    fn batch_size(&self) -> usize { self.config.batch_size }
}