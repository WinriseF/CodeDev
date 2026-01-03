use std::process::{Command, Stdio};
use std::time::Duration;
use regex::Regex;
use which::which;
use wait_timeout::ChildExt;

// 设定超时时间
const TIMEOUT_SECS: u64 = 5;

/// 运行命令并返回 stdout
pub fn run_command(bin: &str, args: &[&str]) -> Result<String, String> {
    // 针对 Windows 的特殊处理：参数拼接
    #[cfg(target_os = "windows")]
    let (bin, final_args) = if bin == "npm" || bin == "pnpm" || bin == "yarn" || bin == "code" {
        let mut new_args = vec!["/C", bin];
        new_args.extend_from_slice(args);
        ("cmd", new_args)
    } else {
        (bin, args.to_vec())
    };

    #[cfg(not(target_os = "windows"))]
    let (bin, final_args) = (bin, args);

    // 1. 构建命令
    let mut command = Command::new(bin);
    command.args(final_args);
    command.stdout(Stdio::piped()); // 捕获输出
    command.stderr(Stdio::piped()); // 捕获错误

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    // 2. 启动子进程
    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", bin, e))?;

    // 3. 等待超时
    let status_code = match child.wait_timeout(Duration::from_secs(TIMEOUT_SECS)).map_err(|e| e.to_string())? {
        Some(status) => status,
        None => {
            // 超时处理：杀死进程
            let _ = child.kill();
            let _ = child.wait(); 
            return Err(format!("Command '{}' timed out after {}s", bin, TIMEOUT_SECS));
        }
    };

    // 4. 获取输出结果
    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if status_code.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
        } else {
            Ok(stdout)
        }
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// 在文本中查找版本号
pub fn find_version(text: &str, regex: Option<&Regex>) -> String {
    let default_re = Regex::new(r"(\d+\.[\d+|.]+)").unwrap();
    let re = regex.unwrap_or(&default_re);

    if let Some(caps) = re.captures(text) {
        if let Some(match_) = caps.get(1) {
            return match_.as_str().to_string();
        } else if let Some(match_) = caps.get(0) {
            return match_.as_str().to_string();
        }
    }
    text.to_string()
}

pub fn locate_binary(bin: &str) -> Option<String> {
    match which(bin) {
        Ok(path) => Some(path.to_string_lossy().to_string()),
        Err(_) => None
    }
}

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