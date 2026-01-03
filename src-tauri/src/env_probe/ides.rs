use crate::env_probe::{common, ToolInfo};
use rayon::prelude::*;

struct IdeConfig {
    name: &'static str,
    bin: &'static str, // 命令行工具 (code, idea)
    mac_id: &'static str, // macOS Bundle ID
}

const IDES: &[IdeConfig] = &[
    IdeConfig { name: "VSCode", bin: "code", mac_id: "com.microsoft.VSCode" },
    IdeConfig { name: "Cursor", bin: "cursor", mac_id: "com.todesktop.230313mzl4w4u92" }, // Cursor 的 ID
    IdeConfig { name: "Sublime Text", bin: "subl", mac_id: "com.sublimetext.4" },
    IdeConfig { name: "Xcode", bin: "xcodebuild", mac_id: "com.apple.dt.Xcode" },
    IdeConfig { name: "IntelliJ", bin: "idea", mac_id: "com.jetbrains.intellij" },
    IdeConfig { name: "Android Studio", bin: "studio", mac_id: "com.google.android.studio" },
    IdeConfig { name: "Vim", bin: "vim", mac_id: "" }, // 纯命令行
    IdeConfig { name: "NeoVim", bin: "nvim", mac_id: "" }, // 纯命令行
];

pub fn probe_ides() -> Vec<ToolInfo> {
    IDES.par_iter().map(|cfg| check_ide(cfg)).collect()
}

fn check_ide(cfg: &IdeConfig) -> ToolInfo {
    // 1. 优先尝试命令行检测 (Linux/Windows/macOS 通用)
    // VSCode, Vim, Neovim 等通常在 PATH 中
    let mut info = common::generic_probe(cfg.name, cfg.bin, &["--version"], None);

    // Xcode 特殊处理
    if cfg.name == "Xcode" {
        if let Ok(out) = common::run_command("xcodebuild", &["-version"]) {
            // output: Xcode 14.2 \n Build version 14C18
            let ver = common::find_version(&out, None);
            if !ver.is_empty() {
                info.version = ver;
                info.path = common::locate_binary("xcodebuild");
            }
        }
    }

    // 2. 如果命令行没找到，且是在 macOS 上，尝试 Bundle ID 查找
    // 这对于 Android Studio, IntelliJ 这种通常不在 PATH 里的 GUI 程序很有用
    #[cfg(target_os = "macos")]
    if info.version == "Not Found" && !cfg.mac_id.is_empty() {
        if let Ok(app_path) = common::run_command("mdfind", &[&format!("kMDItemCFBundleIdentifier == '{}'", cfg.mac_id)]) {
            let first_path = app_path.lines().next().unwrap_or("").trim();
            if !first_path.is_empty() {
                info.path = Some(first_path.to_string());
                // 获取版本
                if let Ok(ver) = common::run_command("mdls", &["-name", "kMDItemShortVersionString", "-raw", first_path]) {
                     if !ver.is_empty() && ver != "(null)" {
                        info.version = ver;
                     }
                }
            }
        }
    }

    // 3. Windows 上的特殊路径检测 (IntelliJ, Android Studio)
    // 简略实现：对于 VSCode 等，通常 installer 会加 path，generic_probe 已覆盖。
    // 如果需要更深度的 Windows IDE 检测（如读取注册表查找 Visual Studio），可以在此扩展。
    #[cfg(target_os = "windows")]
    if info.version == "Not Found" {
        // Visual Studio 完整版通常需要 vswhere.exe，这里暂略，因为我们主要关注 Web 全栈
    }

    info
}