use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::sync::Mutex;
use tauri::State;
use tauri::{AppHandle, Manager};
use regex::Regex;
use uuid::Uuid;

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

// --- Project Config for Project Memory Feature ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectConfig {
    pub dirs: Vec<String>,
    pub files: Vec<String>,
    pub extensions: Vec<String>,
}

// --- 新增：被忽略的敏感词结构 ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IgnoredSecret {
    pub id: String,
    pub value: String,
    pub rule_id: Option<String>,
    pub created_at: i64,
}

// --- Apps 表相关结构 ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppEntry {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub usage_count: i64,
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

    // Prompts FTS
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

    // URL History Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS url_history (
            url TEXT PRIMARY KEY,
            title TEXT,
            visit_count INTEGER DEFAULT 1,
            last_visit INTEGER
        )",
        [],
    )?;

    // Project Configs Table (for Project Memory Feature)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_configs (
            path TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            updated_at INTEGER
        )",
        [],
    )?;

    // --- 新增：创建 ignored_secrets 表 ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ignored_secrets (
            id TEXT PRIMARY KEY,
            value TEXT NOT NULL UNIQUE,
            rule_id TEXT,
            created_at INTEGER
        )",
        [],
    )?;

    // 创建索引以加速查询
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ignored_value ON ignored_secrets (value)", [])?;

    // --- 新增：创建 apps 表 ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS apps (
            path TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            keywords TEXT,
            icon TEXT,
            usage_count INTEGER DEFAULT 0,
            last_used_at INTEGER DEFAULT 0
        )",
        [],
    )?;

    // apps 索引
    conn.execute("CREATE INDEX IF NOT EXISTS idx_apps_name ON apps (name)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_apps_usage ON apps (usage_count DESC)", [])?;

    // URL History FTS
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS url_history_fts USING fts5(
            url, title,
            tokenize = 'unicode61 remove_diacritics 2'
        )",
        [],
    )?;

    // Re-create triggers
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
    let char_count = clean_query.chars().count();

    if clean_query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut sql = String::new();

    // If char count < 3, use LIKE query
    if char_count < 3 {
        // LIKE query
        let like_query = format!("%{}%", clean_query);
        params.push(Box::new(like_query));

        sql.push_str(
            "SELECT * FROM prompts
             WHERE (title LIKE ?1 OR content LIKE ?1 OR description LIKE ?1)"
        );
    } else {
        // If char count >= 3, use FTS5 Trigram index
        let parts: Vec<&str> = clean_query.split_whitespace().collect();
        let fts_query = parts.iter()
            .map(|part| format!("\"{}\"", part))
            .collect::<Vec<String>>()
            .join(" AND ");

        params.push(Box::new(fts_query));

        sql.push_str(
            "SELECT p.* FROM prompts p
             JOIN prompts_fts f ON p.id = f.id
             WHERE prompts_fts MATCH ?1"
        );
    }

    // Common filter conditions
    if let Some(cat) = category {
        if cat == "prompt" {
            sql.push_str(" AND (type = 'prompt' OR type IS NULL)");
        } else {
            sql.push_str(" AND type = ?2");
            params.push(Box::new(cat));
        }
        sql.push_str(" ORDER BY updated_at DESC LIMIT ?3 OFFSET ?4");
        params.push(Box::new(page_size));
        params.push(Box::new(offset));
    } else {
        sql.push_str(" ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3");
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

// NEW FEATURES: URL History Commands
#[tauri::command]
pub async fn record_url_visit(
    app_handle: AppHandle,
    state: State<'_, DbState>,
    url: String
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();
    
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO url_history (url, visit_count, last_visit, title)
             VALUES (?1, 1, ?2, '')
             ON CONFLICT(url) DO UPDATE SET
                visit_count = visit_count + 1,
                last_visit = ?2",
            params![url, now],
        ).map_err(|e| e.to_string())?;
    } 

    let url_clone = url.clone();
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(3))
            .build();

        if let Ok(c) = client {
            if let Ok(resp) = c.get(&url_clone)
                .header("Range", "bytes=0-16384") // Only request the first 16KB
                .send()
                .await
            {
                // A successful range request returns 206 Partial Content
                if resp.status().is_success() || resp.status() == reqwest::StatusCode::PARTIAL_CONTENT {
                    if let Ok(text) = resp.text().await {
                        if let Ok(re) = Regex::new(r"(?is)<title>(.*?)</title>") {
                            if let Some(caps) = re.captures(&text) {
                                if let Some(title_match) = caps.get(1) {
                                    let raw_title = title_match.as_str().trim();
                                    let clean_title = raw_title.replace('\n', " ").replace('\r', "").trim().to_string();

                                    if !clean_title.is_empty() {
                                        if let Ok(app_dir) = app_handle.path().app_local_data_dir() {
                                            let db_path = app_dir.join("prompts.db");
                                            if let Ok(conn) = Connection::open(db_path) {
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
    let char_count = clean_query.chars().count();

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

    let mut sql = String::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if char_count < 3 {
        let like_query = format!("%{}%", clean_query);
        params.push(Box::new(like_query));

        sql.push_str(
            "SELECT url, title, visit_count, last_visit
             FROM url_history
             WHERE (url LIKE ?1 OR title LIKE ?1)
             ORDER BY visit_count DESC, last_visit DESC
             LIMIT 5"
        );
    } else {
        let fts_query = format!("\"{}\"", clean_query);
        params.push(Box::new(fts_query));

        sql.push_str(
            "SELECT h.url, h.title, h.visit_count, h.last_visit
             FROM url_history h
             JOIN url_history_fts f ON h.url = f.url
             WHERE url_history_fts MATCH ?1
             ORDER BY h.visit_count DESC, h.last_visit DESC
             LIMIT 5"
        );
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
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


#[derive(serde::Serialize)]
pub struct PromptCounts {
    pub prompt: i64,
    pub command: i64,
}

#[tauri::command]
pub fn get_prompt_counts(state: State<DbState>) -> Result<PromptCounts, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // SQLite uses idx_prompts_type index for efficient scan
    let (command_count, prompt_count): (i64, i64) = conn.query_row(
        "SELECT
            COUNT(CASE WHEN type = 'command' THEN 1 END),
            COUNT(CASE WHEN type = 'prompt' OR type IS NULL THEN 1 END)
         FROM prompts",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap_or((0, 0));

    Ok(PromptCounts {
        prompt: prompt_count,
        command: command_count,
    })
}

// --- CSV Import/Export ---

/// CSV row structure for import/export (DTO)
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct PromptCsvRow {
    #[serde(default)]
    id: Option<String>,
    title: String,
    content: String,
    #[serde(rename = "group")]
    group_name: String,
    description: Option<String>,
    #[serde(default)]
    tags: String,
    #[serde(default)]
    is_favorite: bool,
    #[serde(rename = "type", default = "default_type")]
    type_: String,
    #[serde(default)]
    is_executable: bool,
    shell_type: Option<String>,
}

#[allow(dead_code)]
fn default_type() -> String {
    "prompt".to_string()
}

#[tauri::command]
#[allow(dead_code)]
pub fn export_prompts_to_csv(
    state: State<DbState>,
    save_path: String,
) -> Result<usize, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Create file and write BOM (for Excel compatibility)
    let mut file = File::create(&save_path).map_err(|e| e.to_string())?;
    file.write_all(b"\xEF\xBB\xBF").map_err(|e| e.to_string())?; // UTF-8 BOM

    // 2. Initialize CSV Writer with auto-flush
    let mut wtr = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(file);

    // 3. Stream data from database (row by row, no intermediate Vec)
    let mut stmt = conn
        .prepare("SELECT * FROM prompts ORDER BY group_name, title")
        .map_err(|e| e.to_string())?;

    let mut count = 0;
    let rows = stmt.query_map([], |row| {
        let tags_json: Option<String> = row.get("tags")?;
        let tags_vec: Vec<String> = tags_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        Ok(PromptCsvRow {
            id: Some(row.get("id")?),
            title: row.get("title")?,
            content: row.get("content")?,
            group_name: row.get("group_name")?,
            description: row.get("description")?,
            tags: tags_vec.join(", "),
            is_favorite: row.get("is_favorite")?,
            type_: row.get::<_, Option<String>>("type")?.unwrap_or("prompt".to_string()),
            is_executable: row.get("is_executable").unwrap_or(false),
            shell_type: row.get("shell_type").unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    for result in rows {
        let row = result.map_err(|e| e.to_string())?;
        wtr.serialize(row).map_err(|e| e.to_string())?;
        // Auto-flush every 100 rows to balance performance and memory
        if count % 100 == 0 {
            wtr.flush().map_err(|e| e.to_string())?;
        }
        count += 1;
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
#[allow(dead_code)]
pub fn import_prompts_from_csv(
    state: State<DbState>,
    file_path: String,
    mode: String,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Read CSV
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .trim(csv::Trim::All)
        .from_path(file_path)
        .map_err(|e| format!("无法读取 CSV 文件: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();

    // 2. Execute write in transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    if mode == "overwrite" {
        tx.execute("DELETE FROM prompts", []).map_err(|e| e.to_string())?;
    }

    // overwrite: INSERT OR REPLACE (存在则更新)
    // merge: INSERT OR IGNORE (存在则跳过)
    let sql = if mode == "overwrite" {
        "INSERT OR REPLACE INTO prompts (
            id, title, content, group_name, description, tags,
            is_favorite, created_at, updated_at, source, type,
            is_executable, shell_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    } else {
        "INSERT OR IGNORE INTO prompts (
            id, title, content, group_name, description, tags,
            is_favorite, created_at, updated_at, source, type,
            is_executable, shell_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    };

    let mut affected = 0;

    {
        let mut stmt = tx.prepare(sql).map_err(|e| e.to_string())?;

        for result in rdr.deserialize() {
            let record: PromptCsvRow =
                result.map_err(|e| format!("CSV 格式错误: {}", e))?;

            // Process ID: empty -> generate new UUID
            let id = if let Some(ref pid) = record.id {
                if pid.trim().is_empty() {
                    Uuid::new_v4().to_string()
                } else {
                    pid.clone()
                }
            } else {
                Uuid::new_v4().to_string()
            };

            // Process Tags: "tag1, tag2" -> ["tag1", "tag2"]
            let tags_vec: Vec<String> = record
                .tags
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            let tags_json = serde_json::to_string(&tags_vec).unwrap_or("[]".to_string());

            let group_name = if record.group_name.is_empty() {
                "Default".to_string()
            } else {
                record.group_name
            };

            let result = stmt.execute(params![
                id,
                record.title,
                record.content,
                group_name,
                record.description,
                tags_json,
                record.is_favorite,
                now,
                now,
                "local".to_string(),
                record.type_,
                record.is_executable,
                record.shell_type,
            ]);

            // INSERT OR IGNORE 返回变化行数为 0 时表示已存在
            if result.is_ok() {
                affected += 1;
            }
        }
    } // stmt 在这里被释放

    tx.commit().map_err(|e| e.to_string())?;

    Ok(affected)
}

// --- Project Memory Feature Commands ---

#[tauri::command]
pub fn get_project_config(
    state: State<DbState>,
    path: String,
) -> Result<Option<ProjectConfig>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT config FROM project_configs WHERE path = ?").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![path]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let config_json: String = row.get(0).map_err(|e| e.to_string())?;
        let config: ProjectConfig = serde_json::from_str(&config_json)
            .map_err(|e| format!("Config parse error: {}", e))?;
        Ok(Some(config))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_project_config(
    state: State<DbState>,
    path: String,
    config: ProjectConfig,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let config_json = serde_json::to_string(&config).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO project_configs (path, config, updated_at) VALUES (?1, ?2, ?3)",
        params![path, config_json, now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// --- Export/Import Project Configs ---

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectConfigExportItem {
    pub path: String,
    pub config: ProjectConfig,
    pub updated_at: i64,
}

#[tauri::command]
pub fn export_project_configs(
    state: State<DbState>,
    save_path: String,
) -> Result<usize, String> {
    use std::fs::File;
    use std::io::Write;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT path, config, updated_at FROM project_configs").map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let path: String = row.get(0)?;
        let config_str: String = row.get(1)?;
        let updated_at: i64 = row.get(2)?;

        let config: ProjectConfig = serde_json::from_str(&config_str)
            .unwrap_or(ProjectConfig { dirs: vec![], files: vec![], extensions: vec![] });

        Ok(ProjectConfigExportItem {
            path,
            config,
            updated_at,
        })
    }).map_err(|e| e.to_string())?;

    let mut export_list = Vec::new();
    for row in rows {
        export_list.push(row.map_err(|e| e.to_string())?);
    }

    let json_content = serde_json::to_string_pretty(&export_list).map_err(|e| e.to_string())?;

    let mut file = File::create(save_path).map_err(|e| e.to_string())?;
    file.write_all(json_content.as_bytes()).map_err(|e| e.to_string())?;

    Ok(export_list.len())
}

#[tauri::command]
pub fn import_project_configs(
    state: State<DbState>,
    file_path: String,
    mode: String,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let import_list: Vec<ProjectConfigExportItem> = serde_json::from_str(&content)
        .map_err(|e| format!("JSON format error: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    if mode == "overwrite" {
        tx.execute("DELETE FROM project_configs", []).map_err(|e| e.to_string())?;
    }

    let mut count = 0;
    {
        let mut stmt = tx.prepare(
            "INSERT OR REPLACE INTO project_configs (path, config, updated_at) VALUES (?1, ?2, ?3)"
        ).map_err(|e| e.to_string())?;

        for item in import_list {
            let config_json = serde_json::to_string(&item.config).unwrap_or("{}".to_string());

            stmt.execute(params![
                item.path,
                config_json,
                item.updated_at
            ]).map_err(|e| e.to_string())?;

            count += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

// --- 新增命令区域 ---

#[tauri::command]
pub fn add_ignored_secrets(
    state: State<DbState>,
    secrets: Vec<IgnoredSecret>,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut count = 0;

    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO ignored_secrets (id, value, rule_id, created_at) VALUES (?, ?, ?, ?)"
        ).map_err(|e| e.to_string())?;

        for s in secrets {
            let id = if s.id.is_empty() { Uuid::new_v4().to_string() } else { s.id };
            let now = chrono::Utc::now().timestamp_millis();
            stmt.execute(params![id, s.value, s.rule_id, now]).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn get_ignored_secrets(state: State<DbState>) -> Result<Vec<IgnoredSecret>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, value, rule_id, created_at FROM ignored_secrets ORDER BY created_at DESC").map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(IgnoredSecret {
            id: row.get(0)?,
            value: row.get(1)?,
            rule_id: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
pub fn delete_ignored_secret(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ignored_secrets WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// 内部帮助函数：获取所有白名单值（用于扫描过滤）
pub fn get_all_ignored_values_internal(conn: &Connection) -> Result<std::collections::HashSet<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT value FROM ignored_secrets")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

    let mut set = std::collections::HashSet::new();
    for r in rows {
        if let Ok(val) = r {
            set.insert(val);
        }
    }
    Ok(set)
}

// --- Apps 相关命令 ---

#[tauri::command]
pub fn search_apps_in_db(state: State<DbState>, query: String) -> Result<Vec<AppEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let clean_query = format!("%{}%", query.trim());

    let mut stmt = conn.prepare(
        "SELECT name, path, icon, usage_count
         FROM apps
         WHERE name LIKE ?1 OR keywords LIKE ?1
         ORDER BY usage_count DESC, name ASC
         LIMIT 10"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![clean_query], |row| {
        Ok(AppEntry {
            name: row.get(0)?,
            path: row.get(1)?,
            icon: row.get(2)?,
            usage_count: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
pub fn record_app_usage(state: State<DbState>, path: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE apps SET usage_count = usage_count + 1, last_used_at = ?1 WHERE path = ?2",
        params![now, path],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// 智能同步 Apps (核心逻辑)
// 传入的是扫描到的最新列表，此函数负责对比差异并更新 DB
pub fn sync_scanned_apps(conn: &Connection, scanned_apps: Vec<AppEntry>) -> Result<usize> {
    let tx = conn.unchecked_transaction()?;

    // 1. 获取数据库中已有的所有路径
    let mut existing_paths = std::collections::HashSet::new();
    {
        let mut stmt = tx.prepare("SELECT path FROM apps")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        for r in rows {
            existing_paths.insert(r?);
        }
    }

    // 2. 准备新扫描到的路径集合
    let mut scanned_paths = std::collections::HashSet::new();
    let mut new_entries = Vec::new();

    for app in &scanned_apps {
        scanned_paths.insert(app.path.clone());
        if !existing_paths.contains(&app.path) {
            new_entries.push(app);
        }
    }

    // 3. 删除：数据库中有，但扫描列表里没有的
    if !scanned_apps.is_empty() {
        for old_path in existing_paths {
            if !scanned_paths.contains(&old_path) {
                tx.execute("DELETE FROM apps WHERE path = ?", params![old_path])?;
            }
        }
    }

    // 4. 新增：插入新发现的应用
    {
        let mut stmt = tx.prepare(
            "INSERT INTO apps (path, name, icon, usage_count) VALUES (?, ?, ?, 0)"
        )?;
        for app in new_entries {
            stmt.execute(params![app.path, app.name, app.icon])?;
        }
    }

    tx.commit()?;
    Ok(scanned_apps.len())
}