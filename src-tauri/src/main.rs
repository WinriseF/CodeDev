#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;

// 原有的示例命令
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ✨ 新增：获取文件大小的命令
// Rust 读取 Metadata 非常快，几乎不消耗性能
#[tauri::command]
fn get_file_size(path: String) -> u64 {
    match fs::metadata(path) {
        Ok(meta) => meta.len(),
        Err(_) => 0, // 如果读取失败（如权限问题），返回 0
    }
}

fn main() {
    tauri::Builder::default()
        // ✨ 记得在这里注册 get_file_size
        .invoke_handler(tauri::generate_handler![greet, get_file_size])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}