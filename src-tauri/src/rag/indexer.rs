use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use text_splitter::{ChunkConfig, TextSplitter};
use tokio::fs;
use uuid::Uuid;

use crate::ai::traits::Embedder;
use super::database::{DocumentChunk, VectorDB};

pub struct Indexer {
    vector_db: Arc<VectorDB>,
    embedder: Arc<dyn Embedder>,
    chunk_config: ChunkConfig,
}

impl Indexer {
    pub fn new(vector_db: Arc<VectorDB>, embedder: Arc<dyn Embedder>) -> Self {
        let chunk_config = ChunkConfig::new(256)?
            .with_overlap(32)
            .with_trim(true);

        Self {
            vector_db,
            embedder,
            chunk_config,
        }
    }

    pub async fn index_directory(&self, root_path: &Path, table_name: &str) -> Result<usize> {
        let mut file_paths = Vec::new();
        self.collect_files(root_path, &mut file_paths).await?;

        let mut total_chunks_indexed = 0;

        let batch_size = self.embedder.batch_size(); // 可从 config 取，或默认 16

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

    async fn collect_files(&self, path: &Path, file_list: &mut Vec<PathBuf>) -> Result<()> {
        let mut entries = fs::read_dir(path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
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

    async fn process_file_batch(&self, file_paths: &[PathBuf]) -> Result<Vec<DocumentChunk>> {
        let mut all_chunks = Vec::new();
        let mut texts_to_embed = Vec::new();
        let mut chunk_metadata = Vec::new();

        for path in file_paths {
            if let Ok(content) = tokio::fs::read_to_string(path).await {
                let splitter = TextSplitter::new(self.chunk_config.clone());

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

        let vectors = self
            .embedder
            .embed(texts_to_embed.clone())
            .await
            .context("为文件批次生成 Embedding 失败")?;

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