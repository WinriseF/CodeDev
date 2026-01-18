#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::process::Command;
use std::sync::{Arc, Mutex};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use sysinfo::{System, RefreshKind, CpuRefreshKind, MemoryRefreshKind};
#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::CREATE_NO_WINDOW;
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
mod env_probe;
mod apps;

#[derive(serde::Serialize)]
struct SystemInfo {
    cpu_usage: f64,
    memory_usage: u64,
    memory_total: u64,
    memory_available: u64,
    uptime: u64,
}

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

#[tauri::command]
async fn check_python_env() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        let bin = "python";
        #[cfg(not(target_os = "windows"))]
        let bin = "python3";

        let mut cmd = Command::new(bin);
        cmd.arg("--version");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW.0);
        let output = cmd.output().map_err(|_| "Not Found".to_string())?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if version.is_empty() {
                Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
            } else {
                Ok(version)
            }
        } else {
            Err("Not Installed".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn scan_for_secrets(
    state: State<'_, db::DbState>,
    content: String
) -> Result<Vec<gitleaks::SecretMatch>, String> {
    // 1. 先从数据库获取白名单 (在主线程/异步线程做，避免阻塞 rayon 线程池)
    let ignored_set = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        db::get_all_ignored_values_internal(&conn).map_err(|e| e.to_string())?
    };

    // 2. 执行扫描 (CPU 密集型，放入 blocking 线程)
    let matches = tauri::async_runtime::spawn_blocking(move || {
        let raw_matches = gitleaks::scan_text(&content);

        // 3. 内存过滤：移除在白名单中的项
        if ignored_set.is_empty() {
            raw_matches
        } else {
            raw_matches.into_iter()
                .filter(|m| !ignored_set.contains(&m.value))
                .collect()
        }
    }).await.map_err(|e| e.to_string())?;

    Ok(matches)
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
    
    let all_files = git::get_git_diff(project_path, old_hash, new_hash)?;
    
    let filtered_files: Vec<git::GitDiffFile> = all_files
        .into_iter()
        .filter(|f| selected_paths.contains(&f.path))
        .collect();

    if filtered_files.is_empty() {
        return Err("No files selected for export.".to_string());
    }

    let content = export::generate_export_content(filtered_files, format, layout);

    fs::write(&save_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

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
            check_python_env,
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
            db::record_url_visit,
            db::search_url_history,
            db::get_prompt_counts,
            db::export_prompts_to_csv,
            db::import_prompts_from_csv,
            db::get_project_config,
            db::save_project_config,
            db::export_project_configs,
            db::import_project_configs,
            // --- 新注册的命令 ---
            db::add_ignored_secrets,
            db::get_ignored_secrets,
            db::delete_ignored_secret,
            // --- Apps 相关命令 ---
            db::search_apps_in_db,
            apps::refresh_apps,
            apps::open_app,
            // -------------------
            monitor::get_system_metrics,
            monitor::get_top_processes,
            monitor::get_active_ports,
            monitor::kill_process,
            monitor::check_file_locks,
            monitor::get_env_info,
            monitor::diagnose_network,
            monitor::get_ai_context
        ])
        .setup(|app| {
            let system = System::new();
            app.manage(Arc::new(Mutex::new(system)));

            match db::init_db(app.handle()) {
                Ok(conn) => {
                    app.manage(db::DbState {
                        conn: Mutex::new(conn),
                    });
                    println!("[Database] SQLite initialized successfully.");
                }
                Err(e) => {
                    // DB 初始化失败时直接 panic，避免运行时隐性崩溃
                    panic!("[Database] Critical Error: Failed to initialize database: {}", e);
                }
            }
            
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(if let Some(icon) = app.default_window_icon() {
                    icon.clone()
                } else {
                    return Err(Box::new(std::io::Error::new(std::io::ErrorKind::NotFound, "No default icon found")));
                })
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