use serde::Serialize;
use std::net::SocketAddr;
use std::process::Command;
use std::sync::{Arc, Mutex};
use sysinfo::{
    Pid, ProcessesToUpdate, ProcessRefreshKind, RefreshKind, CpuRefreshKind, MemoryRefreshKind,
    System, UpdateKind,
};
use tauri::State;
use listeners::{get_all, Protocol};
use rayon::prelude::*;
use crate::env_probe::{self, EnvReport};

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
    pub is_system: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PortInfo {
    pub port: u16,
    pub protocol: String,
    pub pid: u32,
    pub process_name: String,
    pub local_addr: String,
    pub is_system: bool,
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

// --- 辅助函数：判断是否为系统进程 ---

fn is_system_process(_sys: &System, process: &sysinfo::Process) -> bool {
    let name = process.name().to_string_lossy().to_lowercase();

    #[cfg(windows)]
    {
        let system_names = [
            "system", "registry", "smss.exe", "csrss.exe", "wininit.exe",
            "services.exe", "lsass.exe", "svchost.exe", "winlogon.exe",
        ];
        if system_names.iter().any(|&s| name.contains(s)) {
            return true;
        }
    }

    #[cfg(target_os = "macos")]
    {
        let system_names = [
            "kernel_task", "launchd", "windowserver", "loginwindow",
            "dock", "finder",
        ];
        if system_names.iter().any(|&s| name.contains(s)) {
            return true;
        }
    }

    #[cfg(target_os = "linux")]
    {
        let system_names = ["systemd", "init", "kthreadd", "rcu_sched"];
        if system_names.iter().any(|&s| name.contains(s)) {
            return true;
        }
    }

    let pid = process.pid().as_u32();
    if pid <= 4 {
        return true;
    }

    false
}

// --- 核心命令 ---

#[tauri::command]
pub fn get_system_metrics(system: State<'_, Arc<Mutex<System>>>) -> Result<SystemMetrics, String> {
    let mut sys = system.lock().map_err(|e| e.to_string())?;

    sys.refresh_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    let cpu_usage = sys.global_cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    Ok(SystemMetrics {
        cpu_usage,
        memory_used,
        memory_total,
    })
}

#[tauri::command]
pub fn get_top_processes(system: State<'_, Arc<Mutex<System>>>) -> Result<Vec<ProcessInfo>, String> {
    let mut sys = system.lock().map_err(|e| e.to_string())?;

    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_cpu()
            .with_memory()
            .with_user(UpdateKind::Always),
    );

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let pid_u32 = pid.as_u32();
            if pid_u32 == 0 {
                return None;
            }

            let name = process.name().to_string_lossy().to_string();
            if name.is_empty() {
                return None;
            }

            // sysinfo 0.37: Uid 是私有类型，只能用 Debug 打印
            // 我们用 {:?} 显示 UID（通常是数字），并特殊处理 root (0)
            let user = if let Some(uid) = process.user_id() {
                format!("{:?}", uid).trim_start_matches("Uid(").trim_end_matches(')').to_string();
                let uid_str = format!("{:?}", uid);
                if uid_str == "Uid(0)" {
                    "root".to_string()
                } else {
                    format!("UID {}", uid_str.trim_start_matches("Uid(").trim_end_matches(')'))
                }
            } else {
                "Unknown".to_string()
            };

            let is_system = is_system_process(&sys, process);

            Some(ProcessInfo {
                pid: pid_u32,
                name,
                cpu_usage: process.cpu_usage(),
                memory: process.memory(),
                user,
                is_system,
            })
        })
        .collect();

    processes.par_sort_unstable_by(|a, b| {
        b.cpu_usage
            .partial_cmp(&a.cpu_usage)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(processes.into_iter().take(30).collect())
}

#[tauri::command]
pub async fn get_active_ports(system: State<'_, Arc<Mutex<System>>>) -> Result<Vec<PortInfo>, String> {
    let sys_state = system.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let listeners = get_all().map_err(|e| e.to_string())?;
        let mut sys = sys_state.lock().map_err(|e| e.to_string())?;

        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_user(UpdateKind::Always),
        );

        let mut port_infos = Vec::new();

        for l in listeners {
            let pid_u32 = l.process.pid;
            let pid = Pid::from(pid_u32 as usize);

            let (process_name, is_system) = if let Some(process) = sys.process(pid) {
                (
                    process.name().to_string_lossy().to_string(),
                    is_system_process(&sys, process),
                )
            } else {
                (format!("Unknown ({})", pid_u32), false)
            };

            let local_addr = match l.socket {
                SocketAddr::V4(v4) => v4.ip().to_string(),
                SocketAddr::V6(v6) => v6.ip().to_string(),
            };

            port_infos.push(PortInfo {
                port: l.socket.port(),
                protocol: match l.protocol {
                    Protocol::TCP => "TCP".to_string(),
                    Protocol::UDP => "UDP".to_string(),
                },
                pid: pid_u32,
                process_name,
                local_addr,
                is_system,
            });
        }

        port_infos.sort_by_key(|p| p.port);
        port_infos.dedup_by(|a, b| a.port == b.port && a.protocol == b.protocol);

        Ok(port_infos)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn kill_process(pid: u32, system: State<'_, Arc<Mutex<System>>>) -> Result<String, String> {
    let mut sys = system.lock().map_err(|e| e.to_string())?;
    let sys_pid = Pid::from(pid as usize);

    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[sys_pid]),
        false,
        ProcessRefreshKind::nothing(),
    );

    if let Some(process) = sys.process(sys_pid) {
        if is_system_process(&sys, process) {
            return Err(format!("Action Denied: Process {} is a system process.", pid));
        }
    } else {
        return Err("Process not found".to_string());
    }

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


