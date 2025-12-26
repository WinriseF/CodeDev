use serde::Serialize;
use regex::Regex;
use once_cell::sync::Lazy;
use entropy::shannon_entropy;
use std::str;

// --- 1. 声明所有子模块 (注册文件) ---
pub mod allowlist;
pub mod rule; // 规则聚合器
// 注册具体的规则文件
pub mod rules_ai;
pub mod rules_cloud;
pub mod rules_communication;
pub mod rules_package;
pub mod rules_payment;
pub mod rules_remaining;

use allowlist::is_allowed_secret;
use rule::get_all_rules;

// --- 2. 定义 Rule 结构体 (供所有子模块使用) ---
#[derive(Debug, Clone)]
pub struct Rule {
    pub id: &'static str,
    pub description: &'static str,
    pub regex: Regex,
    pub entropy: Option<f64>,     
    pub keywords: &'static [&'static str],
}

#[derive(Serialize, Clone, Debug)]
pub struct SecretMatch {
    pub kind: String,        
    pub value: String,       
    pub index: usize,        
    pub risk_level: String,  
}

// --- 3. 扫描逻辑 ---
static RULES: Lazy<&'static [Rule]> = Lazy::new(|| get_all_rules());

pub fn scan_text(text: &str) -> Vec<SecretMatch> {
    let rules = *RULES;
    let mut matches: Vec<SecretMatch> = Vec::new();

    const FRAGMENT_SIZE: usize = 16 * 1024; 
    const OVERLAP: usize = 256; 
    let step = FRAGMENT_SIZE.saturating_sub(OVERLAP);
    let bytes = text.as_bytes();

    if bytes.len() <= FRAGMENT_SIZE {
        scan_fragment(text, 0, rules, &mut matches);
        return finalize_matches(matches);
    }

    let mut start = 0;
    while start < bytes.len() {
        let end = std::cmp::min(start + FRAGMENT_SIZE, bytes.len());
        let chunk = &bytes[start..end];

        match str::from_utf8(chunk) {
            Ok(fragment_str) => {
                scan_fragment(fragment_str, start, rules, &mut matches);
            }
            Err(e) => {
                let valid_up_to = e.valid_up_to();
                if valid_up_to == 0 && start + 4 < bytes.len() {
                    start += 1;
                    continue; 
                }
                let valid_chunk = &chunk[..valid_up_to];
                if let Ok(fragment_str) = str::from_utf8(valid_chunk) {
                    scan_fragment(fragment_str, start, rules, &mut matches);
                }
            }
        }

        if end == bytes.len() {
            break;
        }
        start += step;
    }

    finalize_matches(matches)
}

fn scan_fragment(fragment_str: &str, base_offset: usize, rules: &[Rule], matches: &mut Vec<SecretMatch>) {
    for rule in rules {
        if !rule.keywords.is_empty() && !rule.keywords.iter().any(|kw| fragment_str.contains(kw)) {
            continue;
        }

        for cap in rule.regex.captures_iter(fragment_str) {
            let m = cap.name("secret").or_else(|| cap.get(0));
            let Some(secret_match) = m else { continue };

            let secret = secret_match.as_str();
            
            if let Some(min_entropy) = rule.entropy {
                let ent = shannon_entropy(secret);
                if ent < min_entropy {
                    continue;
                }
            }

            if is_allowed_secret(secret) {
                continue;
            }

            let start_in_fragment = secret_match.start();
            let global_index = base_offset + start_in_fragment;

            matches.push(SecretMatch {
                kind: rule.id.to_string(),
                value: secret.to_string(),
                index: global_index,
                risk_level: "High".to_string(),
            });
        }
    }
}

fn finalize_matches(mut matches: Vec<SecretMatch>) -> Vec<SecretMatch> {
    matches.sort_by(|a, b| {
        a.index.cmp(&b.index).then_with(|| a.value.cmp(&b.value))
    });
    matches.dedup_by(|a, b| a.index == b.index && a.value == b.value);
    matches
}