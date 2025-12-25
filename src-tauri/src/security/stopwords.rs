use std::collections::HashSet;
use std::sync::OnceLock;

/// 移植自 Gitleaks: cmd/generate/config/rules/stopwords.go
/// 这些词如果是变量名的一部分，通常意味着它不是一个敏感信息。
pub fn is_stop_word(token: &str) -> bool {
    static STOP_WORDS: OnceLock<HashSet<&'static str>> = OnceLock::new();
    let set = STOP_WORDS.get_or_init(|| {
        HashSet::from([
            "000000", "aaaaaa", "about", "abstract", "academy", "acces", "account", "action", "active", "activity", 
            "adapter", "add", "addon", "address", "admin", "adobe", "advanced", "agent", "agile", "ajax", "alert", 
            "algorithm", "all", "alpha", "amazon", "analytics", "android", "angular", "animation", "ansible", 
            "answer", "any", "apache", "app", "apple", "archive", "array", "article", "asset", "async", "atom", 
            "audio", "audit", "auth", "author", "auto", "awesome", "aws", "azure", "back", "backend", "backup", 
            "base", "bash", "basic", "batch", "beta", "binary", "binding", "bit", "block", "blog", "board", "book", 
            "boot", "bot", "box", "branch", "bridge", "browser", "buffer", "bug", "build", "builder", "bundle", 
            "business", "button", "cache", "calendar", "call", "camera", "campaign", "can", "canvas", "captcha", 
            "card", "case", "category", "center", "change", "changelog", "channel", "chart", "chat", "check", 
            "chef", "chrome", "class", "classic", "clean", "cli", "client", "clone", "cloud", "cluster", "cms", 
            "code", "color", "com", "command", "comment", "commit", "common", "community", "compiler", "complete", 
            "component", "composer", "compute", "config", "connect", "console", "contact", "container", "content", 
            "context", "control", "convert", "cookie", "copy", "core", "count", "country", "course", "create", 
            "created", "creator", "credential", "css", "cursor", "custom", "cycle", "data", "database", "date", 
            "day", "debug", "default", "define", "delete", "demo", "deploy", "desc", "description", "design", 
            "desktop", "destroy", "detail", "dev", "device", "diff", "dir", "directory", "disable", "display", 
            "dist", "doc", "docker", "domain", "done", "download", "draft", "draw", "drive", "driver", "drop", 
            "dummy", "dump", "dynamic", "edit", "editor", "element", "email", "empty", "enable", "end", "engine", 
            "entry", "env", "environment", "error", "event", "example", "exception", "exec", "exit", "expect", 
            "export", "extension", "external", "extra", "face", "fail", "fake", "false", "family", "feature", 
            "feed", "file", "filter", "final", "find", "finish", "fire", "first", "fix", "flag", "flash", "float", 
            "folder", "font", "footer", "force", "form", "format", "forum", "found", "frame", "free", "from", 
            "front", "full", "func", "function", "game", "gateway", "general", "generate", "generator", "get", 
            "git", "global", "go", "google", "grade", "grant", "graph", "grid", "group", "guard", "guest", "guide", 
            "handle", "handler", "hash", "head", "header", "height", "hello", "help", "helper", "hero", "hide", 
            "high", "history", "home", "hook", "host", "hosting", "hour", "href", "html", "http", "https", "icon", 
            "id", "idea", "image", "import", "index", "info", "init", "inline", "input", "insert", "instance", 
            "int", "integer", "interface", "internal", "intro", "invalid", "ios", "ip", "issue", "item", "java", 
            "javascript", "job", "join", "js", "json", "jump", "keep", "key", "keyword", "kind", "label", "lab", 
            "lang", "language", "large", "last", "layer", "layout", "left", "legacy", "legal", "level", "lib", 
            "library", "license", "life", "light", "like", "limit", "line", "link", "linux", "list", "live", 
            "load", "loader", "local", "locale", "lock", "log", "login", "logo", "logout", "long", "loop", "love", 
            "low", "mac", "mail", "main", "make", "manager", "map", "mark", "market", "master", "match", "math", 
            "matrix", "max", "media", "member", "memo", "memory", "menu", "message", "meta", "method", "metric", 
            "middle", "min", "mind", "mine", "mini", "misc", "mobile", "mock", "mode", "model", "module", "money", 
            "month", "more", "motion", "mount", "mouse", "move", "movie", "music", "my", "name", "nav", "net", 
            "network", "new", "news", "next", "nil", "no", "node", "none", "normal", "note", "notice", "now", 
            "npm", "null", "number", "object", "off", "offer", "office", "official", "old", "on", "one", "online", 
            "only", "open", "option", "order", "org", "origin", "original", "other", "out", "output", "over", 
            "owner", "pack", "package", "page", "paint", "panel", "paper", "param", "parent", "parse", "parser", 
            "part", "partner", "party", "pass", "password", "paste", "path", "pattern", "pause", "pay", "payment", 
            "pdf", "people", "perform", "person", "phone", "photo", "php", "picker", "picture", "piece", "ping", 
            "pixel", "place", "plan", "plane", "platform", "play", "player", "plugin", "point", "policy", "poll", 
            "pool", "pop", "port", "portal", "post", "poster", "power", "press", "prev", "price", "print", 
            "privacy", "private", "pro", "process", "product", "profile", "program", "progress", "project", "promo", 
            "prop", "property", "proto", "public", "pull", "push", "python", "query", "queue", "quick", "quit", 
            "quote", "radio", "random", "range", "rank", "rate", "raw", "react", "read", "reader", "ready", "real", 
            "reason", "record", "rect", "ref", "refresh", "regex", "region", "register", "registry", "regular", 
            "remote", "remove", "render", "repeat", "replace", "reply", "report", "request", "require", "reset", 
            "result", "return", "review", "right", "role", "root", "route", "router", "row", "rss", "ruby", "rule", 
            "run", "safe", "sale", "salt", "sample", "save", "scale", "scan", "scene", "schema", "score", "screen", 
            "script", "scroll", "search", "second", "secret", "section", "secure", "security", "seed", "select", 
            "self", "sell", "send", "sensor", "server", "service", "session", "set", "setting", "setup", "share", 
            "sheet", "shell", "shift", "shop", "short", "show", "side", "sign", "simple", "single", "site", "size", 
            "skip", "slide", "small", "smart", "social", "socket", "soft", "solid", "sort", "sound", "source", 
            "space", "spam", "span", "spec", "special", "speed", "split", "sql", "src", "stack", "stage", "stand", 
            "standard", "start", "state", "static", "stat", "status", "step", "stop", "store", "stream", "string", 
            "struct", "style", "sub", "subject", "submit", "success", "sum", "summary", "super", "support", "svg", 
            "switch", "sync", "sys", "system", "tab", "table", "tag", "target", "task", "team", "temp", "template", 
            "term", "test", "text", "theme", "thread", "thumb", "time", "timeout", "timer", "title", "tmp", "to", 
            "todo", "toggle", "token", "tool", "top", "topic", "total", "touch", "tour", "track", "trade", 
            "traffic", "train", "transfer", "transform", "trash", "tree", "trend", "trial", "trigger", "true", 
            "trust", "try", "tweet", "twitter", "type", "unit", "unix", "unknown", "update", "upload", "url", 
            "usage", "use", "user", "username", "util", "uuid", "valid", "value", "var", "variable", "vendor", 
            "version", "video", "view", "viewer", "visit", "void", "volume", "vote", "wait", "walk", "wall", "warn", 
            "warning", "watch", "wave", "way", "web", "week", "weight", "welcome", "widget", "width", "wiki", "win", 
            "window", "wire", "word", "work", "worker", "world", "write", "writer", "www", "xml", "yaml", "year", 
            "yes", "zip", "zone", "zoom"
        ])
    });

    let k = token.to_lowercase();
    
    // 1. 完全匹配
    if set.contains(k.as_str()) {
        // 特殊处理：password 和 secret 即使在停用词表中，也需要谨慎
        // Gitleaks 的 stopwords 包含了 password/secret，这意味着
        // 如果变量名 *只是* "password" 或 "secret"，它可能被认为太通用？
        // 不，Gitleaks 的逻辑是：如果一个规则的关键词匹配到了 "password"，
        // 但 "password" 在 stopwords 里，它会被过滤。
        // 但 Gitleaks 的 Generic 规则并没有把 "password" 放入 stopwords。
        // 这里我们做一个微调：如果 token 包含 password/secret/key/token，则不算 stop word。
        if k.contains("password") || k.contains("secret") || k.contains("key") || k.contains("token") || k.contains("auth") {
            return false;
        }
        return true;
    }

    // 2. 启发式后缀匹配 (例如 my_class, row_index)
    // 许多代码生成器会生成 xxx_id, xxx_index
    if k.ends_with("_id") || k.ends_with("index") || k.ends_with("count") || k.ends_with("uuid") || k.ends_with("md5") || k.ends_with("sha") {
        return true;
    }
    
    false
}