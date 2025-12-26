use serde::Serialize;
use regex::Regex;
use once_cell::sync::Lazy;
use entropy::shannon_entropy;
use std::str;
use rayon::prelude::*;

pub mod allowlist;
pub mod rule;
pub mod rules_ai;
pub mod rules_cloud;
pub mod rules_communication;
pub mod rules_package;
pub mod rules_payment;
pub mod rules_remaining;

use allowlist::is_safe_value;
use rule::get_all_rules;

#[derive(Debug, Clone)]
pub struct Rule {
    pub id: &'static str,
    #[allow(dead_code)]
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
    // --- 上下文信息 ---
    pub line_number: usize,        // 敏感信息所在的行号
    pub snippet: String,           // 代码片段
    pub snippet_start_line: usize, // 新增：代码片段的第一行是第几行
}

static RULES: Lazy<&'static [Rule]> = Lazy::new(|| get_all_rules());

pub fn scan_text(text: &str) -> Vec<SecretMatch> {
    let rules = *RULES;
    
    const FRAGMENT_SIZE: usize = 16 * 1024;
    const OVERLAP: usize = 512;
    let step = FRAGMENT_SIZE.saturating_sub(OVERLAP);
    let bytes = text.as_bytes();
    let total_len = bytes.len();

    if total_len <= FRAGMENT_SIZE {
        let mut matches = Vec::new();
        scan_fragment(text, 0, rules, &mut matches);
        let mut final_matches = finalize_matches(matches);
        for m in &mut final_matches {
            enrich_context(text, m);
        }
        return final_matches;
    }

    let chunk_starts: Vec<usize> = (0..total_len).step_by(step).collect();

    let matches: Vec<SecretMatch> = chunk_starts.par_iter()
        .flat_map(|&start| {
            let end = std::cmp::min(start + FRAGMENT_SIZE, total_len);
            let chunk = &bytes[start..end];
            let mut local_matches = Vec::new();

            match str::from_utf8(chunk) {
                Ok(fragment_str) => {
                    scan_fragment(fragment_str, start, rules, &mut local_matches);
                }
                Err(e) => {
                    let valid_up_to = e.valid_up_to();
                    if valid_up_to == 0 && start + 4 < total_len {
                        if let Ok(sub_str) = str::from_utf8(&chunk[1..]) {
                             scan_fragment(sub_str, start + 1, rules, &mut local_matches);
                        }
                    } else {
                        let valid_chunk = &chunk[..valid_up_to];
                        if let Ok(fragment_str) = str::from_utf8(valid_chunk) {
                            scan_fragment(fragment_str, start, rules, &mut local_matches);
                        }
                    }
                }
            }
            local_matches
        })
        .collect();

    let mut unique_matches = finalize_matches(matches);

    for m in &mut unique_matches {
        enrich_context(text, m);
    }

    unique_matches
}

// 填充上下文信息
fn enrich_context(full_text: &str, m: &mut SecretMatch) {
    // 1. 计算敏感信息所在的行号
    let pre_match_bytes = &full_text.as_bytes()[..m.index];
    let match_line_num = pre_match_bytes.iter().filter(|&&b| b == b'\n').count() + 1;
    m.line_number = match_line_num;

    // 2. 截取上下文
    let match_line_start = full_text[..m.index].rfind('\n').map(|i| i + 1).unwrap_or(0);
    
    // 向前找2行
    let mut snippet_start = match_line_start;
    let mut lines_back = 0; // 记录实际回溯了多少行
    for _ in 0..2 {
        if snippet_start == 0 { break; }
        let search_limit = snippet_start.saturating_sub(1);
        snippet_start = full_text[..search_limit].rfind('\n').map(|i| i + 1).unwrap_or(0);
        lines_back += 1;
    }
    
    // 计算片段起始行号
    m.snippet_start_line = match_line_num - lines_back;

    // 向后找2行
    let match_end = m.index + m.value.len();
    let mut snippet_end = match_end;
    for _ in 0..3 { 
        if let Some(next_nl) = full_text[snippet_end..].find('\n') {
            snippet_end += next_nl + 1;
        } else {
            snippet_end = full_text.len();
            break;
        }
    }

    m.snippet = full_text[snippet_start..snippet_end].trim_end().to_string();
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
            
            if is_safe_value(secret) {
                continue;
            }

            if let Some(min_entropy) = rule.entropy {
                let ent = shannon_entropy(secret);
                if (ent as f64) < min_entropy {
                    continue;
                }
            }

            let start_in_fragment = secret_match.start();
            let global_index = base_offset + start_in_fragment;

            matches.push(SecretMatch {
                kind: rule.id.to_string(),
                value: secret.to_string(),
                index: global_index,
                risk_level: "High".to_string(),
                line_number: 0,
                snippet: String::new(),
                snippet_start_line: 0, // 初始化
            });
        }
    }
}

fn finalize_matches(mut matches: Vec<SecretMatch>) -> Vec<SecretMatch> {
    if matches.is_empty() { return matches; }

    matches.sort_by(|a, b| {
        a.index.cmp(&b.index).then_with(|| b.value.len().cmp(&a.value.len())) 
    });

    let mut unique_matches = Vec::new();
    let mut last_end = 0;

    for m in matches {
        let start = m.index;
        let len = m.value.len();
        let end = start + len;

        if start < last_end {
            continue;
        }

        last_end = end;
        unique_matches.push(m);
    }

    unique_matches
}