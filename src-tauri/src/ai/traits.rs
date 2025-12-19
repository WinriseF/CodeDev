use async_trait::async_trait;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// 定义模型的来源类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelSource {
    /// 本地 ONNX 模型 (如 Jina-v3, Qwen-0.6B)
    LocalOnnx {
        /// HuggingFace 上的 Repo ID (例如 "jinaai/jina-embeddings-v3")
        repo_id: String,
        /// ONNX 文件名 (例如 "model_quantized.onnx")
        file_name: String,
        /// 是否需要特殊的 Tokenizer 配置
        tokenizer_name: Option<String>,
    },
    /// 远程 API (如 OpenAI, DeepSeek)
    RemoteAPI {
        provider: String, // "openai", "deepseek"
        base_url: String,
        api_key: Option<String>, // 可以为空，运行时从配置读取
        model_name: String,
    },
}

/// 模型配置元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,           // 唯一标识符，如 "jina-v3-local"
    pub name: String,         // 显示名称，如 "Jina Embeddings v3 (Local)"
    pub description: String,
    pub dimension: usize,     // 向量维度，用于校验数据库
    pub source: ModelSource,
    pub batch_size: usize,    // 批处理大小，默认 32
}

/// 核心 Embedding 接口
/// 所有的实现（LocalOnnx, RemoteApi）都必须遵循此契约
#[async_trait]
pub trait Embedder: Send + Sync {
    /// 初始化模型
    /// 对于本地模型：检查文件是否存在，不存在则下载，然后加载到内存
    /// 对于远程模型：检查连接性
    async fn init(&mut self) -> Result<()>;

    /// 生成向量
    /// 输入：文本列表
    /// 输出：二维浮点数组 (batch_size * dimension)
    async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>>;

    /// 获取模型维度
    fn dimension(&self) -> usize;

    /// 获取模型 ID
    fn model_id(&self) -> &str;
}

/// 未来扩展：本地 LLM 接口 (预留)
#[async_trait]
pub trait LocalLLM: Send + Sync {
    async fn load(&mut self) -> Result<()>;
    // 这里预留流式对话接口
    // async fn stream_chat(&self, messages: Vec<ChatMessage>) -> Result<BoxStream<'static, String>>;
}