use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use text_splitter::{ChunkConfig, TextSplitter};
use tokio::fs;
use uuid::Uuid;

use crate::ai::traits::Embedder;
use super::database::{DocumentChunk, VectorDB};

/// 管理为 RAG 集合索引文件的过程。
pub struct Indexer {
    vector_db: Arc<VectorDB>,
    embedder: Arc<dyn Embedder>,
    chunk_config: ChunkConfig,
}

impl Indexer {
    /// 创建一个新的 Indexer 实例。
    pub fn new(vector_db: Arc<VectorDB>, embedder: Arc<dyn Embedder>) -> Self {
        // 配置文本分块器。这些值可以根据效果进行调整。
        // 我们的目标是大约 256 个 token 的块大小，并带有一些重叠部分。
        let chunk_config = ChunkConfig::new(256)
            .with_overlap(32)  // 块之间的重叠大小，确保上下文连续性
            .with_trim(true);  // 移除每个块前后的空白字符

        Self {
            vector_db,
            embedder,
            chunk_config,
        }
    }

    /// 递归地索引整个目录。
    ///
    /// # 参数
    /// * `root_path` - 开始扫描的根目录。
    /// * `table_name` - 向量数据库中的集合/表名。
    pub async fn index_directory(&self, root_path: &Path, table_name: &str) -> Result<usize> {
        let mut file_paths = Vec::new();
        self.collect_files(root_path, &mut file_paths).await?;

        let mut total_chunks_indexed = 0;

        // 【错误修正处】根据模型 ID 动态设置批处理大小。
        // Jina 模型非常高效，可以使用更大的批次。
        let batch_size = if self.embedder.model_id().contains("jina") { 32 } else { 16 };

        // 分批处理文件，以有效管理内存和 API 调用
        for file_batch in file_paths.chunks(batch_size) {
            let chunks = self.process_file_batch(file_batch).await?;
            if !chunks.is_empty() {
                let num_chunks = chunks.len();
                self.vector_db
                    .insert_chunks(table_name, chunks, self.embedder.dimension())
                    .await?;
                total_chunks_indexed += num_chunks;
            }
        }

        Ok(total_chunks_indexed)
    }

    /// 递归地从目录中收集所有文件路径，跳过隐藏文件/目录。
    async fn collect_files(&self, path: &Path, file_list: &mut Vec<PathBuf>) -> Result<()> {
        let mut entries = fs::read_dir(path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            // 跳过以 '.' 开头的隐藏文件和目录，例如 .git, .vscode
            if entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            if entry.file_type().await?.is_dir() {
                self.collect_files(&entry_path, file_list).await?;
            } else {
                file_list.push(entry_path);
            }
        }
        Ok(())
    }

    /// 处理一批文件：读取、分块，并创建 DocumentChunk 对象。
    async fn process_file_batch(&self, file_paths: &[PathBuf]) -> Result<Vec<DocumentChunk>> {
        let mut all_chunks = Vec::new();
        let mut texts_to_embed = Vec::new();
        let mut chunk_metadata = Vec::new();

        for path in file_paths {
            // 只处理可以被读取为 UTF-8 文本的文件
            if let Ok(content) = fs::read_to_string(path).await {
                // 根据文件扩展名确定使用哪种分块策略
                let splitter = match path.extension().and_then(|s| s.to_str()) {
                    Some("md") | Some("mdx") => TextSplitter::new(self.chunk_config.clone()),
                    // 可以在这里为不同的编程语言添加更精细的分块器
                    Some("rs") | Some("js") | Some("ts") | Some("py") => {
                        TextSplitter::new(self.chunk_config.clone())
                    }
                    _ => TextSplitter::new(self.chunk_config.clone()),
                };

                let path_str = path.to_string_lossy().to_string();
                for chunk_text in splitter.chunks(&content) {
                    texts_to_embed.push(chunk_text.to_string());
                    chunk_metadata.push(path_str.clone());
                }
            }
        }
        
        if texts_to_embed.is_empty() {
            return Ok(all_chunks);
        }

        // 为整个批次的文本生成 Embedding 向量
        let vectors = self
            .embedder
            .embed(texts_to_embed.clone())
            .await
            .context("为文件批次生成 Embedding 失败")?;

        // 将元数据（文件路径）和向量组合成 DocumentChunk 对象
        for ((text, file_path), vector) in texts_to_embed.into_iter().zip(chunk_metadata).zip(vectors) {
            all_chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                file_path,
                content: text,
                vector,
            });
        }
        
        Ok(all_chunks)
    }
}