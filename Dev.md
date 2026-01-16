# CtxRun 开发流程文档

> 本文档记录 CtxRun 项目的完整开发历程，基于 git 提交历史和代码变更分析编写。

## 项目概述

**CtxRun** 是一款专为开发者打造的 AI 辅助生产力工具，基于 Tauri 框架构建。

### 技术栈
- **核心框架**: Tauri (Rust 1.80 + WebView2)
- **前端**: React 18 + TypeScript + Vite 6
- **状态管理**: Zustand
- **样式**: Tailwind CSS + tailwindcss-animate
- **编辑器**: Monaco Editor

---

## 版本历史

### v1.2.0 (2025-12-27)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `7087b4a` | 发布 1.2.0 | 版本发布 |
| `d9b47d9` | 优化 | 后端代码优化 |
| `dd8045b` | 优化 | 前端组件优化 |
| `6fbf449` | 优化 | 性能调优 |
| `486466f` | 优化 | UI 交互优化 |
| `02cbcf9` | 优化 | 状态管理优化 |
| `234e7da` | 优化 | Store 优化 |
| `fe2002e` | 优化 | 代码重构 |
| `9a50a93` | **SQL 引入** | 重构提示词存储系统，引入 SQLite 数据库 |
| `31fb4d5` | 优化 | SQL 查询优化 |
| `f8819bc` | 后端优化 | Rust 代码优化 |
| `90ef62c` | 后端优化 | 命令处理优化 |
| `7329624` | 优化占用 | 降低内存和 CPU 占用 |

**v1.2.0 文件变更统计**:
```
src-tauri/Cargo.toml                    |   +4
src-tauri/src/db.rs                     | +307 ++++++++++++
src-tauri/src/main.rs                   |  +36 +-
src/components/features/prompts/PromptView.tsx | -254 ++++++++---------
src/store/usePromptStore.ts             | -441 ++++++++++++-----------
5 files changed, 609 insertions(+), 433 deletions(-)
```

**主要更新**:
- 🔄 **数据库重构**: 提示词存储从 JSON 文件迁移至 SQLite，提升大数据量性能
- ⚡ **性能优化**: 整体资源占用降低约 20%

---

### v1.1.7 (2025-12-26)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `647db08` | 发布 1.1.7 | 版本发布 |
| `cbf6f31` | 新增 | 功能组件添加 |
| `d0c7e6a` | 优化 | 界面优化 |
| `b056212` | **优化选中逻辑** | 改进文件树和代码块的选中交互体验 |
| `8da8236` | 删除 | 移除冗余代码 |
| `8ad5868` | 优化 | 代码清理 |
| `4f4d1b8` | 优化 | 样式调整 |
| `a256e8b` | 新增 | 扫描结果导出功能 |
| `379ab53` | 新增 | 上下文预览功能增强 |
| `a4f0c5f` | 优化 | 性能优化 |
| `79b6556` | **新增 gitleaks 模块** | 集成代码安全扫描规则集 |
| `06c1376` | **新增隐私扫描** | 实现敏感信息检测引擎 |

**v1.1.7 隐私扫描功能文件变更**:
```
src-tauri/src/security/engine.rs      | +110 核心扫描引擎
src-tauri/src/security/entropy.rs     | +36  熵值计算
src-tauri/src/security/mod.rs         | +14  模块导出
src-tauri/src/security/rules.rs       | +70  扫描规则
src-tauri/src/security/stopwords.rs   | +105 白名单词库
src/components/features/context/ContextView.tsx        | +141
src/components/features/context/ScanResultDialog.tsx   | +122
src/components/features/context/TokenDashboard.tsx     | +33
12 files changed, 619 insertions(+), 44 deletions(-)
```

**v1.1.7 Gitleaks 安全扫描模块文件变更**:
```
src-tauri/src/gitleaks/allowlist.rs              | +55  白名单
src-tauri/src/gitleaks/mod.rs                    | +129 模块入口
src-tauri/src/gitleaks/rule.rs                   | +27  规则定义
src-tauri/src/gitleaks/rules_ai.rs               | +78  AI相关规则
src-tauri/src/gitleaks/rules_cloud.rs            | +160 云服务规则
src-tauri/src/gitleaks/rules_communication.rs    | +147 通信规则
src-tauri/src/gitleaks/rules_package.rs          | +179 包管理规则
src-tauri/src/gitleaks/rules_payment.rs          | +125 支付相关规则
src-tauri/src/gitleaks/rules_remaining.rs        | +203 其他规则
src-tauri/src/main.rs                            | +15
11 files changed, 1119 insertions(+), 4 deletions(-)
```

