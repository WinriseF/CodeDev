use super::{AiContextReport, ProjectType, ToolInfo, identity};
use crate::env_probe::common::{run_command, find_version};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use regex::Regex;

/// 核心入口：生成 AI 上下文报告
pub fn scan_ai_context(root: &str) -> AiContextReport {
    // 1. 快速识别项目类型
    let project_type = identity::detect_project_type(root);

    // 2. 并行执行扫描任务 (使用 Rayon)
    // 结构: join(System, join(Node, Rust))
    // 任务 A: 系统信息
    // 任务 B: Node 环境 (包含版本检测和 package.json 解析)
    // 任务 C: Rust 环境 (包含版本检测和 Cargo.toml 解析)
    let (system_info, ((node_tool, node_deps), (rust_tool, rust_deps))) = rayon::join(
        || get_system_brief(),
        || rayon::join(
            || rayon::join(
                || if needs_node(&project_type) { check_node_version() } else { None },
                || if needs_node(&project_type) { scan_package_json(root) } else { HashMap::new() }
            ),
            || rayon::join(
                || if needs_rust(&project_type) { check_rust_version() } else { None },
                || if needs_rust(&project_type) { scan_cargo_toml(root) } else { HashMap::new() }
            )
        )
    );

    // 3. 聚合数据
    let mut toolchain = Vec::new();
    if let Some(t) = node_tool { toolchain.push(t); }
    if let Some(t) = rust_tool { toolchain.push(t); }

    let mut dependencies = HashMap::new();
    dependencies.extend(node_deps);
    dependencies.extend(rust_deps);

    // 4. 生成摘要和 Markdown
    let summary = format!("Detected {:?} Project on {}", project_type, system_info);
    let markdown = build_markdown(&project_type, &system_info, &toolchain, &dependencies);

    AiContextReport {
        project_type,
        summary,
        system_info,
        toolchain,
        dependencies,
        markdown,
    }
}

// --- 辅助判断 ---
fn needs_node(pt: &ProjectType) -> bool {
    matches!(pt, ProjectType::Tauri | ProjectType::NodeFrontend | ProjectType::NodeBackend | ProjectType::Mixed)
}

fn needs_rust(pt: &ProjectType) -> bool {
    matches!(pt, ProjectType::Tauri | ProjectType::Rust | ProjectType::Mixed)
}

// --- 扫描实现 ---

fn get_system_brief() -> String {
    let os = sysinfo::System::name().unwrap_or("Unknown OS".to_string());
    let ver = sysinfo::System::os_version().unwrap_or_default();
    
    #[cfg(windows)]
    let shell = "PowerShell";
    #[cfg(not(windows))]
    let shell = std::env::var("SHELL").unwrap_or("Bash/Zsh".to_string());
    
    format!("{} {} ({})", os, ver, shell)
}

fn check_node_version() -> Option<ToolInfo> {
    if let Ok(out) = run_command("node", &["-v"]) {
        Some(ToolInfo { name: "Node".into(), version: out, path: None, description: None })
    } else {
        None
    }
}

fn check_rust_version() -> Option<ToolInfo> {
    if let Ok(out) = run_command("rustc", &["--version"]) {
        // rustc 1.75.0 (xxxx) -> 1.75.0
        let v = find_version(&out, None);
        Some(ToolInfo { name: "Rust".into(), version: v, path: None, description: None })
    } else {
        None
    }
}

/// 解析 package.json，只提取关键依赖
fn scan_package_json(root: &str) -> HashMap<String, String> {
    let mut deps = HashMap::new();
    let path = Path::new(root).join("package.json");
    
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(json) = serde_json::from_str::<Value>(&content) {
            // 定义白名单，只提取对 AI 编程至关重要的核心库
            let whitelist = [
                "react", "vue", "next", "nuxt", "svelte", "solid-js", "@angular/core",
                "vite", "webpack", "tailwindcss", "typescript", "electron", "tauri",
                "@tauri-apps/api", "@tauri-apps/cli", "axios", "express", "nestjs",
                "react-native", "expo", "three"
            ];

            // 修复：闭包声明为 mut，因为 deps 是可变引用
            let mut collect = |target: &Value| {
                if let Some(obj) = target.as_object() {
                    for (k, v) in obj {
                        // 匹配白名单 或 以 @tauri-apps 开头
                        if whitelist.contains(&k.as_str()) || k.starts_with("@tauri-apps/") {
                            deps.insert(k.clone(), v.as_str().unwrap_or("*").to_string());
                        }
                    }
                }
            };

            collect(&json["dependencies"]);
            collect(&json["devDependencies"]);
        }
    }
    deps
}

/// 解析 Cargo.toml (优先查 src-tauri 目录)
fn scan_cargo_toml(root: &str) -> HashMap<String, String> {
    let mut deps = HashMap::new();
    // 优先探测 Tauri 子目录
    let tauri_cargo = Path::new(root).join("src-tauri").join("Cargo.toml");
    let root_cargo = Path::new(root).join("Cargo.toml");
    
    let target_path = if tauri_cargo.exists() { tauri_cargo } else { root_cargo };

    if let Ok(content) = fs::read_to_string(target_path) {
        // 简易 Regex 解析，避免引入完整 TOML Parser 依赖
        // 匹配 pattern: name = "version" 或 name = { version = "..." }
        let re_simple = Regex::new(r#"(?m)^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)""#).unwrap();
        
        // 白名单：Tauri 插件, 核心库
        let whitelist = ["tauri", "serde", "tokio", "diesel", "sqlx", "reqwest", "rocket", "actix-web"];

        for cap in re_simple.captures_iter(&content) {
            let name = &cap[1];
            let ver = &cap[2];
            
            if whitelist.contains(&name) || name.starts_with("tauri-plugin") {
                deps.insert(name.to_string(), ver.to_string());
            }
        }
    }
    deps
}

fn build_markdown(pt: &ProjectType, sys: &str, tools: &[ToolInfo], deps: &HashMap<String, String>) -> String {
    let mut md = String::new();
    md.push_str(&format!("## Project Context: {:?}\n", pt));
    md.push_str(&format!("- **Environment**: {}\n", sys));
    
    if !tools.is_empty() {
        md.push_str("- **Toolchain**: ");
        let tool_strs: Vec<String> = tools.iter().map(|t| format!("{} {}", t.name, t.version)).collect();
        md.push_str(&tool_strs.join(", "));
        md.push_str("\n");
    }

    if !deps.is_empty() {
        md.push_str("\n## Key Dependencies\n");
        // 排序以保持稳定
        let mut sorted_deps: Vec<_> = deps.iter().collect();
        sorted_deps.sort_by_key(|a| a.0);
        
        for (name, ver) in sorted_deps {
            // 清理版本号中的 ^ ~ 符号，AI 不需要
            let clean_ver = ver.trim_start_matches('^').trim_start_matches('~');
            md.push_str(&format!("- {}: {}\n", name, clean_ver));
        }
    }

    md
}