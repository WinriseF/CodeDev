use anyhow::{anyhow, Context, Result};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

use crate::ai::onnx_backend::LocalOnnxEmbedder;
use crate::ai::registry::MODEL_REGISTRY;
use crate::ai::traits::{Embedder, ModelConfig};
use crate::rag::database::VectorDB;
use crate::rag::indexer::Indexer;
use ort::environment::Environment;

pub struct AIEngine {
    embedders: RwLock<HashMap<String, Arc<dyn Embedder>>>,
    vector_db: Arc<VectorDB>,
    ort_environment: Arc<Environment>,
    app_handle: AppHandle,
}

impl AIEngine {
    pub async fn new(app_handle: AppHandle) -> Result<Self> {
        let db_path = app_handle
            .path()
            .app_local_data_dir()?
            .join("rag_db");

        let vector_db = Arc::new(VectorDB::new(db_path).await?);

        let ort_environment = Arc::new(
            Environment::builder()
                .with_name("CodeForgeAI_Engine")
                .build()?,
        );

        Ok(Self {
            embedders: RwLock::new(HashMap::new()),
            vector_db,
            ort_environment,
            app_handle,
        })
    }

    async fn get_embedder(&self, model_id: &str) -> Result<Arc<dyn Embedder>> {
        {
            let reader = self.embedders.read().await;
            if let Some(embedder) = reader.get(model_id) {
                return Ok(embedder.clone());
            }
        }

        let mut writer = self.embedders.write().await;

        // 双检查锁
        if let Some(embedder) = writer.get(model_id) {
            return Ok(embedder.clone());
        }

        let config = MODEL_REGISTRY
            .get(model_id)
            .cloned()
            .ok_or_else(|| anyhow!("Model '{}' not found in registry", model_id))?;

        let mut embedder: Box<dyn Embedder> = match config.source {
            crate::ai::traits::ModelSource::LocalOnnx { .. } => Box::new(LocalOnnxEmbedder::new(
                config,
                self.ort_environment.clone(),
                self.app_handle.clone(),
            )),
            crate::ai::traits::ModelSource::RemoteAPI { .. } => {
                return Err(anyhow!("Remote API embedder not yet implemented"));
            }
        };

        embedder.init().await?;

        // 明确指定类型以解决类型推断问题
        let arc_embedder: Arc<dyn Embedder> = Arc::from(embedder);
        writer.insert(model_id.to_string(), arc_embedder.clone());

        Ok(arc_embedder)
    }
}

#[tauri::command]
pub async fn index_project(
    paths: Vec<String>,
    collection_name: String,
    model_id: String,
    engine: State<'_, AIEngine>,
) -> Result<usize, String> {
    let embedder = engine.get_embedder(&model_id).await.map_err(|e| e.to_string())?;

    let table_name = format!("{}_{}", collection_name, model_id.replace("/", "_"));

    let indexer = Indexer::new(engine.vector_db.clone(), embedder);

    let mut total_indexed_chunks = 0;
    for path_str in paths {
        let path = std::path::Path::new(&path_str);
        match indexer.index_directory(path, &table_name).await {
            Ok(count) => total_indexed_chunks += count,
            Err(e) => return Err(format!("Failed to index directory {}: {}", path_str, e)),
        }
    }

    Ok(total_indexed_chunks)
}

#[tauri::command]
pub async fn search_code(
    query: String,
    collection_name: String,
    model_id: String,
    limit: usize,
    engine: State<'_, AIEngine>,
) -> Result<Vec<String>, String> {
    let embedder = engine.get_embedder(&model_id).await.map_err(|e| e.to_string())?;

    let query_vector = embedder.embed(vec![query]).await.map_err(|e| e.to_string())?[0].clone();

    let table_name = format!("{}_{}", collection_name, model_id.replace("/", "_"));

    let search_results = engine
        .vector_db
        .search(&table_name, query_vector, limit * 3)
        .await
        .map_err(|e| e.to_string())?;

    let mut file_paths = Vec::new();
    for res in search_results {
        if !file_paths.contains(&res.file_path) {
            file_paths.push(res.file_path);
        }
    }

    file_paths.truncate(limit);

    Ok(file_paths)
}