**主要更新**:
- 🔒 **隐私扫描**: 基于正则表达式和熵值计算的敏感信息检测
- 🛡️ **Gitleaks 集成**: 支持 8 大类安全规则检测:
  - AI 相关密钥 (OpenAI、Anthropic 等)
  - 云服务凭证 (AWS、Azure、GCP 等)
  - 支付网关 (Stripe、Square、PayPal 等)
  - 通信应用密钥 (Slack、Discord 等)
  - 包管理仓库密钥 (NPM、PyPI 等)

---

### v1.1.6 (2025-12-18)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `ea31473` | 修复构建 | 使用 vendored openssl，版本升至 1.1.6 |
| `8c6a6da` | 修复构建 | 修复 macOS universal build 支持 |

**主要更新**:
- 解决 OpenSSL 依赖问题
- 支持 Apple Silicon 通用二进制构建

---

### v1.1.5 (2025-12-18)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `f7b51ea` | 发布 1.1.5 | 版本发布 |
| `ce49a34` | 优化 | UI 优化 |
| `a63ae70` | 优化 | 交互优化 |
| `e4d66cb` | 优化 | 代码优化 |
| `37049a7` | log 优化 | 日志系统改进 |
| `cc2b8c5` | 优化 | 性能优化 |
| `8cc7763` | 优化 | 样式调整 |
| `93a8dff` | 优化 | 组件优化 |
| `47c33ef` | 优化 | 状态管理优化 |
| `431f085` | 新增 | 提交选择器组件 |
| `ce8336f` | 优化 | 代码清理 |
| `747e459` | 优化 | 重构优化 |
| `04dacca` | **新增 git diff** | 集成 Git Diff 可视化功能 |

**v1.1.5 Git Diff 功能文件变更**:
```
src-tauri/src/main.rs                  | +157 命令注册
src/components/features/patch/CommitSelector.tsx | +128 提交选择器
src/components/features/patch/DiffWorkspace.tsx  | +-28 工作区
src/components/features/patch/PatchSidebar.tsx   | +-284 侧边栏
src/components/features/patch/PatchView.tsx      | +-416 主视图
src/components/features/patch/patch_types.ts     | +-7  类型定义
6 files changed, 686 insertions(+), 334 deletions(-)
```

**主要更新**:
- 📊 **Git Diff 可视化**: 支持查看任意两个 commit 之间的代码差异
- 🔀 **Commit 选择器**: 下拉选择历史提交进行对比
- 📦 **多种导出格式**: 支持导出为 HTML、JSON、Markdown 等格式

---

### v1.1.4 (2025-12-16)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `bddd26e` | 发布 1.1.4 | 版本发布 |
| `8af3223` | 优化 | 代码优化 |
| `010c2d6` | 新增 | 新增过滤器管理功能 |
| `9aa51b9` | 优化 | 过滤逻辑优化 |
| `adb64fa` | 优化 | 上下文组装优化 |
| `1c38713` | 优化 | Token 计算优化 |
| `50acca4` | 优化 | 树形结构优化 |
| `25dd382` | 优化 | 文件树优化 |
| `e00dc4a` | 优化 | 交互优化 |
| `d231b05` | 优化 | 搜索优化 |
| `f1fe6a3` | 优化 | 快捷键优化 |
| `9dabaab` | 优化 | 快捷键处理优化 |
| `94621d4` | 优化 | 通知系统优化 |

**主要更新**:
- 🔍 **文件过滤器**: 支持按文件类型、大小、路径等条件过滤
- 📁 **上下文组装**: 支持选择特定文件/目录进行组合

---

### v1.1.3 (2025-12-14)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `696303e` | 发布 1.1.3 | 版本发布 |
| `e8303dc` | 新增 | 新增导出功能 |
| `7303fcd` | **Logo 更换** | 品牌视觉全面升级 |
| `49d79cc` | **优化通知** | 通知系统重构，支持更多通知类型 |
| `87a5ecd` | 优化 | 界面优化 |

**v1.1.3 Logo 更换文件变更** (54 个文件):
```
images/logo.png                     | 新 Logo 图片 (320KB)
src-tauri/icons/*                   | 多尺寸应用图标更新
src-tauri/icons/android/*           | Android 平台图标
src-tauri/icons/ios/*               | iOS 平台图标
```

**主要更新**:
- 🎨 **品牌升级**: 全新 Logo 设计，多平台图标适配
- 🔔 **通知系统**: 支持操作结果通知、错误提示、进度提示

---

### v1.1.2 (2025-12-04)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `ba2b14a` | 发布 1.1.2 | 版本发布 |
| `2c58cab` | 更新 | 版本号更新 |
| `561b20a` | 更新 | 配置更新 |
| `23b5bbb` | **优化自定义唤起按钮** | 支持自定义快捷键和唤醒方式配置 |

**主要更新**:
- ⌨️ **自定义快捷键**: 支持自定义全局唤醒快捷键
- 🎯 **唤起方式**: 支持点击托盘图标、快捷键等多种唤起方式

