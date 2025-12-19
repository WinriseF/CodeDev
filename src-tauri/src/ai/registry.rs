use std::collections::HashMap;
use once_cell::sync::Lazy;
use super::traits::{ModelConfig, ModelSource};

pub static MODEL_REGISTRY: Lazy<HashMap<String, ModelConfig>> = Lazy::new(|| {
    let mut m = HashMap::new();

    // --- Jina V2 (ZH Optimized) ---
    m.insert(
        "jina-v3-base-zh".to_string(),
        ModelConfig {
            id: "jina-v3-base-zh".to_string(),
            // 修复：添加 .to_string()
            name: "Jina v2 Base (ZH Optimized)".to_string(),
            // 修复：添加 .to_string()
            description: "High-performance embedding model (Xenova ONNX version).".to_string(),
            dimension: 768,
            source: ModelSource::LocalOnnx {
                repo_id: "Xenova/jina-embeddings-v2-base-zh".to_string(),
                file_name: "model.onnx".to_string(),
                tokenizer_name: Some("tokenizer.json".to_string()),
            },
            batch_size: 16,
        },
    );

    // --- Qwen3 ---
    m.insert(
        "qwen3-embedding-0.6b".to_string(),
        ModelConfig {
            id: "qwen3-embedding-0.6b".to_string(),
            name: "Qwen3 Embedding (0.6B)".to_string(),
            description: "Next-generation lightweight model from Alibaba Cloud.".to_string(),
            dimension: 1024, 
            source: ModelSource::LocalOnnx {
                repo_id: "Qwen/Qwen2-0.5B".to_string(), 
                file_name: "model.onnx".to_string(),
                tokenizer_name: Some("Qwen/Qwen2-0.5B".to_string()),
            },
            batch_size: 8,
        },
    );

    // --- OpenAI ---
    m.insert(
        "openai-text-embedding-3-small".to_string(),
        ModelConfig {
            id: "openai-text-embedding-3-small".to_string(),
            name: "OpenAI embedding-3-small (API)".to_string(),
            description: "High-performance embedding model from OpenAI.".to_string(),
            dimension: 1536,
            source: ModelSource::RemoteAPI {
                provider: "openai".to_string(),
                base_url: "https://api.openai.com/v1".to_string(),
                api_key: None, 
                model_name: "text-embedding-3-small".to_string(),
            },
            batch_size: 32,
        },
    );

    m
});