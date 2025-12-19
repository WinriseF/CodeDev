use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use text_splitter::{Characters, ChunkConfig, TextSplitter};
use tokio::fs;
use uuid::Uuid;

use crate::ai::traits::Embedder;
use super::database::{DocumentChunk, VectorDB};

pub struct Indexer {
    vector_db: Arc<VectorDB>,
    embedder: Arc<dyn Embedder>,
    chunk_config: ChunkConfig<Characters>,
}

impl Indexer {
    pub fn new(vector_db: Arc<VectorDB>, embedder: Arc<dyn Embedder>) -> Result<Self> {
        let chunk_config = ChunkConfig::new(256)?
            .with_overlap(32)
            .with_trim(true);

        Ok(Self {
            vector_db,
            embedder,
            chunk_config,
        })
    }

    pub async fn index_directory(&self, root_path: &Path, table_name: &str) -> Result<usize> {
        let mut file_paths = Vec::new();
        self.collect_files(root_path, &mut file_paths).await?;

        let mut total_indexed_chunks = 0;
        let batch_size = self.embedder.batch_size().max(1);

        for file_batch in file_paths.chunks(batch_size) {
            let chunks = self.process_file_batch(file_batch).await?;
            let num_chunks = chunks.len();

            if num_chunks > 0 {
                // clone 以避免 move 后 borrow
                self.vector_db
                    .insert_chunks(table_name, chunks.clone(), self.embedder.dimension())
                    .await?;
                total_indexed_chunks += num_chunks;
            }
        }

        Ok(total_indexed_chunks)
    }

    /// 非递归文件收集（使用栈模拟递归，避免 async 递归问题）
    async fn collect_files(&self, root_path: &Path, file_list: &mut Vec<PathBuf>) -> Result<()> {
        let mut stack = vec![root_path.to_path_buf()];

        while let Some(current_path) = stack.pop() {
            let mut entries = match fs::read_dir(&current_path).await {
                Ok(entries) => entries,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(e.into()),
            };

            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();

                // 跳过隐藏文件/目录（如 .git, .vscode）
                if file_name_str.starts_with('.') {
                    continue;
                }

                if entry.file_type().await?.is_dir() {
                    stack.push(path);
                } else {
                    file_list.push(path);
                }
            }
        }

        Ok(())
    }

    /// 处理一批文件：读取、分块、嵌入
    async fn process_file_batch(&self, file_paths: &[PathBuf]) -> Result<Vec<DocumentChunk>> {
        let mut texts_to_embed = Vec::new();
        let mut metadata = Vec::new();

        for path in file_paths {
            if let Ok(content) = fs::read_to_string(path).await {
                // 跳过空文件
                if content.trim().is_empty() { continue; }

                let splitter = TextSplitter::new(self.chunk_config.clone());
                let path_str = path.to_string_lossy().to_string();

                for chunk in splitter.chunks(&content) {
                    // 过滤极短的 chunk
                    if chunk.len() > 10 { 
                        texts_to_embed.push(chunk.to_string());
                        metadata.push(path_str.clone());
                    }
                }
            }
        }

        if texts_to_embed.is_empty() {
            return Ok(vec![]);
        }

        let vectors = self
            .embedder
            .embed(texts_to_embed.clone())
            .await
            .context("Failed to generate embeddings for batch")?;

        let mut chunks = Vec::with_capacity(vectors.len());
        for ((text, file_path), vector) in texts_to_embed.into_iter().zip(metadata).zip(vectors) {
            chunks.push(DocumentChunk {
                file_path,
                content: text,
                vector,
            });
        }

        Ok(chunks)
    }
}