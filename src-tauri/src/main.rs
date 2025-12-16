#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

mod modules {
    pub mod screenshot;
}

use modules::screenshot::ScreenshotState;
use modules::screenshot::capture::{capture_screen, get_current_screenshot};

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
    cpu_usage: f64,           // 系统整体 CPU 使用率（所有核心的平均值）
    memory_usage: u64,       // 系统已用内存
    memory_total: u64,       // 系统总内存
    memory_available: u64,   // 系统可用内存
    uptime: u64,             // 系统运行时间（秒）
}

#[tauri::command]
fn get_system_info(
    system: State<'_, Arc<Mutex<System>>>,
) -> SystemInfo {
    let mut sys = system.lock().unwrap();
    
    // 刷新系统信息（CPU 使用率需要两次刷新才能准确计算）
    sys.refresh_cpu_all();
    sys.refresh_memory();
    
    // 获取系统整体 CPU 使用率（所有 CPU 核心的平均值）
    let cpu_usage = {
        let cpus = sys.cpus();
        if !cpus.is_empty() {
            let total_cpu: f64 = cpus.iter().map(|cpu| cpu.cpu_usage() as f64).sum();
            total_cpu / cpus.len() as f64
        } else {
            0.0
        }
    };
    
    // 获取系统整体内存信息
    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_available = sys.available_memory();
    
    // 系统运行时间（秒）
    let uptime = System::uptime();
    
    SystemInfo {
        cpu_usage,
        memory_usage: memory_used,
        memory_total,
        memory_available,
        uptime,
    }
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
        .invoke_handler(tauri::generate_handler![greet, get_file_size, get_system_info, capture_screen, get_current_screenshot])
        .setup(|app| {
            app.manage(ScreenshotState::default());
            // 初始化系统信息收集器
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
                            // 1. 如果窗口最小化了，先还原
                            if window.is_minimized().unwrap_or(false) {
                                let _ = window.unminimize();
                            }
                            // 这会强制将窗口带到最顶层
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