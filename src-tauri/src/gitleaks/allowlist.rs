// src/allowlist.rs

use regex::Regex;
use once_cell::sync::Lazy;

static ALLOW_REGEXES: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        // 布尔值、null
        Regex::new(r"(?i)^true|false|null$").unwrap(),
        // 重复字符占位符（如 ********、aaaaaa）
        Regex::new(r"(?i)^([a-z*\\.])+$").unwrap(),
        // 环境变量占位符
        Regex::new(r"^\$(?:\d+|{\d+})$").unwrap(),
        Regex::new(r"^\$(?:[A-Z_]+|[a-z_]+)$").unwrap(),
        Regex::new(r"^\${(?:[A-Z_]+|[a-z_]+)}$").unwrap(),
        // Ansible/Jinja2 插值
        Regex::new(r"^\{\{[ \t]*[\w ().|]+[ \t]*}}$").unwrap(),
        // GitHub Actions 插值
        Regex::new(r"^\$\{\{[ \t]*(?:env|github|secrets|vars)(?:\.[A-Za-z]\w+)+[\w "'&./=|]*[ \t]*}}$").unwrap(),
        // NuGet 环境变量
        Regex::new(r"^%(?:[A-Z_]+|[a-z_]+)%$").unwrap(),
        // Python/Golang 格式化占位符
        Regex::new(r"^%[+\-# 0]?[bcdeEfFgGoOpqstTUvxX]$").unwrap(),
        Regex::new(r"^\{\d{0,2}}$").unwrap(),
        // UCD 占位符
        Regex::new(r"^@(?:[A-Z_]+|[a-z_]+)@$").unwrap(),
        // 常见路径误报
        Regex::new(r"^/Users/(?i)[a-z0-9]+/[\w .-/]+$").unwrap(),
        Regex::new(r"^/(?:bin|etc|home|opt|tmp|usr|var)/[\w ./-]+$").unwrap(),
    ]
});

static ALLOW_PATHS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"gitleaks\.toml").unwrap(),
        Regex::new(r"(?i)\.(?:bmp|gif|jpe?g|png|svg|tiff?)$").unwrap(),
        Regex::new(r"(?i)\.(?:eot|[ot]tf|woff2?)$").unwrap(),
        Regex::new(r"(?i)\.(?:docx?|xlsx?|pdf|bin|socket|vsidx|v2|suo|wsuo|.dll|pdb|exe|gltf)$").unwrap(),
        Regex::new(r"go\.(?:mod|sum|work(?:\.sum)?)$").unwrap(),
        Regex::new(r"(?:^|/)vendor/modules\.txt$").unwrap(),
        Regex::new(r"(?:^|/)node_modules(?:/.*)?$").unwrap(),
        Regex::new(r"(?:^|/)(?:deno\.lock|npm-shrinkwrap\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$").unwrap(),
        Regex::new(r"(?:^|/)(?:Pipfile|poetry)\.lock$").unwrap(),
        Regex::new(r"(?i)(?:^|/)(?:v?env|virtualenv)/lib(?:64)?(?:/.*)?$").unwrap(),
    ]
});

pub fn is_allowed_secret(secret: &str) -> bool {
    ALLOW_REGEXES.iter().any(|re| re.is_match(secret))
}

// 注意：路径过滤在你的场景中不需要（纯文本），但保留函数供未来扩展
pub fn is_allowed_path(_path: &str) -> bool {
    false // 纯文本扫描时不使用路径过滤
}