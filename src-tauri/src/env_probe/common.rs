use std::process::Command;
use regex::Regex;
use std::path::PathBuf;
use which::which; // 需要在 Cargo.toml 添加 `which` 依赖，不过之前的上下文看你应该有了，或者它是 gitleaks 里的？如果没有需要加。
// 检查发现你的 Cargo.toml 里还没有 `which` crate，建议添加 `which = "6.0"`，或者我们可以暂时手写一个简单的 which。
// 为了稳健，我们暂时用 Command::new("which") 或 "where" 来模拟，或者你可以之后添加依赖。
// 这里我先用 Rust 标准库 Command 模拟，不引入新依赖以减少麻烦。

use crate::db::Prompt; // 借用一下类型定义或忽略

/// 获取工具信息的通用辅助结构
pub struct VersionCmd {
    pub bin: &'static str,
    pub args: &'static [&'static str],
}

/// 运行命令并返回 stdout (去掉首尾空白)
pub fn run_command(bin: &str, args: &[&str]) -> Result<String, String> {
    // 针对 Windows 的特殊处理
    #[cfg(target_os = "windows")]
    let (bin, args) = if bin == "npm" || bin == "pnpm" || bin == "yarn" || bin == "code" {
        // Windows 上 npm 通常是 npm.cmd
        ("cmd", [&["/C", bin], args].concat())
    } else {
        (bin, args.to_vec())
    };
    
    // Windows 上上述逻辑需要这一行来让 args 的生命周期匹配
    #[cfg(target_os = "windows")]
    let args: Vec<&str> = args.into_iter().map(|s| *s).collect();

    let output = Command::new(bin)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            // 有些工具版本信息在 stderr (比如 python, gcc sometimes)
            Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
        } else {
            Ok(stdout)
        }
    } else {
        // 失败时尝试读取 stderr
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// 在文本中查找版本号
/// 复刻 envinfo 的 findVersion 逻辑
pub fn find_version(text: &str, regex: Option<&Regex>) -> String {
    // 默认版本正则：匹配 x.y.z 格式
    let default_re = Regex::new(r"(\d+\.[\d+|.]+)").unwrap();
    let re = regex.unwrap_or(&default_re);

    if let Some(caps) = re.captures(text) {
        if let Some(match_) = caps.get(1) {
            return match_.as_str().to_string();
        } else if let Some(match_) = caps.get(0) {
            return match_.as_str().to_string();
        }
    }
    text.to_string() // 如果没匹配到，返回原文本（通常是错误信息或空）
}

/// 查找可执行文件路径 (模拟 `which` / `where`)
pub fn locate_binary(bin: &str) -> Option<String> {
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(path) = run_command("which", &[bin]) {
            if !path.is_empty() && !path.contains("not found") {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(path) = run_command("where", &[bin]) {
            // where 可能返回多行，取第一行
            let first_line = path.lines().next().unwrap_or("").trim();
            if !first_line.is_empty() && !first_line.contains("Could not find") {
                return Some(first_line.to_string());
            }
        }
    }
    None
}

/// 通用探测函数：给定命令和参数，自动获取版本和路径
pub fn generic_probe(name: &str, bin: &str, args: &[&str], version_regex: Option<&Regex>) -> crate::env_probe::ToolInfo {
    let path = locate_binary(bin);
    let version = if path.is_some() {
        match run_command(bin, args) {
            Ok(out) => find_version(&out, version_regex),
            Err(_) => "Not Found".to_string(),
        }
    } else {
        "Not Found".to_string()
    };

    crate::env_probe::ToolInfo {
        name: name.to_string(),
        version,
        path,
        description: None,
    }
}