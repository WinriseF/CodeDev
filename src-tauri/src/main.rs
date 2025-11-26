#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use tauri::{
    CustomMenuItem, GlobalShortcutManager, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, WindowEvent,
};

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

fn main() {
    // 1. 定义托盘菜单
    let quit = CustomMenuItem::new("quit".to_string(), "Quit CodeForge");
    let show = CustomMenuItem::new("show".to_string(), "Show Main Window");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .invoke_handler(tauri::generate_handler![greet, get_file_size])
        
        // 2. 托盘事件处理
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    if is_visible {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
                _ => {}
            },
            _ => {}
        })

        // 3. 窗口事件拦截
        .on_window_event(|event| match event.event() {
            WindowEvent::CloseRequested { api, .. } => {
                let label = event.window().label();
                // 只要是点击了窗口的关闭按钮（或Alt+F4），一律拦截并隐藏
                if label == "main" || label == "spotlight" {
                    api.prevent_close();
                    event.window().hide().unwrap();
                }
            }
            _ => {}
        })

        .setup(|app| {
            let app_handle = app.handle();
            
            #[cfg(desktop)]
            {
                let mut shortcut = app.global_shortcut_manager();
                // 快捷键
                let _ = shortcut.register("Alt+S", move || {
                    if let Some(window) = app_handle.get_window("spotlight") {
                        if window.is_visible().unwrap_or(false) {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}