pub mod entropy;
pub mod rules;
pub mod stopwords;
pub mod engine;

use engine::SecretMatch;

// === Tauri Command Wrapper ===

#[tauri::command]
pub fn scan_for_secrets(content: String) -> Vec<SecretMatch> {
    // 调用引擎进行扫描
    engine::scan(&content)
}