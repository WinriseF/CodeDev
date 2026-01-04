use std::path::Path;
use super::ProjectType;

/// 快速识别项目类型
/// 不读取文件内容，仅检查文件/目录是否存在，确保性能
pub fn detect_project_type(root: &str) -> ProjectType {
    let path = Path::new(root);

    // 1. 优先检查 Tauri (特征最明显)
    // Tauri 项目通常有 src-tauri 目录和 tauri.conf.json
    let has_tauri_dir = path.join("src-tauri").exists();
    let has_tauri_conf = path.join("src-tauri").join("tauri.conf.json").exists() 
        || path.join("src-tauri").join("tauri.conf.json5").exists(); // v2 支持 json5

    if has_tauri_dir && has_tauri_conf {
        return ProjectType::Tauri;
    }

    // 2. 检查 Node.js 生态
    let has_package_json = path.join("package.json").exists();
    
    // 3. 检查 Rust 生态
    let has_cargo_toml = path.join("Cargo.toml").exists();

    // 4. 检查 Python 生态
    let has_requirements = path.join("requirements.txt").exists();
    let has_pyproject = path.join("pyproject.toml").exists();
    let has_python = has_requirements || has_pyproject;

    // 判定逻辑
    if has_package_json {
        if has_cargo_toml {
            // 既有 package.json 又有 Cargo.toml，且不是 Tauri
            // 可能是使用了 Rust 插件的前端项目，或者是混合 Monorepo
            return ProjectType::Mixed; 
        }
        
        // 进一步粗略区分前端还是后端？
        // 这里为了性能暂不读取文件内容，后续在 scan 阶段细化
        // 只要有 package.json，先归类为 NodeFrontend (最常见)
        return ProjectType::NodeFrontend;
    }

    if has_cargo_toml {
        return ProjectType::Rust;
    }

    if has_python {
        return ProjectType::Python;
    }

    ProjectType::Mixed
}