#[tauri::command]
pub async fn get_env_info(
    system: State<'_, Arc<Mutex<System>>>,
    project_path: Option<String>, // 新增参数：当前项目路径
) -> Result<EnvReport, String> {
    
    // 使用 rayon 的 join API 实现全并行探测
    // 这种写法看起来像回调地狱，但在 Rust 中这是最高效的并行方式之一 (Fork-Join 模型)
    let (system_info, (binaries, (browsers, (ides, (languages, (virtualization, (utilities, (managers, npm_packages)))))))) = rayon::join(
        // Task 1: System Info (需持有锁)
        || env_probe::system::probe_system(system.clone()),
        || rayon::join(
            // Task 2: Binaries
            || env_probe::binaries::probe_by_category("Binaries"),
            || rayon::join(
                // Task 3: Browsers
                || env_probe::browsers::probe_browsers(),
                || rayon::join(
                    // Task 4: IDEs
                    || env_probe::ides::probe_ides(),
                    || rayon::join(
                        // Task 5: Languages
                        || env_probe::binaries::probe_by_category("Languages"),
                        || rayon::join(
                            // Task 6: Virtualization
                            || env_probe::binaries::probe_by_category("Virtualization"),
                            || rayon::join(
                                // Task 7: Utilities
                                || env_probe::binaries::probe_by_category("Utilities"),
                                || rayon::join(
                                    // Task 8: Managers
                                    || env_probe::binaries::probe_by_category("Managers"),
                                    // Task 9: NPM Packages (IO Bound)
                                    || env_probe::npm::probe_npm_packages(project_path.clone())
                                )
                            )
                        )
                    )
                )
            )
        )
    );

    Ok(EnvReport {
        system: Some(system_info),
        binaries,
        browsers,
        ides,
        languages,
        virtualization,
        utilities,
        managers,
        npm_packages,
        sdks: std::collections::HashMap::new(),
        databases: Vec::new(),
    })
}

#[tauri::command]
pub async fn diagnose_network() -> Vec<NetDiagResult> {
    let targets = vec![
        ("github", "GitHub", "https://github.com"),
        ("google", "Google", "https://www.google.com"),
        ("openai", "OpenAI", "https://openai.com"),
        ("pypi", "pypi源", "https://pypi.org"),
        ("npm", "NPM Registry", "https://registry.npmjs.org"),
        ("baidu", "Baidu", "https://www.baidu.com"),
        ("cloudflare", "Cloudflare", "https://www.cloudflare.com"),
    ];

    let target_order: Vec<String> = targets.iter().map(|t| t.0.to_string()).collect();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .unwrap_or_default();

    let mut handles = Vec::new();

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
                    let status = if status_code >= 400 {
                        "Fail"
                    } else if duration < 500 {
                        "Success"
                    } else {
                        "Slow"
                    };
                    NetDiagResult {
                        id,
                        name,
                        url,
                        status: status.to_string(),
                        latency: duration,
                        status_code,
                    }
                }
                Err(_) => {
                    let start_retry = std::time::Instant::now();
                    match c.get(&url).send().await {
                        Ok(r) => {
                            let duration_retry = start_retry.elapsed().as_millis();
                            let status_code = r.status().as_u16();
                            let status = if status_code >= 400 {
                                "Fail"
                            } else if duration_retry < 800 {
                                "Success"
                            } else {
                                "Slow"
                            };
                            NetDiagResult {
                                id,
                                name,
                                url,
                                status: status.to_string(),
                                latency: duration_retry,
                                status_code,
                            }
                        }
                        Err(_) => NetDiagResult {
                            id,
                            name,
                            url,
                            status: "Fail".to_string(),
                            latency: 0,
                            status_code: 0,
                        },
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

    let mut ordered_results = Vec::new();
    for id in target_order {
        if let Some(r) = results.iter().find(|r| r.id == id) {
            ordered_results.push(r.clone());
        }
    }

    ordered_results
}