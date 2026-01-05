use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use tauri::{AppHandle, Manager};
use regex::Regex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(rename = "group")]
    pub group_name: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub source: String,
    pub pack_id: Option<String>,
    pub original_id: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    pub is_executable: Option<bool>,
    pub shell_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UrlHistoryItem {
    pub url: String,
    pub title: Option<String>,
    pub visit_count: i64,
    pub last_visit: i64,
}

pub fn init_db(app_handle: &AppHandle) -> Result<Connection> {
    let app_dir = app_handle.path().app_local_data_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).unwrap();
    }
    let db_path = app_dir.join("prompts.db");

    let conn = Connection::open(db_path)?;

    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
    ")?;

    // --- Prompts Table ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            group_name TEXT NOT NULL,
            description TEXT,
            tags TEXT,
            is_favorite INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER,
            source TEXT DEFAULT 'local',
            pack_id TEXT,
            original_id TEXT,
            type TEXT,
            is_executable INTEGER DEFAULT 0,
            shell_type TEXT
        )",
        [],
    )?;

    // Migrations for Prompts
    let _ = conn.execute("ALTER TABLE prompts ADD COLUMN is_executable INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE prompts ADD COLUMN shell_type TEXT", []);

    // --- Prompts FTS ---
    conn.execute_batch("
        DROP TRIGGER IF EXISTS prompts_ai;
        DROP TRIGGER IF EXISTS prompts_ad;
        DROP TRIGGER IF EXISTS prompts_au;
        DROP TABLE IF EXISTS prompts_fts;
    ")?;
    conn.execute(
        "CREATE VIRTUAL TABLE prompts_fts USING fts5(
            id, title, content, description, tags, group_name,
            tokenize = 'unicode61 remove_diacritics 2'
        )",
        [],
    )?;
    conn.execute(
        "INSERT INTO prompts_fts(id, title, content, description, tags, group_name)
         SELECT id, title, content, description, tags, group_name FROM prompts",
        [],
    )?;

    conn.execute(
        "CREATE TRIGGER prompts_ai AFTER INSERT ON prompts BEGIN
            INSERT INTO prompts_fts(id, title, content, description, tags, group_name)
            VALUES (new.id, new.title, new.content, new.description, new.tags, new.group_name);
        END;",
        [],
    )?;
    conn.execute(
        "CREATE TRIGGER prompts_ad AFTER DELETE ON prompts BEGIN
            DELETE FROM prompts_fts WHERE id = old.id;
        END;",
        [],
    )?;
    conn.execute(
        "CREATE TRIGGER prompts_au AFTER UPDATE ON prompts BEGIN
            DELETE FROM prompts_fts WHERE id = old.id;
            INSERT INTO prompts_fts(id, title, content, description, tags, group_name)
            VALUES (new.id, new.title, new.content, new.description, new.tags, new.group_name);
        END;",
        [],
    )?;

    conn.execute("CREATE INDEX IF NOT EXISTS idx_prompts_group_created ON prompts (group_name, created_at DESC)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts (type)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts (is_favorite)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prompts_pack_id ON prompts (pack_id)", [])?;

    // --- URL History Table (New Feature) ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS url_history (
            url TEXT PRIMARY KEY,
            title TEXT,
            visit_count INTEGER DEFAULT 1,
            last_visit INTEGER
        )",
        [],
    )?;

    // --- URL History FTS ---
    // Creating FTS table for URL history to enable fuzzy search on URL and Title
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS url_history_fts USING fts5(
            url, title,
            tokenize = 'unicode61 remove_diacritics 2'
        )",
        [],
    )?;

    // Re-create triggers to ensure FTS consistency
    conn.execute_batch("
        DROP TRIGGER IF EXISTS url_history_ai;
        DROP TRIGGER IF EXISTS url_history_ad;
        DROP TRIGGER IF EXISTS url_history_au;

        CREATE TRIGGER url_history_ai AFTER INSERT ON url_history BEGIN
            INSERT INTO url_history_fts(url, title) VALUES (new.url, new.title);
        END;
        CREATE TRIGGER url_history_ad AFTER DELETE ON url_history BEGIN
            DELETE FROM url_history_fts WHERE url = old.url;
        END;
        CREATE TRIGGER url_history_au AFTER UPDATE ON url_history BEGIN
            DELETE FROM url_history_fts WHERE url = old.url;
            INSERT INTO url_history_fts(url, title) VALUES (new.url, new.title);
        END;
    ")?;

    Ok(conn)
}

