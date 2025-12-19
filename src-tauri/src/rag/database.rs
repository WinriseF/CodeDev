use anyhow::{Context, Result};
use arrow_array::{FixedSizeListArray, Float32Array, RecordBatch, StringArray};
use arrow_schema::{DataType, Field, Schema};
use futures::TryStreamExt; // 需要引入这个 trait 来处理流
use lancedb::{connect, Connection, Table};
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
        // LanceDB 0.21 connect 通常直接接受字符串
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
            // 定义 Schema
            let schema = Arc::new(Schema::new(vec![
                Field::new("file_path", DataType::Utf8, false),
                Field::new("content", DataType::Utf8, false),
                Field::new(
                    "vector",
                    DataType::FixedSizeList(
                        Arc::new(Field::new("item", DataType::Float32, true)),
                        vector_dim as i32,
                    ),
                    true, // nullable
                ),
            ]));

            // 使用 create_empty_table
            self.conn
                .create_empty_table(table_name, schema)
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

        // 构建 Arrow Arrays
        let file_paths = StringArray::from(
            chunks
                .iter()
                .map(|c| c.file_path.as_str())
                .collect::<Vec<_>>(),
        );
        let contents = StringArray::from(
            chunks
                .iter()
                .map(|c| c.content.as_str())
                .collect::<Vec<_>>(),
        );

        // 展平向量数据
        let vectors_flat: Vec<f32> = chunks.iter().flat_map(|c| c.vector.clone()).collect();
        let vectors_values = Float32Array::from(vectors_flat);

        // 构建 FixedSizeListArray
        let vector_array = FixedSizeListArray::try_new(
            Arc::new(Field::new("item", DataType::Float32, true)),
            vector_dim as i32,
            Arc::new(vectors_values),
            None,
        )?;

        // 构建 RecordBatch
        let batch = RecordBatch::try_new(
            table.schema().await?,
            vec![
                Arc::new(file_paths),
                Arc::new(contents),
                Arc::new(vector_array),
            ],
        )?;

        // 插入数据 (Box::new 以匹配迭代器类型)
        table
            .add(Box::new(vec![batch].into_iter().map(Ok)))
            .execute()
            .await
            .context("Insert failed")?;
            
        Ok(())
    }

    pub async fn search(
        &self,
        table_name: &str,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        let table = self
            .conn
            .open_table(table_name)
            .execute()
            .await
            .context("Open table failed")?;

        // 修复：LanceDB 0.21+ 使用 query().nearest_to()
        let mut stream = table
            .query()
            .nearest_to(query_vector)? // 传入查询向量
            .limit(limit)
            .execute()
            .await?;

        let mut search_results = Vec::new();

        // 处理 RecordBatch 流
        while let Some(batch) = stream.try_next().await? {
            let file_path_col = batch
                .column_by_name("file_path")
                .ok_or(anyhow::anyhow!("Missing file_path column"))?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(anyhow::anyhow!("Invalid file_path type"))?;

            let content_col = batch
                .column_by_name("content")
                .ok_or(anyhow::anyhow!("Missing content column"))?
                .as_any()
                .downcast_ref::<StringArray>()
                .ok_or(anyhow::anyhow!("Invalid content type"))?;

            // _distance 是 LanceDB 自动生成的距离列
            let distance_col = batch
                .column_by_name("_distance")
                .ok_or(anyhow::anyhow!("Missing _distance column"))?
                .as_any()
                .downcast_ref::<Float32Array>()
                .ok_or(anyhow::anyhow!("Invalid distance type"))?;

            for i in 0..batch.num_rows() {
                search_results.push(SearchResult {
                    file_path: file_path_col.value(i).to_string(),
                    content: content_col.value(i).to_string(),
                    score: distance_col.value(i),
                });
            }
        }

        Ok(search_results)
    }

    pub async fn clear_collection(&self, table_name: &str) -> Result<()> {
        // LanceDB 0.21 可能不支持直接 drop_table 某些版本，
        // 如果报错，可以尝试忽略不存在的错误
        match self.conn.drop_table(table_name).execute().await {
            Ok(_) => Ok(()),
            Err(e) => {
                // 如果是“表不存在”错误，可以忽略
                if e.to_string().contains("not found") {
                    Ok(())
                } else {
                    Err(e.into())
                }
            }
        }
    }
}