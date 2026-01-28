# CtxRun - 详细使用指南

本文档提供了 CtxRun 各项核心功能的详细使用方法、配置指南和快捷键参考。

## 目录

1.  [Context Forge (文件整合)](#1-context-forge-文件整合)
2.  [Spotlight (全局 AI 终端)](#2-spotlight-全局-ai-终端)
3.  [Prompt Verse (提示词库)](#3-prompt-verse-提示词库)
4.  [Patch Weaver (AI 补全器)](#4-patch-weaver-ai-补全器)
5.  [System Monitor (系统监控)](#5-system-monitor-系统监控)
6.  [配置指南 (Setup Guide)](#6-配置指南-setup-guide)
7.  [常用快捷键一览](#7-常用快捷键一览)

---

### 1. Context Forge (文件整合)

**解决痛点：** 快速将项目文件打包成 LLM (ChatGPT/Claude/DeepSeek) 易读的格式。

#### 核心功能

*   **文件选择**：
    *   在左侧文件树中勾选你需要让 AI 理解的代码文件或文件夹
    *   支持虚拟化滚动，轻松处理大型项目目录
    *   双击可快速预览选中文件（支持图片、视频、代码等多种格式）

*   **过滤系统**：
    *   全局过滤规则：在设置中配置要忽略的文件、文件夹和扩展名
    *   即时过滤：底部的过滤输入框可快速筛选当前视图

*   **智能统计**：
    *   底部仪表盘实时显示选中文件的总大小
    *   **预估 Token 数量**：基于实际编码精确计算
    *   语言分布：自动检测并显示各编程语言的文件占比

*   **Token 优化**：
    *   开启 **"Remove Comments"** 开关，自动剥离代码注释，节省大量 Token
    *   自动识别并过滤二进制文件（如图片、PDF、视频等）

*   **安全扫描**：
    *   内置敏感信息检测引擎，在复制前自动扫描
    *   检测 API 密钥、密码等敏感信息
    *   支持白名单管理，自定义忽略规则

*   **导出选项**：
    *   **Copy to Clipboard**：一键复制结构化的 XML 文本到剪贴板
    *   **Export to File**：导出为 TXT 文件，推荐用于发送给 AI
    *   自动生成项目结构树和完整文件内容

---

### 2. Spotlight (全局 AI 终端)

**默认快捷键：** `Alt + S` (Windows) 或 `Option + S` (macOS)，在 Linux 上快捷键可能被系统占用。快捷键可在设置中自定义。

Spotlight 是一个始终置顶的悬浮窗，拥有多种模式。按 **`Tab`** 键在搜索模式和 AI 对话模式之间切换，按 **`ESC`** 退出。

#### 搜索模式 (Search Mode)

快速检索并使用你的指令库、应用程序和系统功能。

**基础搜索：**
*   输入关键词查找本地或已下载的 Prompt/Command
*   对于命令指令，按 `Enter` 可以直接通过终端执行
*   对于普通提示词，按 `Enter` 直接将内容复制到剪贴板
*   自动检测并处理 URL，直接回车可在浏览器中打开

**范围搜索前缀：**
*   `/app` - 仅搜索已安装的应用程序
*   `/cmd` - 仅搜索命令库
*   `/pmt` - 仅搜索提示词库
*   无前缀时搜索所有内容（应用、命令、提示词）

**计算器模式：**
*   输入前缀 `=` 进入计算器模式
*   示例：`=1+1` → 结果 2
*   示例：`=sin(pi/2)` → 结果 1
*   支持常用数学函数：sin, cos, tan, log, sqrt, abs, pow 等
*   支持常数：pi, e

**Shell 命令模式：**
*   输入前缀 `>` 或 `》` 进入 Shell 命令模式
*   Linux/Mac 示例：`>ls -la`
*   Windows 示例：`>dir`
*   结果会直接显示在 Spotlight 窗口中
*   点击 "Run in terminal" 按钮可在完整终端中执行
*   支持命令历史记录匹配，上下箭头键可浏览

**Web 搜索模式：**
*   输入前缀 `?` 或 `？` 进入 Web 搜索模式
*   示例：`?react hooks`
*   支持多搜索引擎：Google、Bing、百度
*   可在设置中配置默认搜索引擎和自定义搜索 URL
*   搜索引擎图标品牌化显示，快速识别当前引擎
*   搜索结果列表中显示各搜索引擎的官方品牌图标

**应用启动器：**
*   输入应用名称或关键词快速查找
*   选择目标应用后按 `Enter` 或点击 "Open" 启动
*   支持显示应用程序图标
*   需在设置中重建应用索引

#### AI 对话模式 (AI Chat Mode)

无需切换浏览器，直接与 AI 对话。

**进入方式：**
*   在搜索模式下按 `Tab` 键切换到紫色界面的 AI 模式
*   或输入 `/` 打开命令菜单快速访问

**对话功能：**
*   流式回复，实时显示 AI 响应
*   完整的 Markdown 渲染支持
*   代码语法高亮显示
*   支持复制消息内容（纯文本或 Markdown 格式）

**推理模型支持：**
*   支持 DeepSeek-R1 等推理模型
*   可折叠查看 AI 的 "Thinking Process" 思考过程
*   自动识别并处理推理内容

**模板系统：**
*   在提示词管理中勾选 "Use as chat template"
*   该提示词将作为 AI 对话的系统提示词使用
*   实现自定义 AI 行为和角色设定

**会话管理：**
*   按 `Ctrl + K` (Windows) 或 `Cmd + K` (macOS) 清空当前临时会话
*   对话历史仅保存在内存中
*   重启软件后自动清除，保持轻量级

---

### 3. Prompt Verse (提示词库)

管理你的常用指令和 AI 提示词，打造个人知识库。

#### 核心功能

**创建与编辑：**
*   支持创建自定义分组，分类管理提示词
*   编写包含变量（`{{variable}}`）的通用模板
*   使用变量时系统会自动提示输入
*   虚拟化网格显示，轻松管理大量提示词

**提示词类型：**

*   **普通提示词**：文本内容，复制到剪贴板使用

*   **可执行命令**：
    *   创建终端命令脚本
    *   点击直接通过终端执行
    *   命令从上到下依次执行
    *   支持多行命令和复杂脚本

*   **聊天模板**：
    *   勾选 "Use as chat template"
    *   作为 Spotlight AI 对话的系统提示词
    *   实现自定义 AI 行为

**导入导出：**
*   支持导出为 CSV 格式
*   支持从 CSV 导入提示词
*   方便备份和分享个人提示词库

**官方商店：**
*   在设置中进入 **Library** 标签页
*   下载离线的指令包（如 Linux 命令大全、编程辅助 Prompts）
*   自动更新官方提示词库

**遮蔽机制：**
*   如果你收藏并修改了官方指令
*   本地修改将覆盖官方版本，互不冲突
*   官方更新不会影响你的自定义版本

**收藏系统：**
*   星标常用提示词
*   快速访问重要内容

---

### 4. Patch Weaver (AI 补全器)

填补 "AI 生成代码" 与 "实际修改文件" 之间的鸿沟，让 AI 的输出直接应用到代码中。

#### 场景一：AI 补丁应用器 (AI Patch Applicator)

专为 AI 辅助编码设计的创新功能。

**工作流程：**

1.  **加载项目**：点击 "Select Project" 选择本地项目的根目录
2.  **获取指令**：侧边栏提供 **"AI Instruction"** 系统提示词
3.  **发送给 AI**：复制提示词并附加修改需求发送给大语言模型
4.  **粘贴 AI 响应**：AI 返回包含 `<<<<<<< SEARCH ... >>>>>>> REPLACE` 块的文本
5.  **自动解析与预览**：
    *   瞬间解析针对一个或多个文件的所有修改操作
    *   在内存中模拟应用补丁
    *   在 Monaco Editor 驱动的 Diff 视图中展示修改对比
6.  **应用或取消**：预览无误后点击 "Apply Patches" 应用所有修改

**支持的格式：**
*   YAML 格式的补丁块
*   SEARCH/REPLACE 标记
*   多文件批量修改

**导出功能：**
*   导出补丁为多种格式：Markdown、JSON、XML、TXT
*   多种布局选项：Split、Unified、Git Patch

#### 场景二：Git 版本对比器 (Git Diff Visualizer)

强大的 Git 可视化工具。

**工作流程：**

1.  **浏览 Git 仓库**：选择包含 `.git` 目录的本地项目
2.  **加载提交记录**：应用读取最近的 50 条 commit 记录
3.  **选择版本**：在下拉框中选择任意两个 commit 进行对比
4.  **生成对比**：点击 "Generate Diff" 查看差异
5.  **审查与导出**：
    *   左侧列表展示所有变更文件
    *   文件状态标识：**新增 (A)**、**修改 (M)**、**删除 (D)**、**重命名 (R)**
    *   自动标记二进制文件和超大文件
    *   点击文件在右侧 Diff 视图中详细审查

**特殊模式：**
*   **Working Directory 模式**：对比当前工作区与最后一次提交
*   **Base Version**：选择基准版本
*   **Compare Version**：选择要对比的版本

**导出选项：**
*   格式：Markdown、JSON、XML、TXT
*   布局：Split（分栏）、Unified（统一）、Git Patch

---

### 5. System Monitor (系统监控)

实时监控系统状态和开发环境。

#### Dashboard 仪表盘

*   **CPU 使用率**：实时显示 CPU 占用百分比
*   **内存使用**：显示内存占用情况和可用内存
*   **系统运行时间**：显示系统启动后运行的时间
*   **性能指标**：关键性能数据的可视化展示

#### Ports 端口监控

*   查看所有活跃的网络端口
*   显示每个端口的监听进程
*   显示进程 ID 和名称
*   支持终止占用端口的进程

#### Environment 环境检测

*   **已检测的 IDE**：VS Code、JetBrains 系列等
*   **浏览器**：Chrome、Firefox、Edge 等
*   **SDK 和工具**：Python、Node.js、Git 等
*   **开发环境分析**：完整的开发环境指纹

#### Network 网络诊断

*   网络连接状态测试
*   延迟检测
*   连接质量评估

---

### 6. 配置指南 (Setup Guide)

#### AI Configuration (AI 配置)

为了使用 Spotlight 的 AI 对话功能，你需要配置模型提供商。

1.  点击左侧侧边栏底部的 **设置** 图标
2.  进入 **AI Configuration** 选项卡
3.  填写 API 信息：
    *   **Provider**：选择提供商（仅作图标区分，不限制使用）
        *   DeepSeek：推荐使用，性价比高
        *   OpenAI：GPT 系列模型
        *   Anthropic：Claude 系列模型
        *   其他：填写自定义名称
    *   **API Key**：填入你的 API 密钥（数据仅存储在本地）
    *   **Base URL**：（可选）如果使用硅基流动、OneAPI 等中转服务，填写对应的地址
        *   示例：`https://api.siliconflow.cn`
    *   **Model ID**：填入模型名称
        *   DeepSeek 示例：`deepseek-chat`、`deepseek-reasoner`
        *   OpenAI 示例：`gpt-4o`、`gpt-4o-mini`
    *   **Temperature**：设置模型输出随机性（0-1，默认 0.7）

**推荐配置：**
*   **免费选择**：GLM 模型（有免费额度）
*   **高性价比**：DeepSeek 模型
*   **高质量**：GPT-4o 或 Claude 3.5 Sonnet

#### Spotlight Settings (Spotlight 设置)

*   **Global Shortcut**：自定义全局快捷键
    *   默认：`Alt + S`
    *   可修改为任意组合键
*   **Window Size**：调整 Spotlight 窗口大小
*   **Rest Reminder**：休息提醒功能
    *   启用/禁用提醒
    *   设置提醒间隔时间

#### Search Settings (搜索设置)

*   **Default Engine**：选择默认搜索引擎
    *   Google：全球最大搜索引擎
    *   Bing：微软搜索引擎
    *   百度：中文搜索引擎
    *   Custom：自定义搜索引擎
*   **Custom URL**：配置自定义搜索地址
    *   使用 `%s` 作为搜索关键词占位符
    *   示例：`https://www.google.com/search?q=%s`

#### Appearance (外观设置)

*   **Theme**：选择明亮或暗色主题
*   **Language**：选择界面语言（中文/English）
*   **Sidebar**：侧边栏展开/收起设置
*   **Context Panel Width**：调整面板宽度

#### Global Filters (全局过滤)

配置在所有功能中忽略的文件和文件夹：

*   **Ignore Files**：文件名模式（如 `*.log`）
*   **Ignore Folders**：文件夹名称（如 `node_modules`）
*   **Ignore Extensions**：文件扩展名（如 `.png`）

#### Security (安全设置)

*   **Secret Scanning**：敏感信息扫描开关
*   **Whitelist**：管理忽略的敏感信息规则
*   **Gitleaks Rules**：基于 Gitleaks 的检测规则

#### Library (库管理)

*   **Export Configuration**：导出应用配置（包括提示词、设置等）
*   **Import Configuration**：导入配置文件
*   **Download Official Packs**：下载官方提示词包
*   **Export Prompts**：导出提示词为 CSV
*   **Import Prompts**：从 CSV 导入提示词

---

### 7. 常用快捷键一览

#### 全局快捷键

| 快捷键 | 功能 |
| :--- | :--- |
| `Alt + S` | 唤起/隐藏 Spotlight（可在设置中修改） |

#### Spotlight 快捷键

| 快捷键 | 搜索模式功能 | AI 对话模式功能 |
| :--- | :--- | :--- |
| `Tab` | 切换到 AI 对话模式 | 切换到搜索模式 |
| `Enter` | 执行命令/复制内容/打开应用 | 发送消息 |
| `Arrow Up/Down` | 在搜索结果中导航 | 在聊天历史中导航 |
| `Ctrl/Cmd + K` | - | 清空当前对话历史 |
| `Escape` | 清空输入框或关闭 Spotlight | 清空输入框或关闭 Spotlight |
| `/` | 打开命令菜单 | 打开命令菜单 |
| `=` | 切换到计算器模式 | - |
| `>或》` | 切换到 Shell 命令模式 | - |
| `?或？` | 切换到 Web 搜索模式 | - |

---

**CtxRun** - Run with context, AI at your fingertips.

如有问题或建议，欢迎访问 [GitHub Issues](https://github.com/WinriseF/CtxRun/issues) 反馈。
