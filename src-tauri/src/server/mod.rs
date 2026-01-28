use axum::{routing::{get, post}, Router, Json, extract::State};
use axum::response::Html;
use axum::extract::Multipart;
use tower_http::cors::CorsLayer;
use crate::memo::{Memo, CreateMemoRequest, MemoService};
use crate::files::FileService;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
use std::sync::Arc;

pub struct ServerState {
    pub db_path: std::path::PathBuf,
}

pub async fn start_web_server(port: u16, db_path: std::path::PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(ServerState { db_path });

    let app = Router::new()
        .route("/mobile", get(serve_mobile_page))
        .route("/api/memos", get(list_memos).post(create_memo))
        .route("/api/files/upload", post(handle_upload))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("Web server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn list_memos(State(state): State<Arc<ServerState>>) -> Json<Vec<Memo>> {
    match rusqlite::Connection::open(&state.db_path) {
        Ok(conn) => {
            match MemoService::get_all(&conn) {
                Ok(memos) => Json(memos),
                Err(_) => Json(vec![])
            }
        }
        Err(_) => Json(vec![])
    }
}

async fn serve_mobile_page() -> Html<String> {
    Html("<html><body>CodeForge Mobile Loading...</body></html>".into())
}

async fn create_memo(State(state): State<Arc<ServerState>>, Json(req): Json<CreateMemoRequest>) -> Json<serde_json::Value> {
    match rusqlite::Connection::open(&state.db_path) {
        Ok(conn) => {
            match MemoService::create(&conn, req) {
                Ok(id) => Json(serde_json::json!({ "status": "success", "id": id })),
                Err(e) => Json(serde_json::json!({ "status": "error", "message": e.to_string() }))
            }
        }
        Err(e) => Json(serde_json::json!({ "status": "error", "message": e.to_string() }))
    }
}

async fn handle_upload(State(state): State<Arc<ServerState>>, mut multipart: Multipart) -> Result<Json<serde_json::Value>, String> {
    let upload_dir = FileService::get_upload_dir().await;

    while let Some(field) = multipart.next_field().await.map_err(|e| e.to_string())? {
        let file_name = field.file_name().unwrap_or("unknown_file").to_string();
        let data = field.bytes().await.map_err(|e| e.to_string())?;
        let file_size = data.len() as u64;

        let file_id = Uuid::new_v4().to_string();
        let save_path = upload_dir.join(&file_name);

        let mut file = tokio::fs::File::create(&save_path).await.map_err(|e| e.to_string())?;
        file.write_all(&data).await.map_err(|e| e.to_string())?;

        // 保存传输记录到数据库
        if let Ok(conn) = rusqlite::Connection::open(&state.db_path) {
            let _ = conn.execute(
                "INSERT INTO file_transfers (id, file_name, file_size, direction, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                rusqlite::params![file_id, file_name, file_size, "phone_to_pc", "completed", chrono::Utc::now().timestamp()],
            );
        }

        println!("文件已保存至: {:?}", save_path);
    }

    Ok(Json(serde_json::json!({ "status": "success" })))
}
