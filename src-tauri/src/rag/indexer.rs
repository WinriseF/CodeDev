use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use text_splitter::{Characters, ChunkConfig, TextSplitter};
use tokio::fs;

use crate::ai::traits::Embedder;
// 引用修复
use super::database::{DocumentChunk, VectorDB};

pub struct Indexer {
    vector_db: Arc<VectorDB>,
    embedder: Arc<dyn Embedder>,
}

impl Indexer {
    pub fn new(vector_db: Arc<VectorDB>, embedder: Arc<dyn Embedder>) -> Result<Self> {
        Ok(Self {
            vector_db,
            embedder,
        })
    }

    fn create_splitter(&self) -> TextSplitter<Characters> {
        // text-splitter 0.16 中 ChunkConfig::new 可能是非 Result 的，或者 unwrap 处理
        // 我们使用 unwrap_or_else 处理可能的错误（视具体版本实现而定）
        let config = ChunkConfig::new(256)
            .with_overlap(32)
            .unwrap_or_else(|_| ChunkConfig::new(256));
            
        TextSplitter::new(config)
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
                self.vector_db
                    .insert_chunks(table_name, chunks.clone(), self.embedder.dimension())
                    .await?;
                total_indexed_chunks += num_chunks;
            }
        }

        Ok(total_indexed_chunks)
    }

    async fn collect_files(&self, root_path: &Path, file_list: &mut Vec<PathBuf>) -> Result<()> {
        let mut stack = vec![root_path.to_path_buf()];
        while let Some(current_path) = stack.pop() {
            let mut entries = match fs::read_dir(&current_path).await {
                Ok(entries) => entries,
                Err(_) => continue, 
            };

            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                let name = entry.file_name();
                let name_str = name.to_string_lossy();

                if name_str.starts_with('.') { continue; }

                if entry.file_type().await?.is_dir() {
                    stack.push(path);
                } else {
                    if let Some(ext) = path.extension() {
                        let ext_str = ext.to_string_lossy();
                        if ["rs", "ts", "tsx", "js", "json", "md", "txt", "py"].contains(&ext_str.as_ref()) {
                            file_list.push(path);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    async fn process_file_batch(&self, file_paths: &[PathBuf]) -> Result<Vec<DocumentChunk>> {
        let mut texts_to_embed = Vec::new();
        let mut metadata = Vec::new();
        
        let splitter = self.create_splitter();

        for path in file_paths {
            if let Ok(content) = fs::read_to_string(path).await {
                if content.trim().is_empty() { continue; }
                let path_str = path.to_string_lossy().to_string();

                for chunk in splitter.chunks(&content) {
                    if chunk.len() > 10 {
                        texts_to_embed.push(chunk.to_string());
                        metadata.push(path_str.clone());
                    }
                }
            }
        }

        if texts_to_embed.is_empty() { return Ok(vec![]); }

        let vectors = self.embedder.embed(texts_to_embed.clone()).await
            .context("Failed to generate embeddings")?;

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