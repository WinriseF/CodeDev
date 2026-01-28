-- V2__add_memos_and_files.sql
-- 添加 Memos 和 File Transfers 功能

-- Memos 表：备忘录/便签功能
CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    tags TEXT,
    resources TEXT,
    is_archived INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- File Transfers 表：文件传输记录
CREATE TABLE IF NOT EXISTS file_transfers (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
