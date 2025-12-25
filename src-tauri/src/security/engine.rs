use serde::Serialize;
use regex::Regex;
use std::collections::HashSet;
use crate::security::rules::get_rules;
use crate::security::entropy::{shannon_entropy, is_uuid, is_git_sha};
use crate::security::stopwords::is_stop_word;

#[derive(Serialize, Clone, Debug)]
pub struct SecretMatch {
    pub kind: String,
    pub value: String,
    pub index: usize,
    pub risk_level: String 
}

/// 白名单值检查 (Value Allowlist)
fn is_safe_value(val: &str) -> bool {
    // 1. UUID / Git Hash
    if is_uuid(val) || is_git_sha(val) { return true; }
    
    // 2. 路径或URL (Gitleaks 通用规则通常不匹配 URL，但也防万一)
    if val.contains('/') || val.contains('\\') || val.starts_with("http") { return true; }
    
    // 3. CSS 颜色 / 版本号
    if val.starts_with('#') && (val.len() == 4 || val.len() == 7) { return true; }
    if val.contains('.') && val.chars().all(|c| c.is_numeric() || c == '.') { return true; } // 1.0.2

    // 4. 常见占位符
    let v_lower = val.to_lowercase();
    if v_lower.contains("example") || v_lower.contains("xxxx") || v_lower.contains("change") || v_lower.contains("todo") { return true; }

    false
}

/// 核心扫描函数
pub fn scan(content: &str) -> Vec<SecretMatch> {
    let rules = get_rules();
    let mut matches = Vec::new();
    let mut found_indices = HashSet::new();

    for rule in rules {
        // 编译正则 (实际项目中建议使用 lazy_static 缓存 Regex 实例，这里简化为每次调用编译)
        // 注意：Tauri Command 每次调用通常是在用户点击时触发，频次低，直接编译通常无性能瓶颈。
        // 如果追求极致，可以在 rules.rs 里直接返回 Regex 对象。
        if let Ok(re) = Regex::new(rule.pattern) {
            for caps in re.captures_iter(content) {
                // 获取核心 Value
                let val_match = caps.get(rule.secret_group).or_else(|| caps.get(0));
                
                if let Some(m) = val_match {
                    let val = m.as_str();
                    let start_pos = m.start();

                    // 1. 去重
                    if found_indices.contains(&start_pos) { continue; }

                    // 2. 针对 Generic Rule 的特殊清洗逻辑
                    if rule.id == "Generic Secret" {
                        // A. 提取 Key (Context)
                        // 我们需要看看到底是什么 Key 导致了匹配 (例如 "user_id" = "...")
                        // 方法：获取整个匹配字符串，减去 Value 部分，剩下的就是 Key 部分
                        let full_match = caps.get(0).unwrap(); // 肯定存在
                        let full_start = full_match.start();
                        
                        // key_part 是从匹配开始到 value 开始之前的内容
                        if start_pos > full_start {
                            let key_context = &content[full_start..start_pos];
                            
                            // 提取最后一个单词作为 Key
                            let key_word = key_context.split(|c: char| !c.is_alphanumeric() && c != '_')
                                .filter(|s| !s.is_empty())
                                .last()
                                .unwrap_or("");
                            
                            // B. 停用词检查 (Gitleaks 核心逻辑)
                            // 如果 Key 是 "id", "index", "class" 等，直接丢弃
                            if is_stop_word(key_word) {
                                continue;
                            }
                        }

                        // C. 白名单值检查
                        if is_safe_value(val) { continue; }

                        // D. 熵值检查
                        if rule.entropy > 0.0 {
                            if shannon_entropy(val) < rule.entropy {
                                continue;
                            }
                        }
                    }

                    // 命中!
                    matches.push(SecretMatch {
                        kind: rule.id.to_string(),
                        value: val.to_string(),
                        index: start_pos,
                        risk_level: "High".to_string()
                    });
                    
                    found_indices.insert(start_pos);
                }
            }
        }
    }

    // 排序
    matches.sort_by_key(|k| k.index);
    matches
}