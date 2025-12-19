use anyhow::{Context, Result};
use futures::TryStreamExt;
use lancedb::{connect, Connection, Table};
use lancedb::query::{ExecutableQuery, QueryBase}; 
use arrow_array::{
    ArrayRef, Float32Array, RecordBatch, StringArray,
};
use arrow_array::builder::{
    Float32Builder, StringBuilder,
};
use arrow_array::builder::FixedSizeListBuilder;
use arrow_array::RecordBatchIterator;
use arrow_schema::{DataType, Field, Schema};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct DocumentChunk {
    pub file_path: String,
    pub content: String,
    pub vector: Vec<f32>,
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub content: String,
    pub score: f32,
}

pub struct VectorDB {
    conn: Connection,
}

impl VectorDB {
    pub async fn new(db_path: PathBuf) -> Result<Self> {
        let db_path_str = db_path.to_string_lossy().to_string();
        let conn = connect(&db_path_str).execute().await?;
        Ok(Self { conn })
    }

    async fn get_or_create_table(&self, table_name: &str, vector_dim: usize) -> Result<Table> {
        let table_names = self.conn.table_names().execute().await?;

        if table_names.contains(&table_name.to_string()) {
            self.conn
                .open_table(table_name)
                .execute()
                .await
                .context("Open table failed")
        } else {
            let schema = Arc::new(Schema::new(vec![
                Field::new("file_path", DataType::Utf8, false),
                Field::new("content", DataType::Utf8, false),
                Field::new(
                    "vector",
                    DataType::FixedSizeList(
                        Arc::new(Field::new("item", DataType::Float32, true)),
                        vector_dim as i32,
                    ),
                    true,
                ),
            ]));

            let empty_reader = RecordBatchIterator::new(vec![].into_iter().map(Ok), schema.clone());

            self.conn
                .create_table(table_name, Box::new(empty_reader))
                .execute()
                .await
                .context("Create empty table failed")
        }
    }

    pub async fn insert_chunks(
        &self,
        table_name: &str,
        chunks: Vec<DocumentChunk>,
        vector_dim: usize,
    ) -> Result<()> {
        if chunks.is_empty() {
            return Ok(());
        }

        let table = self.get_or_create_table(table_name, vector_dim).await?;

        let mut file_path_builder = StringBuilder::new();
        let mut content_builder = StringBuilder::new();

        let values_builder = Float32Builder::with_capacity(chunks.len() * vector_dim);
        let mut vector_builder = FixedSizeListBuilder::new(values_builder, vector_dim as i32);

        for chunk in &chunks {
            file_path_builder.append_value(&chunk.file_path);
            content_builder.append_value(&chunk.content);
            vector_builder.values().append_slice(&chunk.vector);
            vector_builder.append(true);
        }

        let batch = RecordBatch::try_new(
            table.schema().await?,
            vec![
                Arc::new(file_path_builder.finish()) as ArrayRef,
                Arc::new(content_builder.finish()) as ArrayRef,
                Arc::new(vector_builder.finish()) as ArrayRef,
            ],
        )?;

        let reader = RecordBatchIterator::new(vec![Ok(batch)], table.schema().await?);

        table
            .add(reader)
            .execute()
            .await
            .context("Insert failed")?;

        Ok(())
    }

    pub async fn search_table(
        &self,
        table_name: &str,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        let table = self.conn.open_table(table_name).execute().await.context("Open table failed")?;

        let query = table
            .query()
            .nearest_to(query_vector)?;

        let mut stream = query
            .limit(limit)
            .execute() 
            .await?;

        let mut results = Vec::new();

        while let Some(batch) = stream.try_next().await? {
            let file_path_col = batch.column_by_name("file_path").unwrap().as_any().downcast_ref::<StringArray>().unwrap();
            let content_col = batch.column_by_name("content").unwrap().as_any().downcast_ref::<StringArray>().unwrap();
            let distance_col = batch.column_by_name("_distance").unwrap().as_any().downcast_ref::<Float32Array>().unwrap();

            for i in 0..batch.num_rows() {
                results.push(SearchResult {
                    file_path: file_path_col.value(i).to_string(),
                    content: content_col.value(i).to_string(),
                    score: distance_col.value(i),
                });
            }
        }

        Ok(results)
    }

    // 该方法目前未被使用，加上 allow(dead_code) 避免警告
    #[allow(dead_code)]
    pub async fn clear_collection(&self, table_name: &str) -> Result<()> {
        match self.conn.drop_table(table_name, &[]).await { 
            Ok(_) => Ok(()),
            Err(e) => if e.to_string().contains("not found") { Ok(()) } else { Err(e.into()) },
        }
    }
}