use crate::env_probe::ToolInfo;
use serde_json::Value;
use std::fs;
use std::path::Path;

/// 扫描 NPM 包信息
/// logic: 读取根目录 package.json -> 获取 dependencies/devDependencies -> 查找 node_modules 下的版本
pub fn probe_npm_packages(project_root: Option<String>) -> Vec<ToolInfo> {
    let Some(root) = project_root else {
        return Vec::new();
    };

    let path = Path::new(&root);
    let package_json_path = path.join("package.json");

    if !package_json_path.exists() {
        return Vec::new();
    }

    // 1. 读取根 package.json
    let Ok(content) = fs::read_to_string(&package_json_path) else {
        return Vec::new();
    };
    let Ok(json): Result<Value, _> = serde_json::from_str(&content) else {
        return Vec::new();
    };

    // 2. 收集所有依赖名
    let mut deps = Vec::new();
    if let Some(d) = json["dependencies"].as_object() {
        deps.extend(d.keys().cloned());
    }
    if let Some(d) = json["devDependencies"].as_object() {
        deps.extend(d.keys().cloned());
    }

    if deps.is_empty() {
        return Vec::new();
    }

    // 3. 查找 node_modules 中的实际版本 (串行查找即可，因为文件 IO 很快且通常只有几十个顶层依赖)
    let mut results = Vec::new();
    
    // 关键优化：预先检查 node_modules 是否存在，避免无谓查找
    let node_modules = path.join("node_modules");
    if !node_modules.exists() {
        // 如果没有 node_modules，只返回名字，版本标记为 "Not Installed"
        for dep in deps {
            results.push(ToolInfo {
                name: dep,
                version: "Not Installed".to_string(),
                path: None,
                description: Some("Module not found".to_string()),
            });
        }
        return results;
    }

    for dep in deps {
        let dep_pkg_path = node_modules.join(&dep).join("package.json");
        let mut installed_version = "Not Found".to_string();
        
        if dep_pkg_path.exists() {
            if let Ok(dep_content) = fs::read_to_string(&dep_pkg_path) {
                if let Ok(dep_json) = serde_json::from_str::<Value>(&dep_content) {
                    if let Some(v) = dep_json["version"].as_str() {
                        installed_version = v.to_string();
                    }
                }
            }
        }

        results.push(ToolInfo {
            name: dep,
            version: installed_version,
            path: None, // 不需要返回具体 path，太冗长
            description: None,
        });
    }

    // 按名称排序
    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}