use crate::env_probe::{common, ToolInfo};
use rayon::prelude::*;
use regex::Regex;
use std::sync::LazyLock;

/// 定义探测配置项
struct BinaryConfig {
    category: &'static str, // 用于逻辑分组，对应 envinfo 的 key
    name: &'static str,     // 显示名称
    bin: &'static str,      // 二进制文件名
    args: &'static [&'static str], // 获取版本的参数，通常是 ["--version"]
    regex: Option<&'static str>,
}

// 预编译正则以提升性能
static JAVA_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\d+\.[\w\._\-]+)").unwrap());
static OPENSSL_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"OpenSSL\s+([\w\._\-]+)").unwrap());

/// 完整的工具列表
/// 复刻了 envinfo 中所有基于命令行的检测项
const BINARY_LIST: &[BinaryConfig] = &[
    // --- Binaries (核心) ---
    BinaryConfig { category: "Binaries", name: "Node", bin: "node", args: &["-v"], regex: None },
    BinaryConfig { category: "Binaries", name: "Yarn", bin: "yarn", args: &["-v"], regex: None },
    BinaryConfig { category: "Binaries", name: "npm", bin: "npm", args: &["-v"], regex: None },
    BinaryConfig { category: "Binaries", name: "pnpm", bin: "pnpm", args: &["-v"], regex: None },
    BinaryConfig { category: "Binaries", name: "Bun", bin: "bun", args: &["-v"], regex: None },
    BinaryConfig { category: "Binaries", name: "Deno", bin: "deno", args: &["--version"], regex: None },
    BinaryConfig { category: "Binaries", name: "Watchman", bin: "watchman", args: &["-v"], regex: None },

    // --- Languages (语言) ---
    BinaryConfig { category: "Languages", name: "Java", bin: "javac", args: &["-version"], regex: Some(r"(\d+\.[\w\._\-]+)") }, // javac 输出到 stderr，通用函数已处理
    BinaryConfig { category: "Languages", name: "Python", bin: "python", args: &["--version"], regex: None },
    BinaryConfig { category: "Languages", name: "Python3", bin: "python3", args: &["--version"], regex: None },
    BinaryConfig { category: "Languages", name: "Go", bin: "go", args: &["version"], regex: Some(r"go version go([\d\.]+)") },
    BinaryConfig { category: "Languages", name: "Rust", bin: "rustc", args: &["--version"], regex: None },
    BinaryConfig { category: "Languages", name: "PHP", bin: "php", args: &["-v"], regex: None },
    BinaryConfig { category: "Languages", name: "Ruby", bin: "ruby", args: &["-v"], regex: None },
    BinaryConfig { category: "Languages", name: "Perl", bin: "perl", args: &["-v"], regex: Some(r"v(\d+\.\d+\.\d+)") },
    BinaryConfig { category: "Languages", name: "GCC", bin: "gcc", args: &["--version"], regex: None },
    BinaryConfig { category: "Languages", name: "Clang", bin: "clang", args: &["--version"], regex: None },

    // --- Virtualization (虚拟化) ---
    BinaryConfig { category: "Virtualization", name: "Docker", bin: "docker", args: &["--version"], regex: None },
    BinaryConfig { category: "Virtualization", name: "Docker Compose", bin: "docker-compose", args: &["--version"], regex: None },
    BinaryConfig { category: "Virtualization", name: "Podman", bin: "podman", args: &["--version"], regex: None },

    // --- Utilities (工具) ---
    BinaryConfig { category: "Utilities", name: "Git", bin: "git", args: &["--version"], regex: None },
    BinaryConfig { category: "Utilities", name: "Make", bin: "make", args: &["--version"], regex: None },
    BinaryConfig { category: "Utilities", name: "CMake", bin: "cmake", args: &["--version"], regex: None },
    BinaryConfig { category: "Utilities", name: "Curl", bin: "curl", args: &["--version"], regex: None },
    BinaryConfig { category: "Utilities", name: "FFmpeg", bin: "ffmpeg", args: &["-version"], regex: None },
    BinaryConfig { category: "Utilities", name: "OpenSSL", bin: "openssl", args: &["version"], regex: Some(r"OpenSSL\s+([\w\._\-]+)") },
    
    // --- Managers (包管理) ---
    BinaryConfig { category: "Managers", name: "Cargo", bin: "cargo", args: &["--version"], regex: None },
    BinaryConfig { category: "Managers", name: "CocoaPods", bin: "pod", args: &["--version"], regex: None },
    BinaryConfig { category: "Managers", name: "Pip", bin: "pip", args: &["--version"], regex: None },
    BinaryConfig { category: "Managers", name: "Homebrew", bin: "brew", args: &["--version"], regex: None },
    BinaryConfig { category: "Managers", name: "Maven", bin: "mvn", args: &["-version"], regex: None },
    BinaryConfig { category: "Managers", name: "Gradle", bin: "gradle", args: &["-version"], regex: None },

    // --- Databases (数据库) ---
    BinaryConfig { category: "Databases", name: "MySQL", bin: "mysql", args: &["--version"], regex: Some(r"Ver ([\d\.]+)") },
    BinaryConfig { category: "Databases", name: "PostgreSQL", bin: "psql", args: &["--version"], regex: None },
    BinaryConfig { category: "Databases", name: "SQLite", bin: "sqlite3", args: &["--version"], regex: None },
    BinaryConfig { category: "Databases", name: "MongoDB", bin: "mongod", args: &["--version"], regex: None },
];

/// 批量并行探测指定类别的工具
/// 使用 Rayon 进行多线程并发，极大提高速度
pub fn probe_by_category(target_category: &str) -> Vec<ToolInfo> {
    BINARY_LIST
        .par_iter() // 并行迭代器
        .filter(|cfg| cfg.category == target_category)
        .map(|cfg| {
            // 动态编译 Regex
            let re = cfg.regex.map(|s| Regex::new(s).unwrap_or_else(|_| Regex::new(r"(\d+\.[\d+|.]+)").unwrap()));
            
            // 特殊正则，使用预编译的（优化）
            let re_ref = if cfg.name == "Java" {
                Some(&*JAVA_REGEX)
            } else if cfg.name == "OpenSSL" {
                Some(&*OPENSSL_REGEX)
            } else {
                re.as_ref()
            };

            common::generic_probe(cfg.name, cfg.bin, cfg.args, re_ref)
        })
        .collect()
}

#[allow(dead_code)]
pub fn probe_all_flat() -> Vec<ToolInfo> {
    BINARY_LIST
        .par_iter()
        .map(|cfg| {
            common::generic_probe(cfg.name, cfg.bin, cfg.args, None)
        })
        .collect()
}