#[tauri::command]
pub fn get_prompts(
    state: State<DbState>,
    page: u32,
    page_size: u32,
    group: String,
    category: Option<String>,
) -> Result<Vec<Prompt>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let offset = (page - 1) * page_size;

    let mut query = String::from("SELECT * FROM prompts WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if group == "favorite" {
        query.push_str(" AND is_favorite = 1");
    } else if group != "all" {
        query.push_str(" AND group_name = ?");
        params.push(Box::new(group));
    }

    if let Some(cat) = category {
        if cat == "prompt" {
            query.push_str(" AND (type = 'prompt' OR type IS NULL)");
        } else {
            query.push_str(" AND type = ?");
            params.push(Box::new(cat));
        }
    }

    query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");
    params.push(Box::new(page_size));
    params.push(Box::new(offset));

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let prompt_iter = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(Prompt {
            id: row.get("id")?,
            title: row.get("title")?,
            content: row.get("content")?,
            group_name: row.get("group_name")?,
            description: row.get("description")?,
            tags: row.get::<_, Option<String>>("tags")?.map(|s| serde_json::from_str(&s).unwrap_or_default()),
            is_favorite: row.get("is_favorite")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            source: row.get("source")?,
            pack_id: row.get("pack_id")?,
            original_id: row.get("original_id")?,
            type_: row.get("type")?,
            is_executable: row.get("is_executable").unwrap_or(Some(false)),
            shell_type: row.get("shell_type").unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    let mut prompts = Vec::new();
    for p in prompt_iter {
        prompts.push(p.map_err(|e| e.to_string())?);
    }
    Ok(prompts)
}

#[tauri::command]
pub fn search_prompts(
    state: State<DbState>,
    query: String,
    page: u32,
    page_size: u32,
    category: Option<String>,
) -> Result<Vec<Prompt>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let offset = (page - 1) * page_size;
    
    let clean_query = query.replace("\"", ""); 
    let parts: Vec<&str> = clean_query.split_whitespace().collect();
    
    if parts.is_empty() {
        return Ok(Vec::new());
    }

    let fts_query = parts.iter()
        .map(|part| format!("\"{}\"*", part))
        .collect::<Vec<String>>()
        .join(" ");

    let mut sql = String::from(
        "SELECT p.* FROM prompts p
         JOIN prompts_fts f ON p.id = f.id
         WHERE prompts_fts MATCH ?1"
    );
    
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    params.push(Box::new(fts_query)); 

    if let Some(cat) = category {
        if cat == "prompt" {
            sql.push_str(" AND (p.type = 'prompt' OR p.type IS NULL)");
        } else {
            sql.push_str(" AND p.type = ?2");
            params.push(Box::new(cat));
        }
        sql.push_str(" ORDER BY p.updated_at DESC LIMIT ?3 OFFSET ?4");
        params.push(Box::new(page_size));
        params.push(Box::new(offset));
    } else {
        sql.push_str(" ORDER BY p.updated_at DESC LIMIT ?2 OFFSET ?3");
        params.push(Box::new(page_size));
        params.push(Box::new(offset));
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let prompt_iter = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(Prompt {
            id: row.get("id")?,
            title: row.get("title")?,
            content: row.get("content")?,
            group_name: row.get("group_name")?,
            description: row.get("description")?,
            tags: row.get::<_, Option<String>>("tags")?.map(|s| serde_json::from_str(&s).unwrap_or_default()),
            is_favorite: row.get("is_favorite")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            source: row.get("source")?,
            pack_id: row.get("pack_id")?,
            original_id: row.get("original_id")?,
            type_: row.get("type")?,
            is_executable: row.get("is_executable").unwrap_or(Some(false)),
            shell_type: row.get("shell_type").unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    let mut prompts = Vec::new();
    for p in prompt_iter {
        prompts.push(p.map_err(|e| e.to_string())?);
    }

    Ok(prompts)
}

#[tauri::command]
pub fn save_prompt(
    state: State<DbState>,
    prompt: Prompt
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&prompt.tags).unwrap_or("[]".to_string());

    conn.execute(
        "INSERT OR REPLACE INTO prompts (
            id, title, content, group_name, description, tags,
            is_favorite, created_at, updated_at, source, pack_id, original_id, type,
            is_executable, shell_type
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            prompt.id, 
            prompt.title, 
            prompt.content, 
            prompt.group_name, 
            prompt.description, 
            tags_json,
            prompt.is_favorite, 
            prompt.created_at, 
            prompt.updated_at, 
            prompt.source,
            prompt.pack_id, 
            prompt.original_id, 
            prompt.type_,
            prompt.is_executable,
            prompt.shell_type
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_prompt(
    state: State<DbState>,
    id: String
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM prompts WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_prompt_favorite(
    state: State<DbState>,
    id: String
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE prompts SET is_favorite = NOT is_favorite WHERE id = ?", 
        params![id]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_prompt_pack(
    state: State<DbState>,
    pack_id: String,
    prompts: Vec<Prompt>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM prompts WHERE pack_id = ?", params![pack_id])
        .map_err(|e| e.to_string())?;

    {
        let mut stmt = tx.prepare(
            "INSERT OR REPLACE INTO prompts (
                id, title, content, group_name, description, tags,
                is_favorite, created_at, updated_at, source, pack_id, original_id, type,
                is_executable, shell_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).map_err(|e| e.to_string())?;

        for p in prompts {
            let tags_json = serde_json::to_string(&p.tags).unwrap_or("[]".to_string());
            stmt.execute(params![
                p.id, p.title, p.content, p.group_name, p.description, tags_json,
                p.is_favorite, p.created_at, p.updated_at, p.source, pack_id.clone(), p.original_id, p.type_,
                p.is_executable, p.shell_type
            ]).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn batch_import_local_prompts(
    state: State<DbState>,
    prompts: Vec<Prompt>,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut count = 0;

    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO prompts (
                id, title, content, group_name, description, tags,
                is_favorite, created_at, updated_at, source, pack_id, original_id, type,
                is_executable, shell_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).map_err(|e| e.to_string())?;

        for p in prompts {
            let tags_json = serde_json::to_string(&p.tags).unwrap_or("[]".to_string());
            stmt.execute(params![
                p.id, p.title, p.content, p.group_name, p.description, tags_json,
                p.is_favorite, p.created_at, p.updated_at, p.source, p.pack_id, p.original_id, p.type_,
                p.is_executable, p.shell_type
            ]).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn get_prompt_groups(state: State<DbState>) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT DISTINCT group_name FROM prompts ORDER BY group_name").map_err(|e| e.to_string())?;
    let groups = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>().map_err(|e| e.to_string())?;
    Ok(groups)
}

// -------------------------------------------------------------------------
// NEW FEATURES: URL History Commands
// -------------------------------------------------------------------------

#[tauri::command]
pub async fn record_url_visit(
    app_handle: AppHandle,
    state: State<'_, DbState>,
    url: String
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();
    
    // 1. Immediately update DB with visit (Optimistic UI update)
    // We insert a blank title initially if it doesn't exist.
    // If it exists, we preserve the title (DO NOT overwrite with empty string).
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        
        // We use ON CONFLICT(url) DO UPDATE SET visit_count...
        // For title, we use coalesce to keep existing title if present.
        conn.execute(
            "INSERT INTO url_history (url, visit_count, last_visit, title)
             VALUES (?1, 1, ?2, '')
             ON CONFLICT(url) DO UPDATE SET
                visit_count = visit_count + 1,
                last_visit = ?2",
            params![url, now],
        ).map_err(|e| e.to_string())?;
    } 

    // 2. Spawn async task to fetch title if it's missing or empty
    let url_clone = url.clone();
    tauri::async_runtime::spawn(async move {
        // Construct a client to fetch the page
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(3)) // Short timeout to avoid hanging
            .build();

        if let Ok(c) = client {
            // Attempt to fetch URL
            if let Ok(resp) = c.get(&url_clone).send().await {
                // Only process if status is OK
                if resp.status().is_success() {
                    // Stream text (limit to first 10KB to find title quickly and save bandwidth)
                    // Simplified: just get text() which reads whole body, usually fine for HTML pages.
                    // Ideally, we'd use a streaming parser or range header, but this is sufficient.
                    if let Ok(text) = resp.text().await {
                        // Regex to extract <title>...</title>
                        // (?is) enables dot-matches-newline and case-insensitive
                        if let Ok(re) = Regex::new(r"(?is)<title>(.*?)</title>") {
                            if let Some(caps) = re.captures(&text) {
                                if let Some(title_match) = caps.get(1) {
                                    let raw_title = title_match.as_str().trim();
                                    // Decode HTML entities if necessary (skipped for simplicity, usually browser handles display)
                                    // Simple cleanup: replace newlines with space
                                    let clean_title = raw_title.replace('\n', " ").replace('\r', "").trim().to_string();

                                    if !clean_title.is_empty() {
                                        // Re-open DB connection locally in this thread (avoid passing Mutex across await)
                                        if let Ok(app_dir) = app_handle.path().app_local_data_dir() {
                                            let db_path = app_dir.join("prompts.db");
                                            if let Ok(conn) = Connection::open(db_path) {
                                                // Only update if title is currently empty/null or we want to refresh it
                                                let _ = conn.execute(
                                                    "UPDATE url_history SET title = ?1 WHERE url = ?2 AND (title IS NULL OR title = '')",
                                                    params![clean_title, url_clone],
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn search_url_history(
    state: State<DbState>,
    query: String
) -> Result<Vec<UrlHistoryItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let clean_query = query.replace("\"", "");
    
    // Case 1: Empty query -> Return recently visited
    if clean_query.trim().is_empty() {
        let mut stmt = conn.prepare(
            "SELECT url, title, visit_count, last_visit FROM url_history 
             ORDER BY last_visit DESC LIMIT 10"
        ).map_err(|e| e.to_string())?;
        
        let rows = stmt.query_map([], |row| {
            Ok(UrlHistoryItem {
                url: row.get("url")?,
                title: row.get("title")?,
                visit_count: row.get("visit_count")?,
                last_visit: row.get("last_visit")?,
            })
        }).map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r.map_err(|e| e.to_string())?);
        }
        return Ok(results);
    }

    // Case 2: Full Text Search using FTS5
    // We append '*' to perform a prefix search on tokens
    let fts_query = format!("\"{}\"*", clean_query);

    let mut stmt = conn.prepare(
        "SELECT h.url, h.title, h.visit_count, h.last_visit 
         FROM url_history h
         JOIN url_history_fts f ON h.url = f.url
         WHERE url_history_fts MATCH ?1
         ORDER BY h.visit_count DESC, h.last_visit DESC
         LIMIT 5"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![fts_query], |row| {
        Ok(UrlHistoryItem {
            url: row.get("url")?,
            title: row.get("title")?,
            visit_count: row.get("visit_count")?,
            last_visit: row.get("last_visit")?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }

    Ok(results)
}