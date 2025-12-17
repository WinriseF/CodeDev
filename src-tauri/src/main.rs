#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::process::Command;
use std::path::Path;
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

// =================================================================
// 用于和前端交互的数据结构
// =================================================================
#[derive(serde::Serialize, Clone)]
struct GitCommit {
  hash: String,
  author: String,
  date: String,
  message: String,
}

#[derive(serde::Serialize, Clone)]
struct GitDiffFile {
  path: String,
  status: String,
  old_path: Option<String>,
  original_content: String,
  modified_content: String,
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

#[derive(serde::Serialize)]
struct SystemInfo {
    cpu_usage: f64,
    memory_usage: u64,
    memory_total: u64,
    memory_available: u64,
    uptime: u64,
}

#[tauri::command]
fn get_system_info(
    system: State<'_, Arc<Mutex<System>>>,
) -> SystemInfo {
    let mut sys = system.lock().unwrap();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    
    let cpu_usage = {
        let cpus = sys.cpus();
        if !cpus.is_empty() {
            let total_cpu: f64 = cpus.iter().map(|cpu| cpu.cpu_usage() as f64).sum();
            total_cpu / cpus.len() as f64
        } else {
            0.0
        }
    };
    
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
// Tauri 命令
// =================================================================
#[tauri::command]
fn get_git_commits(project_path: String) -> Result<Vec<GitCommit>, String> {
    let output = Command::new("git")
        .arg("log")
        .arg("--pretty=format:%H|%an|%ar|%s")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits = stdout.lines().filter(|line| !line.is_empty()).map(|line| {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        GitCommit {
            hash: parts.get(0).unwrap_or(&"").to_string(),
            author: parts.get(1).unwrap_or(&"").to_string(),
            date: parts.get(2).unwrap_or(&"").to_string(),
            message: parts.get(3).unwrap_or(&"").to_string(),
        }
    }).collect();

    Ok(commits)
}

#[tauri::command]
fn get_git_diff(project_path: String, old_hash: String, new_hash: String) -> Result<Vec<GitDiffFile>, String> {
    // 只执行一次 git diff --patch 命令
    let output = Command::new("git")
        .arg("diff")
        .arg("--patch")
        .arg("--no-color")
        .arg(&old_hash)
        .arg(&new_hash)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let diff_text = String::from_utf8_lossy(&output.stdout);
    let mut files: Vec<GitDiffFile> = Vec::new();

    // 在 Rust 端解析 diff 输出
    let mut current_file: Option<GitDiffFile> = None;

    for line in diff_text.lines() {
        if line.starts_with("diff --git a/") {
            // 当遇到新的文件 diff 时，保存上一个文件并开始新的
            if let Some(file) = current_file.take() {
                files.push(file);
            }
            
            // 解析文件名
            let parts: Vec<&str> = line.split_whitespace().collect();
            let path = Path::new(parts[3].strip_prefix("b/").unwrap_or(parts[3]))
                .to_string_lossy()
                .to_string();

            current_file = Some(GitDiffFile {
                path,
                status: "Modified".to_string(), // 默认为 Modified
                old_path: None,
                original_content: String::new(),
                modified_content: String::new(),
            });
        } else if let Some(file) = &mut current_file {
            if line.starts_with("new file mode") {
                file.status = "Added".to_string();
            } else if line.starts_with("deleted file mode") {
                file.status = "Deleted".to_string();
            } else if line.starts_with("--- a/") {
                // '--- /dev/null' 表示是新文件
                if line.ends_with("/dev/null") {
                    file.status = "Added".to_string();
                }
            } else if line.starts_with("+++ b/") {
                // '+++ /dev/null' 表示是删除文件
                 if line.ends_with("/dev/null") {
                    file.status = "Deleted".to_string();
                }
            } else if line.starts_with('+') && !line.starts_with("+++") {
                file.modified_content.push_str(&line[1..]);
                file.modified_content.push('\n');
            } else if line.starts_with('-') && !line.starts_with("---") {
                file.original_content.push_str(&line[1..]);
                file.original_content.push('\n');
            } else if line.starts_with(' ') {
                file.original_content.push_str(&line[1..]);
                file.original_content.push('\n');
                file.modified_content.push_str(&line[1..]);
                file.modified_content.push('\n');
            }
        }
    }
    
    if let Some(file) = current_file.take() {
        files.push(file);
    }

    Ok(files)
}

#[tauri::command]
fn get_git_diff_text(project_path: String, old_hash: String, new_hash: String) -> Result<String, String> {
    let output = Command::new("git")
        .arg("diff")
        .arg("--patch")
        .arg("--no-color")
        .arg(&old_hash)
        .arg(&new_hash)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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
        // =================================================================
        // 注册 Tauri 命令
        // =================================================================
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_file_size, 
            get_system_info,
            get_git_commits,
            get_git_diff,
            get_git_diff_text
        ])
        // =================================================================
        .setup(|app| {
            let mut system = System::new();
            system.refresh_all();
            app.manage(Arc::new(Mutex::new(system)));
            
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
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
            WindowEvent::CloseRequested { api, .. } => {
                let label = window.label();
                if label == "main" || label == "spotlight" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}