use serde::Serialize;
use std::collections::HashMap;

pub mod common;
pub mod system;
pub mod binaries;
pub mod browsers;
pub mod ides;
pub mod npm; // 新增

/// 工具的详细信息
#[derive(Debug, Serialize, Clone)]
pub struct ToolInfo {
    pub name: String,
    /// 版本号，若未找到则为 "Not Found"
    pub version: String,
    /// 可选：安装路径
    pub path: Option<String>,
    /// 可选：额外描述（如 "Powered by xxx" 或构建号）
    pub description: Option<String>,
}

/// 环境报告的顶级分类
#[derive(Debug, Serialize, Clone)]
pub struct EnvReport {
    pub system: Option<HashMap<String, String>>, // OS, CPU, Memory
    pub binaries: Vec<ToolInfo>,                 // Node, npm, Git...
    pub browsers: Vec<ToolInfo>,                 // Chrome, Safari...
    pub ides: Vec<ToolInfo>,                     // VSCode, Xcode...
    pub languages: Vec<ToolInfo>,                // Java, Python...
    pub sdks: HashMap<String, Vec<String>>,      // iOS SDKs, Android API Levels...
    pub virtualization: Vec<ToolInfo>,           // Docker...
    pub databases: Vec<ToolInfo>,                // MySQL...
    pub managers: Vec<ToolInfo>,                 // Cargo, Pip...
    pub utilities: Vec<ToolInfo>,                // CMake, GCC...
    pub npm_packages: Vec<ToolInfo>,             // 项目依赖
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

/// 核心特征：所有探测逻辑（Node, Git, Docker...）都必须实现此 Trait
pub trait Probe: Send + Sync {
    /// 执行探测，返回 ToolInfo。如果完全不存在，可以返回 None 或 "Not Found" 状态的 Info
    fn probe(&self) -> ToolInfo;
}