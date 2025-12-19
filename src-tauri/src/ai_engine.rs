use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;
use serde::Serialize;

use crate::ai::onnx_backend::LocalOnnxEmbedder;
use crate::ai::registry::MODEL_REGISTRY;
use crate::ai::traits::Embedder;
use crate::rag::database::VectorDB;
use crate::rag::indexer::Indexer;

// 定义返回给前端的数据结构
#[derive(Serialize)]
pub struct SearchResultDto {
    pub path: String,
    pub content: String,
    pub score: f32,
}

pub struct AIEngine {
    embedders: RwLock<HashMap<String, Arc<dyn Embedder>>>,
    vector_db: Arc<VectorDB>,
    app_handle: AppHandle,
}

impl AIEngine {
    pub async fn new(app_handle: AppHandle) -> Result<Self> {
        // 初始化 ONNX Runtime 环境
        // 使用 ort::init() 返回 Builder，commit() 才会真正初始化全局环境
        // 如果环境已经被初始化过，这里可能会报错，我们捕获它但不终止程序
        if let Err(e) = ort::init()
            .with_name("CodeForgeAI_Engine")
            .commit() 
        {
            eprintln!("ORT Environment initialization warning (might be already initialized): {}", e);
        }

        let db_path = app_handle
            .path()
            .app_local_data_dir()?
            .join("rag_db");

        // 确保存储目录存在
        if !db_path.exists() {
            tokio::fs::create_dir_all(&db_path).await?;
        }

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
        // 双重检查，防止在获取写锁期间被其他线程写入
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

        // 关键：初始化模型（下载/加载文件）
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
    
    // 表名生成策略：collection_model
    let table_name = format!("{}_{}", collection_name, model_id.replace('/', "_"));

    let indexer = Indexer::new(engine.vector_db.clone(), embedder).map_err(|e| e.to_string())?;

    let mut total = 0;
    for path in paths {
        let p = std::path::Path::new(&path);
        if p.exists() {
            total += indexer.index_directory(p, &table_name).await.map_err(|e| format!("Index {} failed: {}", path, e))?;
        } else {
            eprintln!("Warning: Path not found during indexing: {}", path);
        }
    }

    Ok(total)
}

#[tauri::command]
pub async fn search_code(
    query: String,
    collection_name: String,
    model_id: String,
    limit: usize,
    return_content: bool, // 新增参数：由前端控制是否返回代码内容
    engine: State<'_, AIEngine>,
) -> Result<Vec<SearchResultDto>, String> {
    let embedder = engine.get_embedder(&model_id).await.map_err(|e| e.to_string())?;

    // 1. 将查询转换为向量
    let embeddings = embedder
        .embed(vec![query])
        .await
        .map_err(|e| e.to_string())?;

    let query_vector = embeddings
        .into_iter()
        .next()
        .ok_or("Failed to generate embedding")?;

    let table_name = format!("{}_{}", collection_name, model_id.replace('/', "_"));

    // 2. 数据库检索
    let search_results = engine
        .vector_db
        .search_table(&table_name, query_vector, limit)
        .await
        .map_err(|e| e.to_string())?;

    // 3. 映射结果
    let dtos = search_results.into_iter().map(|res| {
        SearchResultDto {
            path: res.file_path,
            content: if return_content { res.content } else { String::new() },
            score: res.score,
        }
    }).collect();

    Ok(dtos)
}