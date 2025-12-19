use std::collections::HashMap;
use once_cell::sync::Lazy;
use super::traits::{ModelConfig, ModelSource};

/// 定义所有内置支持的模型。
/// 使用 `Lazy` 静态初始化，确保只构建一次。
pub static MODEL_REGISTRY: Lazy<HashMap<String, ModelConfig>> = Lazy::new(|| {
    let mut m = HashMap::new();

    // 1. Jina Embeddings v3 (多语言，推荐)
    m.insert(
        "jina-v3-base-zh".to_string(),
        ModelConfig {
            id: "jina-v3-base-zh".to_string(),
            name: "Jina v3 Base (Chinese)".to_string(),
            description: "A powerful multilingual model, optimized for Chinese text and code retrieval.".to_string(),
            dimension: 768, // Jina V3 Base 的维度是 768
            source: ModelSource::LocalOnnx {
                // 模型在 HuggingFace 上的地址
                repo_id: "jinaai/jina-embeddings-v3-base-zh".to_string(),
                // ONNX 文件名
                file_name: "model.onnx".to_string(),
                // 使用 Jina 自己的 Tokenizer 配置
                tokenizer_name: Some("jinaai/jina-embeddings-v3-base-zh".to_string()),
            },
            batch_size: 16,
        },
    );
    
    // 2. Qwen3-Embedding-0.6B (高性能，未来集成)
    // 注意：目前只是占位符，需要确认 HF 上有合适的 ONNX 版本
    m.insert(
        "qwen3-embedding-0.6b".to_string(),
        ModelConfig {
            id: "qwen3-embedding-0.6b".to_string(),
            name: "Qwen3 Embedding (0.6B)".to_string(),
            description: "Next-generation lightweight model from Alibaba Cloud, excellent semantic understanding.".to_string(),
            dimension: 1024, // Qwen 0.6B 通常是 1024 维，需要确认
            source: ModelSource::LocalOnnx {
                repo_id: "Qwen/Qwen2-0.5B".to_string(), // 这是一个示例 Repo ID
                file_name: "model.onnx".to_string(),
                tokenizer_name: Some("Qwen/Qwen2-0.5B".to_string()),
            },
            batch_size: 8,
        },
    );

    // 3. 远程 API 示例
    m.insert(
        "openai-text-embedding-3-small".to_string(),
        ModelConfig {
            id: "openai-text-embedding-3-small".to_string(),
            name: "OpenAI embedding-3-small (API)".to_string(),
            description: "High-performance embedding model from OpenAI, requires API key.".to_string(),
            dimension: 1536,
            source: ModelSource::RemoteAPI {
                provider: "openai".to_string(),
                base_url: "https://api.openai.com/v1".to_string(),
                api_key: None, // API Key 在运行时从用户配置中读取
                model_name: "text-embedding-3-small".to_string(),
            },
            batch_size: 32,
        },
    );

    m
});