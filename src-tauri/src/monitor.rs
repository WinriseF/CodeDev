use serde::Serialize;
use std::process::Command;
use std::sync::{Arc, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System, ProcessesToUpdate, UpdateKind}; // 引入缺少的 ProcessesToUpdate, UpdateKind
use tauri::{State, Result as TauriResult};
use listeners::{Listener, SocketAddr}; // SockAddr -> SocketAddr
use rayon::prelude::*;

// --- 数据结构定义 ---

#[derive(Debug, Serialize, Clone)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory: u64,
    pub user: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PortInfo {
    pub port: u16,
    pub protocol: String,
    pub pid: u32,
    pub process_name: String,
    pub local_addr: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct EnvInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct NetDiagResult {
    pub id: String,
    pub name: String,
    pub url: String,
    pub status: String,
    pub latency: u128,
    pub status_code: u16,
}

// --- 核心逻辑命令 ---

// 1. 获取系统基础指标 (CPU/内存)
#[tauri::command]
pub fn get_system_metrics(system: State<'_, Arc<Mutex<System>>>) -> Result<SystemMetrics, String> {
    let mut sys = system.lock().map_err(|e| e.to_string())?;
    
    // 修复: refresh_specifics 逻辑保持不变，API 兼容
    sys.refresh_specifics(
        RefreshKind::new()
            .with_cpu(sysinfo::CpuRefreshKind::new().with_cpu_usage()) 
            .with_memory(sysinfo::MemoryRefreshKind::new()) 
    );

    // 修复: global_cpu_info().cpu_usage() -> global_cpu_usage()
    let cpu_usage = sys.global_cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    Ok(SystemMetrics {
        cpu_usage,
        memory_used,
        memory_total,
    })
}

// 2. 获取 Top N 进程
#[tauri::command]
pub fn get_top_processes(system: State<'_, Arc<Mutex<System>>>) -> Result<Vec<ProcessInfo>, String> {
    let mut sys = system.lock().map_err(|e| e.to_string())?;
    
    // 修复: refresh_processes_specifics 参数变更
    // 1. ProcessesToUpdate::All
    // 2. true (remove_dead_processes)
    // 3. ProcessRefreshKind (去掉不存在的 with_name)
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::new().with_cpu().with_memory().with_user(),
    );

    let mut processes: Vec<ProcessInfo> = sys.processes()
        .iter()
        .filter_map(|(pid, process)| {
            if pid.as_u32() == 0 { return None; }
            
            let name = process.name().to_string_lossy().to_string();
            if name.is_empty() { return None; }

            let user = process.user_id()
                .map(|uid| uid.to_string())
                .unwrap_or_else(|| "System".to_string());

            Some(ProcessInfo {
                pid: pid.as_u32(),
                name,
                cpu_usage: process.cpu_usage(),
                memory: process.memory(),
                user,
            })
        })
        .collect();

    processes.par_sort_unstable_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
    
    Ok(processes.into_iter().take(30).collect())
}

// 3. 获取端口占用
#[tauri::command]
pub async fn get_active_ports(system: State<'_, Arc<Mutex<System>>>) -> Result<Vec<PortInfo>, String> {
    let sys_state = system.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let listeners = listeners::get_all().map_err(|e| e.to_string())?;
        
        let mut sys = sys_state.lock().map_err(|e| e.to_string())?;
        sys.refresh_processes(ProcessesToUpdate::All, true); // 修复: refresh_processes 参数

        let mut port_infos = Vec::new();

        for l in listeners {
            // 修复: listeners 0.3 中 pid 在 process 字段里
            let pid = l.process.pid.as_u32(); // 假设 pid 是 sysinfo::Pid 类型或类似
            
            let process_name = sys.process(Pid::from_u32(pid))
                .map(|p| p.name().to_string_lossy().to_string())
                .unwrap_or_else(|| format!("Unknown ({})", pid));

            // 修复: SockAddr -> SocketAddr
            let local_addr = match &l.socket {
                SocketAddr::Inet(addr) => addr.ip().to_string(),
                SocketAddr::Inet6(addr) => addr.ip().to_string(),
                _ => "Unknown".to_string(),
            };

            port_infos.push(PortInfo {
                port: l.socket.port(),
                // 修复: 枚举 Tcp -> TCP, Udp -> UDP
                protocol: match l.protocol {
                    listeners::Protocol::TCP => "TCP".to_string(),
                    listeners::Protocol::UDP => "UDP".to_string(),
                    _ => "Unknown".to_string(),
                },
                pid,
                process_name,
                local_addr,
            });
        }
        
        Ok(port_infos)
    }).await.map_err(|e| e.to_string())?
}