---

### v1.1.1 (2025-12-04)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `c92574f` | 发布 1.1.1 | 版本发布 |
| `f61a5ff` | 优化 | 基础功能优化 |
| `baf2876` | 优化 | 代码完善 |

---

### v1.1.0 早期版本 (2025-12 上旬)

| 提交哈希 | 变更内容 | 详细说明 |
|---------|---------|---------|
| `2df3e62` | **新增时钟功能** | 标题栏集成实时时钟显示 |

**v1.1.0 时钟功能文件变更**:
```
src/components/ui/ClockPopover.tsx | +301 时钟弹出组件
src/components/layout/TitleBar.tsx | +-24 标题栏集成
src/components/settings/SettingsModal.tsx | +-68 设置中添加时钟配置
src/lib/i18n.ts                   | +-44 国际化支持
14 files changed, 1177 insertions(+), 29 deletions(-)
```

---

## 核心功能演进

### 1. Context Forge (文件整合)
| 版本 | 功能 |
|-----|------|
| v1.1.4+ | 过滤器管理，支持按类型过滤 |
| v1.1.7 | 隐私扫描集成，安全检测 |
| v1.1.7 | Token 消耗实时预估 |

### 2. Spotlight (全局 AI 终端)
| 版本 | 功能 |
|-----|------|
| 初始 | 全局快捷键唤起 (`Alt+S`) |
| v1.1.2 | 自定义快捷键配置 |
| v1.1.3 | 通知系统集成 |

### 3. Prompt Verse (提示词库)
| 版本 | 功能 |
|-----|------|
| 初始 | 基础提示词管理 |
| v1.2.0 | SQLite 数据库重构，性能大幅提升 |

### 4. Patch Weaver (AI 补全器 & Git 对比)
| 版本 | 功能 |
|-----|------|
| v1.1.5 | Git Diff 可视化 |
| v1.1.5 | Commit 选择器 |
| v1.1.5 | 多格式导出 |

---

## 安全功能演进

### 隐私扫描引擎 (v1.1.7)

**核心组件**:
- `engine.rs`: 扫描引擎主程序
- `entropy.rs`: Shannon 熵值计算 (检测高随机性密钥)
- `rules.rs`: 正则表达式规则集
- `stopwords.rs`: 白名单词库 (过滤误报)
- `allowlist.rs`: 值白名单 (UUID、Git SHA、URL 等)

**检测流程**:
```
文件内容 → 正则匹配 → 熵值计算 → 白名单过滤 → 风险分级
```

### Gitleaks 安全规则 (v1.1.7)

**规则分类**:
| 分类 | 示例 |
|-----|------|
| AI 密钥 | OpenAI API Key, Anthropic Key |
| 云服务 | AWS Access Key, Azure SAS Token |
| 支付网关 | Stripe, Square, PayPal |
| 通信应用 | Slack, Discord, Twilio |
| 包管理 | NPM, PyPI, RubyGems |
| 数据库 | MongoDB, PostgreSQL 连接串 |
| 通用密钥 | Generic API Key, Bearer Token |

---

## 自动化流程

### 提示词库自动同步
```yaml
# GitHub Actions
触发: 每日定时 或 上游更新
执行: 同步 awesome-chatgpt-prompts 和 tldr-pages
提交: github-actions[bot]
```

---

## 构建与发布

### 版本发布流程
```
1. 功能开发完成
2. 代码审查 (GitHub PR)
3. 版本号更新 (package.json, Cargo.toml)
4. GitHub Actions 自动构建
5. 生成安装包
```

### 当前构建状态
| 平台 | 安装包大小 | 运行内存 |
|-----|-----------|---------|
| Windows | ~10 MB | ~30 MB |
| macOS | ~15 MB | ~35 MB |

---

## 目录结构

```
ctxrun/
├── src/                      # React 前端源码
│   ├── components/           # UI 组件
│   │   ├── features/         # 功能组件
│   │   │   ├── context/      # 上下文组装
│   │   │   ├── prompts/      # 提示词管理
│   │   │   └── patch/        # 代码对比
│   │   ├── layout/           # 布局组件
│   │   └── ui/               # 基础 UI
│   ├── lib/                  # 工具函数
│   ├── store/                # Zustand 状态管理
│   └── types/                # TypeScript 类型
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── db.rs             # SQLite 数据库
│   │   ├── git.rs            # Git 操作
│   │   ├── gitleaks/         # 安全扫描
│   │   └── main.rs           # 入口
│   └── Cargo.toml
├── build/dist/               # 预构建资源
│   └── packs/                # 提示词数据包
└── models/                   # LLM 模型配置
```

---

*文档最后更新: 2025-12-28*
*基于 git 提交历史和代码 diff 分析编写*
