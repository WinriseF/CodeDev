<div align="center">
  <a href="https://github.com/WinriseF/Code-Forge-AI">
    <img src="images/logo.png" alt="CodeForge AI Logo" width="120" height="120">
  </a>

  <h1 align="center">CodeForge AI</h1>

  <p align="center">
    <strong>Forge your code with intelligence.</strong>
    <br />
    为开发者打造的 AI 辅助生产力工具：上下文组装 · 提示词管理 · 全局 AI 对话 · 代码对比
  </p>

  <p align="center">
    <a href="https://github.com/WinriseF/Code-Forge-AI/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/WinriseF/Code-Forge-AI/update-prompts.yml?style=flat-square&logo=github&label=build" alt="Build Status">
    </a>
    <a href="https://tauri.app">
      <img src="https://img.shields.io/badge/built%20with-Tauri-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Built with Tauri">
    </a>
    <a href="https://react.dev">
      <img src="https://img.shields.io/badge/frontend-React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
    </a>
    <a href="https://www.rust-lang.org">
      <img src="https://img.shields.io/badge/backend-Rust-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/github/license/WinriseF/Code-Forge-AI?style=flat-square&color=blue" alt="License">
    </a>
  </p>
</div>

<br />

**CodeForge AI** 是一款专为开发者打造的 AI 辅助生产力工具。它集成了代码上下文组装、代码对比、提示词管理以及一个随时待命的全局 AI 终端，旨在无缝连接你的 IDE 与大语言模型（LLM）。

![alt text](images/ScreenShot_2025-11-28_185818_533.png)

![alt text](images/ScreenShot_2025-11-28_185842_701.png)

![alt text](images/ScreenShot_2025-11-28_185855_631.png)

![alt text](images/ScreenShot_2025-11-28_185940_974.png)

![alt text](images/ScreenShot_2025-11-28_185955_998.png)

## 🛠️ 技术栈 (Tech Stack)

本项目采用现代化的**高性能桌面应用架构**构建，兼顾了极小的资源占用与流畅的用户体验，整体大小为10MB左右，运行内存占用约30MB：

