use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use std::path::Path;
use tauri::{AppHandle, Manager};

// 数据库连接状态管理
pub struct DbState {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(rename = "group")]
    pub group_name: String, // SQL中 group 是关键字，改个名
    pub description: Option<String>,
    pub tags: Option<Vec<String>>, // 存库时转为 JSON 字符串
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
    
    pub source: String, // 'local' | 'official'
    pub pack_id: Option<String>,
    pub original_id: Option<String>,
    
    pub type_: Option<String>, // 'command' | 'prompt'
    pub is_executable: bool,
    pub shell_type: Option<String>,
}

// 初始化数据库
pub fn init_db(app_handle: &AppHandle) -> Result<Connection> {
    let app_dir = app_handle.path().app_local_data_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).unwrap();
    }
    let db_path = app_dir.join("prompts.db");
    
    let conn = Connection::open(db_path)?;

    // 1. 创建主表
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

    // 2. 创建 FTS5 全文搜索虚拟表 (支持高效搜索)
    // content, title, description, tags, group_name 是需要搜索的字段
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
            id, title, content, description, tags, group_name, 
            tokenize = 'trigram'
        )",
        [],
    )?;

    // 3. 创建触发器：保持主表和搜索表同步
    // 插入时同步
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS prompts_ai AFTER INSERT ON prompts BEGIN
            INSERT INTO prompts_fts(id, title, content, description, tags, group_name)
            VALUES (new.id, new.title, new.content, new.description, new.tags, new.group_name);
        END;",
        [],
    )?;
    // 删除时同步
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS prompts_ad AFTER DELETE ON prompts BEGIN
            DELETE FROM prompts_fts WHERE id = old.id;
        END;",
        [],
    )?;
    // 更新时同步
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS prompts_au AFTER UPDATE ON prompts BEGIN
            DELETE FROM prompts_fts WHERE id = old.id;
            INSERT INTO prompts_fts(id, title, content, description, tags, group_name)
            VALUES (new.id, new.title, new.content, new.description, new.tags, new.group_name);
        END;",
        [],
    )?;

    Ok(conn)
}

// ================================= Commands =================================

#[tauri::command]
pub fn get_prompts(
    state: State<DbState>,
    page: u32,
    page_size: u32,
    group: String, // 'all', 'favorite', or specific group name
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

    query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");
    params.push(Box::new(page_size));
    params.push(Box::new(offset));

    // 由于 rusqlite params! 宏不支持动态 vector，这里手动构建
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    // 简单的参数绑定转换
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
            is_executable: row.get("is_executable")?,
            shell_type: row.get("shell_type")?,
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
) -> Result<Vec<Prompt>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let offset = (page - 1) * page_size;

    // 使用 FTS5 进行搜索
    // 这里的查询语法是 FTS5 标准，非常强大
    // 我们简单地对 query 进行一些处理，让它变成前缀搜索
    let fts_query = format!("\"{}\"*", query.replace("\"", "")); 

    let sql = "
        SELECT p.* 
        FROM prompts p
        JOIN prompts_fts fts ON p.id = fts.id
        WHERE prompts_fts MATCH ? 
        ORDER BY rank 
        LIMIT ? OFFSET ?
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let prompt_iter = stmt.query_map(params![fts_query, page_size, offset], |row| {
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
            is_executable: row.get("is_executable")?,
            shell_type: row.get("shell_type")?,
        })
    }).map_err(|e| e.to_string())?;

    let mut prompts = Vec::new();
    for p in prompt_iter {
        prompts.push(p.map_err(|e| e.to_string())?);
    }

    Ok(prompts)
}

// 批量导入指令包 (下载后调用)
#[tauri::command]
pub fn import_prompt_pack(
    state: State<DbState>,
    pack_id: String,
    prompts: Vec<Prompt>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // 开启事务
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 先删除旧的同包数据（如果是更新）
    tx.execute("DELETE FROM prompts WHERE pack_id = ?", params![pack_id])
        .map_err(|e| e.to_string())?;

    {
        let mut stmt = tx.prepare(
            "INSERT INTO prompts (
                id, title, content, group_name, description, tags, 
                is_favorite, created_at, updated_at, source, pack_id, 
                original_id, type, is_executable, shell_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).map_err(|e| e.to_string())?;

        for p in prompts {
            let tags_json = serde_json::to_string(&p.tags).unwrap_or("[]".to_string());
            stmt.execute(params![
                p.id, p.title, p.content, p.group_name, p.description, tags_json,
                p.is_favorite, p.created_at, p.updated_at, "official", pack_id,
                p.original_id, p.type_, p.is_executable, p.shell_type
            ]).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// 获取所有分组 (用于侧边栏)
#[tauri::command]
pub fn get_prompt_groups(state: State<DbState>) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT DISTINCT group_name FROM prompts ORDER BY group_name").map_err(|e| e.to_string())?;
    
    let groups = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>().map_err(|e| e.to_string())?;
        
    Ok(groups)
}

// 本地增删改 (对应以前 JS Store 的功能)
#[tauri::command]
pub fn save_prompt(state: State<DbState>, prompt: Prompt) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&prompt.tags).unwrap_or("[]".to_string());
    
    // 使用 REPLACE INTO，如果 ID 存在则更新，不存在则插入
    conn.execute(
        "INSERT OR REPLACE INTO prompts (
            id, title, content, group_name, description, tags, 
            is_favorite, created_at, updated_at, source, pack_id, 
            original_id, type, is_executable, shell_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            prompt.id, prompt.title, prompt.content, prompt.group_name, prompt.description, tags_json,
            prompt.is_favorite, prompt.created_at, prompt.updated_at, prompt.source, prompt.pack_id,
            prompt.original_id, prompt.type_, prompt.is_executable, prompt.shell_type
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_prompt(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM prompts WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_prompt_favorite(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    // 反转 boolean
    conn.execute("UPDATE prompts SET is_favorite = NOT is_favorite WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}