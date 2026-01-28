use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct TransferRecord {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub direction: String,
    pub status: String,
    pub created_at: i64,
}

pub struct FileService;

impl FileService {
    pub async fn get_upload_dir() -> PathBuf {
        // Use dirs crate for cross-platform download directory
        if let Some(download_path) = dirs::download_dir() {
            let mut path = download_path;
            path.push("CodeForge_Transfers");
            if !path.exists() {
                let _ = fs::create_dir_all(&path).await;
            }
            return path;
        }
        // Fallback to current directory
        let mut path = PathBuf::from(".");
        path.push("CodeForge_Transfers");
        if !path.exists() {
            let _ = fs::create_dir_all(&path).await;
        }
        path
    }

    #[allow(dead_code)]
    pub fn save_transfer_record(conn: &Connection, record: TransferRecord) -> Result<()> {
        conn.execute(
            "INSERT INTO file_transfers (id, file_name, file_size, direction, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![
                record.id,
                record.file_name,
                record.file_size,
                record.direction,
                record.status,
                record.created_at
            ],
        )?;
        Ok(())
    }
}