*   **Core**: [Tauri](https://tauri.app/) (Rust + WebView) - 提供原生级的性能与超小的安装包体积。
*   **Frontend**: React 18 + TypeScript + Vite - 现代化的前端开发体验。
*   **State Management**: Zustand - 轻量且强大的状态管理。
*   **Styling**: Tailwind CSS + tailwindcss-animate - 快速构建美观的 UI。
*   **Icons**: Lucide React.

## 核心功能指南

### 1. Context Forge (文件整合)
**解决痛点：** 快速将项目文件打包成 LLM (ChatGPT/Claude/DeepSeek) 易读的格式。

*   **文件选择**：在左侧文件树中勾选你需要让 AI 理解的代码文件或文件夹。
*   **智能统计**：底部仪表盘会实时显示选中文件的总大小、**预估 Token 数量**以及语言分布。
*   **Token 优化**：
    *   开启 **"Remove Comments"** 开关，自动剥离代码注释，节省大量 Token。
    *   自动识别并过滤二进制文件（如图片、PDF）。
*   **一键输出（建议下载为txt）**：点击 **Copy**，软件会将项目结构树和文件内容生成为结构化的 XML 文本，直接粘贴给 AI 即可。

### 2. Spotlight (全局 AI 终端)
**快捷键：** `Alt + S` (Windows/Linux，实际上Linux无法注册快捷键) 或 `Option + S` (macOS)，可以自由设置快捷键

Spotlight 是一个始终置顶的悬浮窗，拥有两种模式，按 **`Tab`** 键切换，按**`ESC`**退出：

#### 🔍 搜索模式 (Search Mode)
快速检索并使用你的指令库。
*   **搜索**：输入关键词查找本地或已下载的 Prompt/Command。
*   **执行**：对于命令指令，按`Enter`可以直接通过终端执行，执行通常是从上到下依次执行。
*   **复制**：按 `Enter` 直接将内容复制到剪贴板。

#### ✨ AI 对话模式 (AI Chat Mode)
无需切换浏览器，直接与 AI 对话。
*   **切换**：在搜索模式下按 `Tab` 键进入紫色界面的 AI 模式。
*   **对话**：输入问题并回车，体验流式打字机回复。支持 Markdown 渲染和代码高亮。
*   **思考过程**：支持 DeepSeek-R1 等推理模型，可折叠查看 AI 的 "Thinking Process"。
*   **清空上下文**：按 `Ctrl + K` (或 `Cmd + K`) 清空当前临时会话。
    *   *注意：Spotlight 主打“即用即走”，对话历史仅保存在内存中，重启软件后会自动清除。*

### 3. Prompt Verse (提示词库)
管理你的常用指令和 AI 提示词。

*   **创建与编辑**：支持创建自定义分组，编写包含变量（`{{variable}}`）的通用模板。
*   **官方商店**：在设置中进入 **Library**，下载离线的指令包（如 Linux 命令大全、编程辅助 Prompts）。
*   **遮蔽机制**：如果你收藏并修改了官方指令，本地修改将覆盖官方版本，互不冲突。
*   **命令执行**：可以创建可执行命令指令，直接点击通过终端执行

---

### 4.Patch Weaver (AI补全器)

它的设计理念是填补“AI 生成代码”与“实际修改文件”之间的最后一步鸿沟，让用户无需手动复制粘贴每一处修改。

以下是 Patch Weaver 的详细功能介绍：

#### 1. 核心定位
**“面向 LLM 的智能 Patch 工具”**
通过固定的句式让AI的输出直接能够融合到代码里面，无需手动复制查找粘贴

#### 2. 主要工作流程 (Workflow)

1.  **加载项目**：用户选择本地项目的根目录 (`projectRoot`)。
2.  **获取指令**：侧边栏提供了一个内置的 **"AI Instruction" (系统提示词)**。用户将其复制并发给AI，AI 按照特定格式（`<<<<<<< SEARCH` ... `>>>>>>> REPLACE`）返回代码修改建议。
3.  **粘贴补丁**：用户将 AI 返回的文本直接粘贴（可右键直接粘贴）到 Patch Weaver 的输入框中。
4.  **自动解析与匹配**：
    *   系统自动解析多文件补丁。
    *   **智能模糊匹配**：利用 `src/lib/patch_parser.ts` 中的算法，即使 AI 生成的代码缩进或空行与本地文件略有不同，系统也能基于 Token 流精确定位修改位置。
5.  **可视化审查 (Diff View)**：
    *   基于 Monaco Editor（VS Code 同款编辑器）的 Diff 视图。
    *   支持 **Split (分栏)** 和 **Unified (行内)** 两种对比模式。
    *   清晰展示 `Original`（本地原文件）与 `Modified`（应用补丁后的预览）。
6.  **确认与保存**：用户确认无误后，点击保存，修改将物理写入硬盘。


## 配置指南 (Setup)

为了使用 Spotlight 的 AI 对话功能，你需要配置模型提供商：

1.  点击左侧侧边栏底部的 **设置 (Settings)** 图标。
2.  进入 **AI Configuration** 选项卡。
3.  填写 API 信息：
    *   **Provider**: 选择 `DeepSeek` / `OpenAI` / `Anthropic` (仅作图标区分，并不是只能这三个选择)。
    *   **API Key**: 填入你的 API 密钥（数据仅存储在本地）。
    *   **Base URL**: (可选) 如果使用 **硅基流动 (SiliconFlow)** 或其他中转服务，请填写对应的 Base URL（例如 `https://api.siliconflow.cn`）。
    *   **Model ID**: 填入模型名称（例如 `deepseek-chat`）。

---

## 常用快捷键一览

| 快捷键 | 作用域 | 功能 |
| :--- | :--- | :--- |
| `Alt + S` | 全局 | 唤起/隐藏 Spotlight 搜索框 |
| `Tab` | Spotlight | 切换 **搜索模式** / **AI 模式** |
| `Enter` | Spotlight | (搜索模式) 复制/执行指令 / (AI 模式) 发送消息 |
| `Ctrl + K` | Spotlight | (AI 模式) 清空当前对话历史 |
| `Esc` | 全局 | 关闭当前窗口或弹窗 |

---

## 下载与安装

请前往 [Releases](../../releases) 页面下载适合您操作系统的安装包，或者直接下载运行版本(**CodeForge.AI.exe
**)，无需安装点击即用（数据存储在`C:\Users\<name>\AppData\Local\com.codeforge.ai`内，即`%localappdata%\com.codeforge.ai`）：
*   **Windows**: `.msi` 或 `.exe`
---

## 关于报毒

启动应用时，你可能会看到 **“Windows 已保护你的电脑” (Microsoft Defender SmartScreen)** 的蓝色拦截窗口。

**这是正常现象**。因为 CodeForge AI 是一个由个人维护的开源项目，没有购买昂贵的微软数字签名证书 (EV Code Signing Certificate)，所以会被系统标记为“未知发布者”。

**如何运行：**
1. 在蓝色拦截窗口中，点击 **<u>更多信息 (More info)</u>**。
2. 点击下方出现的 **仍要运行 (Run anyway)** 按钮。

> 🔒 **安全承诺**：本项目完全开源，构建过程由 GitHub Actions 自动化完成，绝不包含任何恶意代码。如果您仍有顾虑，欢迎审查源码自行构建。
![alt text](images/ScreenShot_2025-11-28_205723_002.png)


## 致谢与开源声明 (Credits)

特别感谢以下项目提供的数据支持与灵感：

*   **[tldr-pages](https://github.com/tldr-pages/tldr)**: 本项目的命令库数据（Command Packs）部分来源于此，感谢他们为繁杂的 man pages 提供了简洁实用的替代方案。
*   **[Awesome ChatGPT Prompts](https://github.com/f/awesome-chatgpt-prompts)**: 本项目的提示词库数据（Prompt Packs）部分来源于此。

---

*CodeForge AI - Forge your code with intelligence.*