use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

use crate::ai::onnx_backend::LocalOnnxEmbedder;
use crate::ai::registry::MODEL_REGISTRY;
use crate::ai::traits::Embedder;
use crate::rag::database::VectorDB;
use crate::rag::indexer::Indexer;

pub struct AIEngine {
    embedders: RwLock<HashMap<String, Arc<dyn Embedder>>>,
    vector_db: Arc<VectorDB>,
    app_handle: AppHandle,
}

impl AIEngine {
    pub async fn new(app_handle: AppHandle) -> Result<Self> {
        ort::init()
            .with_name("CodeForgeAI_Engine")
            .commit()?;

        let db_path = app_handle
            .path()
            .app_local_data_dir()?
            .join("rag_db");

        let vector_db = Arc::new(VectorDB::new(db_path).await?);

        Ok(Self {
            embedders: RwLock::new(HashMap::new()),
            vector_db,
            app_handle,
        })
    }

    async fn get_embedder(&self, model_id: &str) -> Result<Arc<dyn Embedder>> {
        {
            let read = self.embedders.read().await;
            if let Some(embedder) = read.get(model_id) {
                return Ok(embedder.clone());
            }
        }

        let mut write = self.embedders.write().await;
        if let Some(embedder) = write.get(model_id) {
            return Ok(embedder.clone());
        }

        let config = MODEL_REGISTRY
            .get(model_id)
            .cloned()
            .ok_or_else(|| anyhow!("Model '{}' not found in registry", model_id))?;

        let mut embedder: Box<dyn Embedder> = match config.source {
            crate::ai::traits::ModelSource::LocalOnnx { .. } => {
                Box::new(LocalOnnxEmbedder::new(config, self.app_handle.clone()))
            }
            crate::ai::traits::ModelSource::RemoteAPI { .. } => {
                return Err(anyhow!("Remote API embedder not implemented yet"));
            }
        };

        embedder.init().await?;
        let arc_embedder: Arc<dyn Embedder> = Arc::from(embedder);
        write.insert(model_id.to_string(), arc_embedder.clone());

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
    let table_name = format!("{}_{}", collection_name, model_id.replace('/', "_"));

    let indexer = Indexer::new(engine.vector_db.clone(), embedder).map_err(|e| e.to_string())?;

    let mut total = 0;
    for path in paths {
        let p = std::path::Path::new(&path);
        total += indexer.index_directory(p, &table_name).await.map_err(|e| format!("Index {} failed: {}", path, e))?;
    }

    Ok(total)
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

    let embeddings = embedder
        .embed(vec![query])
        .await
        .map_err(|e| e.to_string())?;

    let query_vector = embeddings
        .into_iter()
        .next()
        .ok_or("Failed to generate embedding")?;

    let table_name = format!("{}_{}", collection_name, model_id.replace('/', "_"));

    let search_results = engine
        .vector_db
        .search_table(&table_name, query_vector, limit * 3)
        .await
        .map_err(|e| e.to_string())?;

    let mut unique_paths = Vec::new();
    for res in search_results {
        if !unique_paths.contains(&res.file_path) {
            unique_paths.push(res.file_path);
        }
    }
    unique_paths.truncate(limit);

    Ok(unique_paths)
}