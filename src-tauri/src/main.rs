// ----------------- src-tauri/src/main.rs -----------------

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::process::Command; // <-- 新增: 用于执行外部命令
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

// =================================================================
// 1. 新增用于和前端交互的数据结构
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
  status: String, // "Added", "Modified", "Deleted", "Renamed"
  old_path: Option<String>, // For renames
  original_content: String,
  modified_content: String,
}
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
// 2. 新增的 Tauri 命令
// =================================================================
#[tauri::command]
fn get_git_commits(project_path: String) -> Result<Vec<GitCommit>, String> {
    let output = Command::new("git")
        .arg("log")
        .arg("--pretty=format:%H|%an|%ar|%s") // 使用 | 分隔，便于解析
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
    // 1. 获取变更文件列表
    let diff_output = Command::new("git")
        .arg("diff")
        .arg("--name-status")
        .arg(&old_hash)
        .arg(&new_hash)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    if !diff_output.status.success() {
        return Err(String::from_utf8_lossy(&diff_output.stderr).to_string());
    }

    let diff_summary = String::from_utf8_lossy(&diff_output.stdout);
    let mut diff_files = Vec::new();

    // 2. 遍历列表，获取每个文件的内容
    for line in diff_summary.lines() {
        if line.is_empty() { continue; }
        let parts: Vec<&str> = line.split('\t').collect();
        let status_char = parts[0];
        
        let (status, path, old_path) = match status_char {
            "A" => ("Added", parts[1].to_string(), None),
            "M" => ("Modified", parts[1].to_string(), None),
            "D" => ("Deleted", parts[1].to_string(), None),
            s if s.starts_with('R') => ("Renamed", parts[2].to_string(), Some(parts[1].to_string())),
            _ => continue,
        };

        // 辅助函数：获取文件在特定 commit 的内容
        let get_content = |hash: &str, file_path: &str| -> String {
            if hash.is_empty() || file_path.is_empty() { return "".to_string(); }
            let content_output = Command::new("git")
                .arg("show")
                .arg(format!("{}:{}", hash, file_path))
                .current_dir(&project_path)
                .output();
            
            match content_output {
                Ok(output) if output.status.success() => {
                    String::from_utf8_lossy(&output.stdout).to_string()
                }
                _ => "".to_string(), // 如果文件不存在或出错，返回空字符串
            }
        };

        let (original_content, modified_content) = match status {
            "Added" => ("".to_string(), get_content(&new_hash, &path)),
            "Deleted" => (get_content(&old_hash, &path), "".to_string()),
            "Modified" => (get_content(&old_hash, &path), get_content(&new_hash, &path)),
            "Renamed" => (get_content(&old_hash, old_path.as_ref().unwrap()), get_content(&new_hash, &path)),
            _ => ("".to_string(), "".to_string()),
        };

        diff_files.push(GitDiffFile {
            path: path.clone(),
            status: status.to_string(),
            old_path,
            original_content,
            modified_content,
        });
    }

    Ok(diff_files)
}

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
        // =================================================================
        // 3. 注册新的 Tauri 命令
        // =================================================================
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_file_size, 
            get_system_info,
            get_git_commits,
            get_git_diff
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