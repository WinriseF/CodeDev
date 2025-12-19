use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

use crate::ai::onnx_backend::LocalOnnxEmbedder;
use crate::ai::registry::MODEL_REGISTRY;
use crate::ai::traits::{Embedder, ModelConfig};
use crate::rag::database::VectorDB;
use crate::rag::indexer::Indexer;

/// 它管理着所有已加载的 AI 模型实例和数据库连接。
pub struct AIEngine {
    /// 存储已初始化的 Embedding 模型实例。
    /// Key 是模型 ID (例如 "jina-v3-base-zh")。
    /// 使用 RwLock 允许多个并发的读操作（例如，多个搜索请求）。
    embedders: RwLock<HashMap<String, Arc<dyn Embedder>>>,
    
    /// 向量数据库的连接实例。
    vector_db: Arc<VectorDB>,
    
    /// ONNX Runtime 环境，是线程安全的，可以在多个模型间共享。
    ort_environment: Arc<ort::Environment>,
    
    /// Tauri AppHandle，用于访问应用路径等。
    app_handle: AppHandle,
}

impl AIEngine {
    /// 初始化 AI 引擎。
    pub async fn new(app_handle: AppHandle) -> Result<Self> {
        let db_path = app_handle.path()
            .app_local_data_dir()?
            .join("rag_db");
        
        let vector_db = Arc::new(VectorDB::new(db_path).await?);
        
        // 创建 ONNX Runtime 环境，并使用 Arc 进行共享
        let ort_environment = Arc::new(
            ort::Environment::builder()
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

    /// 根据模型 ID 获取或初始化一个 Embedding 模型实例。
    async fn get_embedder(&self, model_id: &str) -> Result<Arc<dyn Embedder>> {
        // 先用读锁检查模型是否已加载，这是最常见的情况，性能最高。
        let reader = self.embedders.read().await;
        if let Some(embedder) = reader.get(model_id) {
            return Ok(embedder.clone());
        }
        // 释放读锁
        drop(reader);

        // 如果模型未加载，则获取写锁来创建它。
        let mut writer = self.embedders.write().await;
        
        // 在获取写锁后再次检查，防止多线程并发初始化同一个模型
        if let Some(embedder) = writer.get(model_id) {
            return Ok(embedder.clone());
        }

        // 从模型注册表中查找配置
        let config = MODEL_REGISTRY
            .get(model_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Model '{}' not found in registry", model_id))?;
        
        // 根据配置创建模型实例
        let mut embedder: Box<dyn Embedder> = match config.source {
            crate::ai::traits::ModelSource::LocalOnnx { .. } => {
                Box::new(LocalOnnxEmbedder::new(
                    config,
                    self.ort_environment.clone(),
                    self.app_handle.clone(),
                ))
            }
            crate::ai::traits::ModelSource::RemoteAPI { .. } => {
                // 在这里实现 RemoteApiEmbedder 的初始化
                // return Err(anyhow::anyhow!("Remote API embedder not yet implemented"));
                unimplemented!();
            }
        };

        // 初始化模型（下载、加载到内存等）
        embedder.init().await?;
        
        let arc_embedder = Arc::from(embedder);
        writer.insert(model_id.to_string(), arc_embedder.clone());

        Ok(arc_embedder)
    }
}

// --- Tauri Commands ---

/// Tauri 命令：为一个或多个目录建立索引。
#[tauri::command]
pub async fn index_project(
    paths: Vec<String>,
    collection_name: String, // 集合名称，例如项目名称
    model_id: String, // 使用哪个 Embedding 模型进行索引
    engine: State<'_, AIEngine>,
) -> Result<usize, String> {
    
    // 1. 获取模型实例
    let embedder = engine.get_embedder(&model_id).await.map_err(|e| e.to_string())?;

    // 2. 根据项目和模型生成唯一的表名
    // TODO: 使用项目路径的哈希值来创建更唯一的名称
    let table_name = format!("{}_{}", collection_name, model_id.replace("/", "_"));

    // 3. 创建索引器实例
    let indexer = Indexer::new(engine.vector_db.clone(), embedder);
    
    // 4. 遍历所有路径并执行索引
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

/// Tauri 命令：根据查询在指定集合中搜索相关文件路径。
#[tauri::command]
pub async fn search_code(
    query: String,
    collection_name: String,
    model_id: String,
    limit: usize,
    engine: State<'_, AIEngine>,
) -> Result<Vec<String>, String> {

    // 1. 获取模型实例来向量化查询
    let embedder = engine.get_embedder(&model_id).await.map_err(|e| e.to_string())?;
    
    // 2. 向量化用户查询
    let query_vector = embedder.embed(vec![query]).await.map_err(|e| e.to_string())?[0].clone();

    // 3. 确定要搜索的表
    let table_name = format!("{}_{}", collection_name, model_id.replace("/", "_"));

    // 4. 在数据库中执行搜索
    let search_results = engine.vector_db.search(&table_name, query_vector, limit * 3) // 获取更多结果以聚合
        .await
        .map_err(|e| e.to_string())?;

    // 5. 聚合结果并返回去重的文件路径
    // TODO: 实现更智能的聚合策略，例如根据分数加权
    let mut file_paths = Vec::new();
    for res in search_results {
        if !file_paths.contains(&res.file_path) {
            file_paths.push(res.file_path);
        }
    }
    
    // 只返回请求的 limit 数量
    file_paths.truncate(limit);

    Ok(file_paths)
}