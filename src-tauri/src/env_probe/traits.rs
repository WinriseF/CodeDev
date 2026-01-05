use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::any::Any;
use super::ToolInfo;

/// 定义最大读取字节数 (50KB)，用于性能熔断
const MAX_READ_SIZE: u64 = 50 * 1024;

/// 通用项目扫描接口
pub trait ProjectScanner: Send + Sync + Any {
    /// 1. 身份识别：检查当前目录是否包含该语言的特征文件
    /// 返回 true 表示命中，需要进一步扫描
    fn match_identity(&self, root: &str) -> bool;

    /// 2. 获取运行时版本 (e.g. `java -version`, `go version`)
    fn detect_toolchain(&self) -> Option<ToolInfo>;

    /// 3. 解析依赖文件 (e.g. `pom.xml`, `package.json`)
    /// 应该返回关键依赖的 名称 -> 版本 映射
    fn parse_dependencies(&self, root: &str) -> HashMap<String, String>;
}

/// 避免读取整个大文件，只读取前 50KB 用于特征/依赖匹配
pub fn read_file_head(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }

    if let Ok(mut file) = File::open(path) {
        let len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let read_len = std::cmp::min(len, MAX_READ_SIZE) as usize;
        let mut buffer = vec![0u8; read_len];
        if file.read_exact(&mut buffer).is_ok() {
            return Some(String::from_utf8_lossy(&buffer).to_string());
        }
        let _ = file.seek(SeekFrom::Start(0));
        let mut fallback_buffer = Vec::new();
        if file.take(MAX_READ_SIZE).read_to_end(&mut fallback_buffer).is_ok() {
             return Some(String::from_utf8_lossy(&fallback_buffer).to_string());
        }
    }
    None
}