// 4. 结束进程 (保持不变，除了一些可能的优化)
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let command_name = "taskkill";
    
    #[cfg(not(target_os = "windows"))]
    let command_name = "kill";

    let mut args = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        args.push("/F");
        args.push("/PID");
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        args.push("-9");
    }
    
    let pid_str = pid.to_string();
    args.push(&pid_str);

    let output = Command::new(command_name)
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok("Success".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// 5. 获取环境指纹 (保持不变)
#[tauri::command]
pub async fn get_env_info() -> Vec<EnvInfo> {
    let tools = vec![
        ("Node.js", "node", "-v"),
        ("NPM", "npm", "-v"),
        ("Python", "python", "--version"),
        ("Go", "go", "version"),
        ("Rust", "rustc", "--version"),
        ("Git", "git", "--version"),
        ("Docker", "docker", "--version"),
    ];

    let mut handles = Vec::new();

    for (name, bin, arg) in tools {
        handles.push(tauri::async_runtime::spawn_blocking(move || {
            let output = Command::new(bin).arg(arg).output();
            let version = match output {
                Ok(o) if o.status.success() => {
                    let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if s.len() > 50 { s[..50].to_string() + "..." } else { s }
                },
                _ => "Not Found".to_string()
            };
            EnvInfo { name: name.to_string(), version }
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        if let Ok(info) = handle.await {
            results.push(info);
        }
    }
    results
}

// 6. 网络诊断
#[tauri::command]
pub async fn diagnose_network() -> Vec<NetDiagResult> {
    // 修复: 先提取 ID 列表，避免后续 borrow moved value
    let targets = vec![
        ("github", "GitHub", "https://github.com"),
        ("google", "Google", "https://www.google.com"),
        ("openai", "OpenAI API", "https://api.openai.com"),
        ("npm", "NPM Registry", "https://registry.npmjs.org"),
        ("baidu", "Baidu", "https://www.baidu.com"),
    ];
    
    // 提前克隆一份 ID 顺序用于排序返回
    let target_order: Vec<String> = targets.iter().map(|t| t.0.to_string()).collect();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(3)) 
        .build()
        .unwrap_or_default();

    let mut handles = Vec::new();

    // 修复: 循环中使用引用或克隆数据
    for (id, name, url) in targets {
        let c = client.clone();
        let id = id.to_string();
        let name = name.to_string();
        let url = url.to_string();

        handles.push(tauri::async_runtime::spawn(async move {
            let start = std::time::Instant::now();
            let resp = c.head(&url).send().await;
            let duration = start.elapsed().as_millis();

            match resp {
                Ok(r) => {
                    let status_code = r.status().as_u16();
                    let status = if status_code >= 400 { "Fail" } else if duration < 500 { "Success" } else { "Slow" };
                    NetDiagResult { id, name, url, status: status.to_string(), latency: duration, status_code }
                },
                Err(_) => {
                    // HEAD 失败尝试 GET
                    let start_retry = std::time::Instant::now();
                    match c.get(&url).send().await {
                        Ok(r) => {
                            let duration_retry = start_retry.elapsed().as_millis();
                            let status_code = r.status().as_u16();
                            let status = if status_code >= 400 { "Fail" } else if duration_retry < 800 { "Success" } else { "Slow" };
                            NetDiagResult { id, name, url, status: status.to_string(), latency: duration_retry, status_code }
                        },
                        Err(_) => NetDiagResult { id, name, url, status: "Fail".to_string(), latency: 0, status_code: 0 }
                    }
                }
            }
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        if let Ok(res) = handle.await {
            results.push(res);
        }
    }
    
    // 按原始顺序排序
    let mut ordered_results = Vec::new();
    for id in target_order {
        if let Some(r) = results.iter().find(|r| r.id == id) {
            ordered_results.push(r.clone());
        }
    }
    
    ordered_results
}