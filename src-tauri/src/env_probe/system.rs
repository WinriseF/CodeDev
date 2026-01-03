use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use tauri::State;

/// 获取系统基础信息 (OS, CPU, Memory)
/// 对应 envinfo 的 "System" 字段
pub fn probe_system(system_state: State<'_, Arc<Mutex<System>>>) -> HashMap<String, String> {
    let mut info = HashMap::new();
    
    // 获取锁并刷新特定数据（只刷新需要的部分以提高性能）
    let mut sys = system_state.lock().unwrap();
    sys.refresh_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    // 1. OS 信息
    // sysinfo 自动处理了 Windows/macOS/Linux 的差异
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    // 类似于 "macOS 14.2.1" 或 "Windows 11"
    info.insert("OS".to_string(), format!("{} {}", os_name, os_version));

    // 2. CPU 信息
    // 获取第一个核心的 Vendor/Brand 即可，通常所有核心是一样的
    let cpu_brand = sys.cpus().first().map(|cpu| cpu.brand().trim().to_string()).unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_cores = sys.physical_core_count().unwrap_or(sys.cpus().len()); // 优先取物理核心数
    let arch = std::env::consts::ARCH; // "x86_64" or "aarch64"
    // 格式复刻 envinfo: "(10) x64 Apple M1 Max"
    info.insert("CPU".to_string(), format!("({}) {} {}", cpu_cores, arch, cpu_brand));

    // 3. Memory 信息
    // 转换为 GB 格式: "12.34 GB / 32.00 GB"
    let total_mem_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let free_mem_gb = sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    info.insert("Memory".to_string(), format!("{:.2} GB / {:.2} GB", free_mem_gb, total_mem_gb));

    // 4. Shell 信息 (仅限 Unix-like，Windows 比较复杂通常忽略或显示 PowerShell)
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            // 尝试获取版本，例如 "/bin/zsh" -> 运行 "/bin/zsh --version"
            let version = crate::env_probe::common::run_command(&shell, &["--version"])
                .unwrap_or_else(|_| "Unknown".to_string());
            // 提取版本号
            let v_clean = crate::env_probe::common::find_version(&version, None);
            info.insert("Shell".to_string(), format!("{} - {}", shell, v_clean));
        }
    }

    info
}