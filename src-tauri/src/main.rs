#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::sync::{Arc, Mutex};
use sysinfo::{System, RefreshKind, CpuRefreshKind, MemoryRefreshKind};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

mod git;
mod export;
mod gitleaks;
mod db;
mod monitor;

// =================================================================
// 系统监控相关数据结构
// =================================================================

#[derive(serde::Serialize)]
struct SystemInfo {
    cpu_usage: f64,
    memory_usage: u64,
    memory_total: u64,
    memory_available: u64,
    uptime: u64,
}

// =================================================================
// 通用系统命令
// =================================================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_file_size(path: String) -> u64 {
    match fs::metadata(path) {
        Ok(meta) => meta.len(),
        Err(_) => 0,
    }
}

#[tauri::command]
fn get_system_info(
    system: State<'_, Arc<Mutex<System>>>,
) -> SystemInfo {
    let mut sys = system.lock().unwrap();
    
    // Sysinfo 0.37 修复: new() -> nothing()
    sys.refresh_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
            .with_memory(MemoryRefreshKind::nothing())
    );
    
    let cpu_usage = sys.global_cpu_usage() as f64;
    
    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_available = sys.available_memory();
    let uptime = System::uptime();
    
    SystemInfo {
        cpu_usage,
        memory_usage: memory_used,
        memory_total,
        memory_available,
        uptime,
    }
}

// =================================================================
// 导出命令
// =================================================================

#[tauri::command]
async fn scan_for_secrets(content: String) -> Vec<gitleaks::SecretMatch> {
    let matches = tauri::async_runtime::spawn_blocking(move || {
        gitleaks::scan_text(&content)
    }).await.unwrap_or_default();
    
    matches
}

#[tauri::command]
async fn export_git_diff(
    project_path: String,
    old_hash: String,
    new_hash: String,
    format: export::ExportFormat,
    layout: export::ExportLayout,
    save_path: String,
    selected_paths: Vec<String>,
) -> Result<(), String> {
    
    // 1. 复用 git 模块获取完整文件数据
    let all_files = git::get_git_diff(project_path, old_hash, new_hash)?;
    
    // 2. 根据前端传来的路径进行过滤
    let filtered_files: Vec<git::GitDiffFile> = all_files
        .into_iter()
        .filter(|f| selected_paths.contains(&f.path))
        .collect();

    if filtered_files.is_empty() {
        return Err("No files selected for export.".to_string());
    }

    // 3. 使用 export 模块生成格式化字符串
    let content = export::generate_export_content(filtered_files, format, layout);

    // 4. 写入文件
    fs::write(&save_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// =================================================================
// Main Entry
// =================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_file_size, 
            get_system_info,
            git::get_git_commits,
            git::get_git_diff,
            git::get_git_diff_text,
            export_git_diff,
            scan_for_secrets,
            db::get_prompts,
            db::search_prompts,
            db::import_prompt_pack,
            db::batch_import_local_prompts,
            db::get_prompt_groups,
            db::save_prompt,
            db::delete_prompt,
            db::toggle_prompt_favorite,
            monitor::get_system_metrics,
            monitor::get_top_processes,
            monitor::get_active_ports,
            monitor::kill_process,
            monitor::get_env_info,
            monitor::diagnose_network
        ])
        .setup(|app| {
            let system = System::new_all();
            app.manage(Arc::new(Mutex::new(system)));

            match db::init_db(app.handle()) {
                Ok(conn) => {
                    app.manage(db::DbState {
                        conn: Mutex::new(conn),
                    });
                    println!("[Database] SQLite initialized successfully.");
                }
                Err(e) => {
                    eprintln!("[Database] Initialization failed: {}", e);
                }
            }
            
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left, ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_minimized().unwrap_or(false) {
                                let _ = window.unminimize();
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api: _api, .. } => {
                let _label = window.label();
                #[cfg(not(dev))]
                if _label == "main" || _label == "spotlight" {
                    _api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}