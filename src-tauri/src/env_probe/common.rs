use std::process::{Command, Stdio};
use std::time::Duration;
use regex::Regex;
use which::which;
use wait_timeout::ChildExt;

const TIMEOUT_SECS: u64 = 8;

pub fn run_command(bin: &str, args: &[&str]) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let (bin, final_args) = {
        // 2. 性能优化：仅针对 Windows 上的批处理脚本(.cmd/.bat)使用 cmd /c
        let script_tools = ["npm", "pnpm", "yarn", "cnpm", "code", "mvn", "gradle", "pod"];
        
        if script_tools.contains(&bin) {
            let mut new_args = vec!["/C", bin];
            new_args.extend_from_slice(args);
            ("cmd", new_args)
        } else {
            (bin, args.to_vec())
        }
    };

    #[cfg(not(target_os = "windows"))]
    let (bin, final_args) = (bin, args);

    // 配置命令
    let mut command = Command::new(bin);
    command.args(final_args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    // Windows 这是一个优化标志，防止弹出黑框（虽然 tauri 已处理，但双重保险）
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    // 启动进程
    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", bin, e))?;

    // 3. 带超时的等待
    let status_code = match child.wait_timeout(Duration::from_secs(TIMEOUT_SECS)).map_err(|e| e.to_string())? {
        Some(status) => status,
        None => {
            // 超时处理：强制杀掉进程
            let _ = child.kill();
            let _ = child.wait(); // 清理僵尸进程
            return Err(format!("Time Out"));
        }
    };

    // 获取输出
    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if status_code.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            // 有些工具把版本信息输出到 stderr (如 java, gcc)
            Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
        } else {
            Ok(stdout)
        }
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

pub fn find_version(text: &str, regex: Option<&Regex>) -> String {
    let default_re = Regex::new(r"(\d+\.[\w\._-]+)").unwrap();
    let re = regex.unwrap_or(&default_re);
    
    if let Some(caps) = re.captures(text) {
        if let Some(match_) = caps.get(1) {
            return match_.as_str().trim().to_string();
        } else if let Some(match_) = caps.get(0) {
            return match_.as_str().trim().to_string();
        }
    }
    
    // 如果正则没匹配到，但输出很短，可能整个输出就是版本号
    if text.len() < 30 && !text.contains("error") && !text.contains("Error") {
        return text.trim().to_string();
    }
    
    // 无法解析
    "Unknown".to_string()
}

pub fn locate_binary(bin: &str) -> Option<String> {
    match which(bin) {
        Ok(path) => Some(path.to_string_lossy().to_string()),
        Err(_) => None
    }
}

pub fn generic_probe(name: &str, bin: &str, args: &[&str], version_regex: Option<&Regex>) -> crate::env_probe::ToolInfo {
    // 4. 逻辑优化：先找路径
    let path = locate_binary(bin);
    
    let version = if let Some(_) = path {
        // 如果找到了路径，再去执行耗时的版本检查
        match run_command(bin, args) {
            Ok(out) => find_version(&out, version_regex),
            Err(e) => {
                // 5. 如果路径存在但执行失败（例如超时），返回特定状态而不是 Not Found
                if e.contains("Time Out") {
                    "Time Out".to_string()
                } else {
                    "Installed (Check Failed)".to_string()
                }
            },
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