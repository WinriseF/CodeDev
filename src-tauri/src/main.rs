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
mod context;
mod hyperview;

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
        db::secrets::get_all_ignored_values_internal(&conn).map_err(|e| e.to_string())?
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
        .register_uri_scheme_protocol("preview", hyperview::protocol::preview_protocol_handler)
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
            db::prompts::get_prompts,
            db::prompts::search_prompts,
            db::prompts::import_prompt_pack,
            db::prompts::batch_import_local_prompts,
            db::prompts::get_prompt_groups,
            db::prompts::save_prompt,
            db::prompts::delete_prompt,
            db::prompts::toggle_prompt_favorite,
            db::prompts::get_prompt_counts,
            db::prompts::export_prompts_to_csv,
            db::prompts::import_prompts_from_csv,
            db::prompts::get_chat_templates,
            db::url_history::record_url_visit,
            db::url_history::search_url_history,
            db::project_config::get_project_config,
            db::project_config::save_project_config,
            db::project_config::export_project_configs,
            db::project_config::import_project_configs,
            db::secrets::add_ignored_secrets,
            db::secrets::get_ignored_secrets,
            db::secrets::delete_ignored_secret,
            db::apps::search_apps_in_db,
            apps::refresh_apps,
            apps::open_app,
            db::shell_history::record_shell_command,
            db::shell_history::get_recent_shell_history,
            db::shell_history::search_shell_history,
            monitor::get_system_metrics,
            monitor::get_top_processes,
            monitor::get_active_ports,
            monitor::kill_process,
            monitor::check_file_locks,
            monitor::get_env_info,
            monitor::diagnose_network,
            monitor::get_ai_context,
            context::commands::calculate_context_stats,
            context::commands::get_context_content,
            context::commands::copy_context_to_clipboard,
            context::commands::save_context_to_file,
            hyperview::get_file_meta,
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