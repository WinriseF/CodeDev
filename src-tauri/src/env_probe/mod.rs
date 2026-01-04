use serde::Serialize;
use std::collections::HashMap;

pub mod common;
pub mod system;
pub mod binaries;
pub mod browsers;
pub mod ides;
pub mod npm;
pub mod sdks;
pub mod identity;
pub mod scan_logic;

#[derive(Debug, Serialize, Clone)]
pub struct ToolInfo {
    pub name: String,
    pub version: String,
    /// 安装路径
    pub path: Option<String>,
    /// 额外描述
    pub description: Option<String>,
}

/// 环境报告的顶级分类
#[derive(Debug, Serialize, Clone)]
pub struct EnvReport {
    pub system: Option<HashMap<String, String>>,
    pub binaries: Vec<ToolInfo>,
    pub browsers: Vec<ToolInfo>,
    pub ides: Vec<ToolInfo>,
    pub languages: Vec<ToolInfo>,
    pub sdks: HashMap<String, Vec<String>>,
    pub virtualization: Vec<ToolInfo>,
    pub databases: Vec<ToolInfo>,
    pub managers: Vec<ToolInfo>,
    pub utilities: Vec<ToolInfo>,
    pub npm_packages: Vec<ToolInfo>,
}

impl Default for EnvReport {
    fn default() -> Self {
        Self {
            system: None,
            binaries: Vec::new(),
            browsers: Vec::new(),
            ides: Vec::new(),
            languages: Vec::new(),
            sdks: HashMap::new(),
            virtualization: Vec::new(),
            databases: Vec::new(),
            managers: Vec::new(),
            utilities: Vec::new(),
            npm_packages: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub enum ProjectType {
    Tauri,      // 前端 + Rust 后端
    NodeFrontend, // 纯前端
    NodeBackend,  // Node 后端
    Rust,       // 纯 Rust
    Python,     // Python
    Mixed,      // 混合/未知
}

/// AI 上下文扫描结果
#[derive(Debug, Serialize, Clone)]
pub struct AiContextReport {
    pub project_type: ProjectType,
    pub summary: String,
    pub system_info: String, // OS, Shell
    pub toolchain: Vec<ToolInfo>, // 筛选后的核心工具 (Node, Rustc...)
    pub dependencies: HashMap<String, String>, // 关键依赖 (React, Tauri...)
    pub markdown: String, // 最终生成的 Prompt
}