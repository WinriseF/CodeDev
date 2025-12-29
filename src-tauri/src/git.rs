use chrono::{DateTime, Local};
use git2::{Delta, DiffFormat, DiffOptions, Oid, Repository};
use serde::{Deserialize, Serialize};

// =================================================================
// Git 数据结构定义
// =================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitDiffFile {
    pub path: String,
    pub status: String,
    pub old_path: Option<String>,
    pub original_content: String,
    pub modified_content: String,
    pub is_binary: bool,
    pub is_large: bool,
}

// =================================================================
// Git 核心命令 (使用 git2)
// =================================================================

#[tauri::command]
pub fn get_git_commits(project_path: String) -> Result<Vec<GitCommit>, String> {
    // 打开仓库
    let repo = Repository::open(&project_path).map_err(|e| format!("无法打开 Git 仓库: {}", e))?;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("无法读取历史记录: {}", e))?;

    // 从 HEAD 开始遍历
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }

    // 按时间倒序排序
    revwalk.set_sorting(git2::Sort::TIME).unwrap_or(());

    let mut commits = Vec::new();

    for id in revwalk {
        let oid = id.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let time = commit.time();
        let dt = DateTime::from_timestamp(time.seconds(), 0).unwrap_or_default();
        let date_str = dt
            .with_timezone(&Local)
            .format("%Y-%m-%d %H:%M")
            .to_string();

        commits.push(GitCommit {
            hash: oid.to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            date: date_str,
            message: commit.summary().unwrap_or("").to_string(),
        });

        if commits.len() >= 50 {
            break;
        }
    }

    Ok(commits)
}

#[tauri::command]
pub fn get_git_diff(
    project_path: String,
    old_hash: String,
    new_hash: String,
) -> Result<Vec<GitDiffFile>, String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    // 解析 Commit Hash
    let old_oid = Oid::from_str(&old_hash).map_err(|e| format!("Invalid old hash: {}", e))?;
    let new_oid = Oid::from_str(&new_hash).map_err(|e| format!("Invalid new hash: {}", e))?;

    let old_commit = repo.find_commit(old_oid).map_err(|e| e.to_string())?;
    let new_commit = repo.find_commit(new_oid).map_err(|e| e.to_string())?;

    let old_tree = old_commit.tree().map_err(|e| e.to_string())?;
    let new_tree = new_commit.tree().map_err(|e| e.to_string())?;

    // 比较两棵树
    let mut diff_opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(Some(&old_tree), Some(&new_tree), Some(&mut diff_opts))
        .map_err(|e| format!("Diff generation failed: {}", e))?;

    let mut files: Vec<GitDiffFile> = Vec::new();
    const MAX_SIZE: usize = 2 * 1024 * 1024; // 2MB 限制

    // 遍历每一个变更的文件 (Delta)
    for delta in diff.deltas() {
        let old_file = delta.old_file();
        let new_file = delta.new_file();

        let file_path = new_file.path().or(old_file.path()).unwrap();
        let path_str = file_path.to_string_lossy().to_string();

        let status = match delta.status() {
            Delta::Added => "Added",
            Delta::Deleted => "Deleted",
            Delta::Modified => "Modified",
            Delta::Renamed => "Renamed",
            _ => "Modified",
        };

        // 辅助闭包：读取 Blob 并判断属性
        let read_blob_content = |id: git2::Oid| -> (String, bool, bool) {
            if id.is_zero() {
                return (String::new(), false, false);
            }

            match repo.find_blob(id) {
                Ok(blob) => {
                    let is_binary = blob.is_binary();
                    let is_large = blob.size() > MAX_SIZE;

                    let content = if is_binary {
                        "[Binary File Omitted]".to_string()
                    } else if is_large {
                        format!("[File Too Large: {} bytes]", blob.size())
                    } else {
                        String::from_utf8_lossy(blob.content()).to_string()
                    };

                    (content, is_binary, is_large)
                }
                Err(_) => (String::new(), false, false),
            }
        };

        // 获取原始内容及属性
        let (original_content, old_binary, old_large) = read_blob_content(old_file.id());

        // 获取修改后内容及属性
        let (modified_content, new_binary, new_large) = read_blob_content(new_file.id());

        // 只要任一版本是二进制或大文件，就标记该文件
        let is_binary = old_binary || new_binary;
        let is_large = old_large || new_large;

        files.push(GitDiffFile {
            path: path_str,
            status: status.to_string(),
            old_path: if delta.status() == Delta::Renamed {
                Some(
                    old_file
                        .path()
                        .unwrap()
                        .to_string_lossy()
                        .to_string(),
                )
            } else {
                None
            },
            original_content,
            modified_content,
            is_binary,
            is_large,
        });
    }

    Ok(files)
}

#[tauri::command]
pub fn get_git_diff_text(
    project_path: String,
    old_hash: String,
    new_hash: String,
) -> Result<String, String> {
    let repo = Repository::open(&project_path).map_err(|e| format!("Failed to open repo: {}", e))?;

    let old_oid = Oid::from_str(&old_hash).map_err(|e| e.to_string())?;
    let new_oid = Oid::from_str(&new_hash).map_err(|e| e.to_string())?;

    let old_tree = repo
        .find_commit(old_oid)
        .and_then(|c| c.tree())
        .map_err(|e| e.to_string())?;
    let new_tree = repo
        .find_commit(new_oid)
        .and_then(|c| c.tree())
        .map_err(|e| e.to_string())?;

    let diff = repo
        .diff_tree_to_tree(Some(&old_tree), Some(&new_tree), None)
        .map_err(|e| e.to_string())?;

    let mut diff_buf = Vec::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        match origin {
            '+' | '-' | ' ' => {
                diff_buf.push(origin as u8);
                diff_buf.extend_from_slice(line.content());
            }
            _ => {
                diff_buf.extend_from_slice(line.content());
            }
        }
        true
    })
    .map_err(|e| format!("Failed to print diff: {}", e))?;

    Ok(String::from_utf8_lossy(&diff_buf).to_string())
}