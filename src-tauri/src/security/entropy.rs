/// 计算香农熵 (Shannon Entropy)
/// 衡量字符串的随机程度。
/// 范围：0.0 (所有字符相同) ~ 8.0 (所有字符不同且均匀分布)
pub fn shannon_entropy(s: &str) -> f64 {
    if s.is_empty() { return 0.0; }
    
    let mut map = std::collections::HashMap::new();
    for ch in s.chars() {
        *map.entry(ch).or_insert(0) += 1;
    }
    
    let len = s.chars().count() as f64;
    let mut entropy = 0.0;
    
    for &count in map.values() {
        let p = count as f64 / len;
        entropy -= p * p.log2();
    }
    
    entropy
}

/// 检查是否为 UUID
pub fn is_uuid(val: &str) -> bool {
    if val.len() != 36 { return false; }
    let hyphens = val.chars().filter(|c| *c == '-').count();
    if hyphens != 4 { return false; }
    // 简单检查字符集
    val.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// 检查是否为 Git SHA (40位 Hex)
pub fn is_git_sha(val: &str) -> bool {
    if val.len() != 40 { return false; }
    val.chars().all(|c| c.is_ascii_hexdigit())
}