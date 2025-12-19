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
    pub batch_size: usize, // 新增：供 indexer 动态读取批次大小
}

#[async_trait]
pub trait Embedder: Send + Sync {
    async fn init(&mut self) -> Result<()>;

    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;

    fn dimension(&self) -> usize;

    fn model_id(&self) -> &str;

    /// 返回推荐的批处理大小（可选实现，默认 16）
    fn batch_size(&self) -> usize {
        16
    }
}