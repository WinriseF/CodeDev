use anyhow::{Context, Result};
use arrow_array::{Float32Array, RecordBatch, StringArray};
use lancedb::{connect, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use futures::TryStreamExt;

/// Represents a single piece of indexed content (a "chunk").
#[derive(Debug, Clone)]
pub struct DocumentChunk {
    pub id: String,          // Unique ID for the chunk
    pub file_path: String,   // Source file path
    pub content: String,     // The actual text content of the chunk
    pub vector: Vec<f32>,    // The embedding vector
}

/// A search result returned from the vector database.
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub content: String,
    pub score: f32, // Similarity score
}

/// Manages the connection and operations for the LanceDB vector store.
pub struct VectorDB {
    conn: Connection,
}

impl VectorDB {
    /// Creates a new connection to the LanceDB database.
    /// The database will be stored in the app's local data directory.
    pub async fn new(db_path: PathBuf) -> Result<Self> {
        let conn = connect(&db_path.to_string_lossy())
            .execute()
            .await
            .context("Failed to connect to LanceDB database")?;
        Ok(Self { conn })
    }

    /// Ensures a table exists for a given model, creating it if necessary.
    /// Table names are namespaced by model ID to prevent dimension conflicts.
    async fn get_or_create_table(&self, table_name: &str, vector_dim: usize) -> Result<lancedb::Table> {
        let table_names = self.conn.table_names().await?;
        if table_names.iter().any(|name| name == table_name) {
            self.conn.open_table(table_name).await.context(format!("Failed to open existing table '{}'", table_name))
        } else {
            // Define the schema for our table
            let schema = Arc::new(arrow_schema::Schema::new(vec![
                arrow_schema::Field::new("file_path", arrow_schema::DataType::Utf8, false),
                arrow_schema::Field::new("content", arrow_schema::DataType::Utf8, false),
                arrow_schema::Field::new(
                    "vector",
                    arrow_schema::DataType::FixedSizeList(
                        Arc::new(arrow_schema::Field::new("item", arrow_schema::DataType::Float32, true)),
                        vector_dim as i32,
                    ),
                    true,
                ),
            ]));
            
            self.conn.create_table(table_name, schema).await.context(format!("Failed to create new table '{}'", table_name))
        }
    }

    /// Inserts or updates a batch of document chunks into the specified table.
    pub async fn insert_chunks(&self, table_name: &str, chunks: Vec<DocumentChunk>, vector_dim: usize) -> Result<()> {
        if chunks.is_empty() {
            return Ok(());
        }

        let table = self.get_or_create_table(table_name, vector_dim).await?;

        // Convert our DocumentChunk struct into an Arrow RecordBatch for LanceDB
        let file_paths = StringArray::from(chunks.iter().map(|c| c.file_path.clone()).collect::<Vec<_>>());
        let contents = StringArray::from(chunks.iter().map(|c| c.content.clone()).collect::<Vec<_>>());
        let vectors_flat: Vec<f32> = chunks.into_iter().flat_map(|c| c.vector).collect();
        let vectors = Float32Array::from(vectors_flat);

        let batch = RecordBatch::try_new(
            table.schema().await?,
            vec![
                Arc::new(file_paths),
                Arc::new(contents),
                Arc::new(arrow_array::FixedSizeListArray::try_new_from_values(vectors, vector_dim as i32)?),
            ],
        )?;

        table.add(vec![batch]).await.context("Failed to insert chunks into table")?;
        Ok(())
    }

    /// Searches the specified table for chunks similar to the query vector.
    pub async fn search(&self, table_name: &str, query_vector: Vec<f32>, limit: usize) -> Result<Vec<SearchResult>> {
        let table = self.conn.open_table(table_name).await.context(format!("Table '{}' not found for searching", table_name))?;

        let mut stream = table
            .search(&query_vector)
            .limit(limit)
            .execute_stream()
            .await
            .context("Failed to execute search query")?;

        let mut results = Vec::new();
        while let Some(batch) = stream.try_next().await? {
            let file_path_col = batch.column_by_name("file_path").unwrap().as_any().downcast_ref::<StringArray>().unwrap();
            let content_col = batch.column_by_name("content").unwrap().as_any().downcast_ref::<StringArray>().unwrap();
            let score_col = batch.column_by_name("_score").unwrap().as_any().downcast_ref::<Float32Array>().unwrap();

            for i in 0..batch.num_rows() {
                results.push(SearchResult {
                    file_path: file_path_col.value(i).to_string(),
                    content: content_col.value(i).to_string(),
                    score: score_col.value(i),
                });
            }
        }

        Ok(results)
    }

    /// Deletes all data associated with a specific project/model combination.
    pub async fn clear_collection(&self, table_name: &str) -> Result<()> {
        self.conn.drop_table(table_name).await.context(format!("Failed to drop table '{}'", table_name))?;
        Ok(())
    }
}