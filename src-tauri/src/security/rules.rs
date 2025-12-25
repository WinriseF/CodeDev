use std::sync::OnceLock;

pub struct Rule {
    pub id: &'static str,
    pub pattern: &'static str,
    pub entropy: f64,        // 最小熵值要求 (0.0 表示不检查)
    pub secret_group: usize, // 正则捕获组索引 (0=全匹配, 1=第一个括号)
}

/// 获取规则列表
/// 移植自 Gitleaks 默认配置
pub fn get_rules() -> &'static Vec<Rule> {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| vec![
        // --- 1. Cloud Providers (High Confidence) ---
        Rule { 
            id: "AWS Access Key", 
            pattern: r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
            entropy: 0.0,
            secret_group: 0 
        },
        Rule {
            id: "Google API Key",
            pattern: r"AIza[0-9A-Za-z\\-_]{35}",
            entropy: 0.0,
            secret_group: 0
        },
        Rule {
            id: "GitHub Token",
            pattern: r"(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}",
            entropy: 0.0,
            secret_group: 0
        },
        Rule {
            id: "Slack Token",
            pattern: r"xox[baprs]-([0-9a-zA-Z]{10,48})",
            entropy: 0.0,
            secret_group: 0
        },
        Rule {
            id: "Stripe Secret",
            pattern: r"(sk|rk)_(test|live)_[0-9a-zA-Z]{24}",
            entropy: 0.0,
            secret_group: 0
        },
        Rule { 
            id: "Private Key", 
            pattern: r"-----BEGIN ((EC|PGP|DSA|RSA|OPENSSH) )?PRIVATE KEY( BLOCK)?-----",
            entropy: 0.0,
            secret_group: 0 
        },

        // --- 2. Generic Rule (The "God" Regex from Gitleaks) ---
        // 这是一个极度复杂的正则，用于捕获所有 "key = value" 结构
        // Group 1 是 Value
        Rule {
            id: "Generic Secret",
            // 来源: gitleaks/cmd/generate/config/rules/generic.go
            // 解释：
            // 1. 关键词: (key|api|token|secret|password...)
            // 2. 间隔: 允许空格、引号、点号
            // 3. 赋值: (=|:|:=|=>|->)
            // 4. 前缀: 允许引号、空格
            // 5. Value (Group 1): [0-9a-z\-_.=]{10,150} -> Base64/Hex 字符集
            pattern: r#"(?i)(?:key|api|token|secret|client|passwd|password|auth|access)(?:[0-9a-z\-_\t .]{0,20})(?:[\s|']|[\s|"]){0,3}(?:=|>|:{1,3}=|\|\|:|<=|=>|:|\?=)(?:'|\"|\s|=|\x60){0,5}([0-9a-z\-_.=]{10,150})(?:['|\"|\n|\r|\s|\x60|;]|$)"#,
            entropy: 3.5, // Gitleaks 标准阈值
            secret_group: 1
        },
    ])
}