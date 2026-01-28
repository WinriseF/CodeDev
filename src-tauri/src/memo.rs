use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result};
use serde_json;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Memo {
    pub id: i32,
    pub content: String,
    pub tags: Vec<String>,
    pub resources: Vec<String>,
    pub is_archived: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateMemoRequest {
    pub content: String,
    pub resources: Vec<String>,
}

pub struct MemoService;

impl MemoService {
    pub fn get_all(conn: &Connection) -> Result<Vec<Memo>> {
        let mut stmt = conn.prepare(
            "SELECT id, content, tags, resources, is_archived, created_at, updated_at FROM memos ORDER BY created_at DESC"
        )?;

        let memo_iter = stmt.query_map([], |row| {
            Ok(Memo {
                id: row.get(0)?,
                content: row.get(1)?,
                tags: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default(),
                resources: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
                is_archived: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut memos = Vec::new();
        for memo in memo_iter {
            memos.push(memo?);
        }
        Ok(memos)
    }

    pub fn create(conn: &Connection, req: CreateMemoRequest) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let tags: Vec<String> = req.content
            .split_whitespace()
            .filter(|w| w.starts_with('#'))
            .map(|t| t.to_string())
            .collect();

        conn.execute(
            "INSERT INTO memos (content, tags, resources, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            params![
                req.content,
                serde_json::to_string(&tags).unwrap(),
                serde_json::to_string(&req.resources).unwrap(),
                now,
                now
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }
}
