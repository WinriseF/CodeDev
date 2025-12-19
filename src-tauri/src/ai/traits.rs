use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelSource {
    LocalOnnx {
        repo_id: String,
        file_name: String,
        tokenizer_name: Option<String>,
    },
    RemoteAPI {
        provider: String,
        base_url: String,
        api_key: Option<String>,
        model_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub dimension: usize,
    pub source: ModelSource,
    pub batch_size: usize, 
}

#[async_trait]
pub trait Embedder: Send + Sync {
    /// 初始化 Embedder（例如加载模型、Tokenizer 或建立连接）
    async fn init(&mut self) -> Result<()>;

    /// 生成文本的 Embeddings
    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;

    /// 获取向量维度
    fn dimension(&self) -> usize;

    /// 获取模型 ID (目前未被显式调用)
    #[allow(dead_code)]
    fn model_id(&self) -> &str;

    /// 获取推荐的批处理大小
    fn batch_size(&self) -> usize {
        16
    }
}