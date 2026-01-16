<div align="center">
  <a href="https://github.com/WinriseF/CtxRun">
    <img src="images/logo.png" alt="CtxRun Logo" width="120" height="120">
  </a>

  <h1 align="center">CtxRun</h1>

  <p align="center">
    <strong>Run with context, AI at your fingertips.</strong>
    <br />
    为开发者打造的 AI 辅助生产力工具：上下文组装 · 提示词管理 · 全局 AI 对话 · 代码对比
  </p>

  <p align="center">
    <a href="https://github.com/WinriseF/CtxRun/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/WinriseF/CtxRun/update-prompts.yml?style=flat-square&logo=github&label=build" alt="Build Status">
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
      <img src="https://img.shields.io/github/license/WinriseF/CtxRun?style=flat-square&color=blue" alt="License">
    </a>
  </p>
</div>

<br />

**CtxRun** 是一款专为开发者打造的 AI 辅助生产力工具。它集成了代码上下文组装、代码对比、提示词管理以及一个随时待命的全局 AI 终端，旨在无缝连接你的 IDE 与大语言模型（LLM）。

![alt text](images/ScreenShot_2025-11-28_185818_533.png)
![alt text](images/ScreenShot_2025-11-28_185842_701.png)
![alt text](images/ScreenShot_2025-11-28_185855_631.png)
![alt text](images/ScreenShot_2025-11-28_185940_974.png)
![alt text](images/ScreenShot_2025-11-28_185955_998.png)

## ✨ 核心功能 (Core Features)

*   **🚀 Context Forge (文件整合)**: 智能地将你的项目文件打包成 LLM 易于理解的格式，支持自动移除注释、过滤二进制文件，并实时预估 Token 消耗。
*   **💡 Spotlight (全局 AI 终端)**: 通过全局快捷键 (`Alt+S`) 随时唤出。在任何应用中快速搜索和执行命令，或与 AI 进行流式对话。
*   **📚 Prompt Verse (提示词库)**: 高效管理你的常用指令和 AI 提示词。支持创建变量模板、分组管理，并可从官方库下载离线指令包。
*   **🔄 Patch Weaver (AI 补全器 & Git 对比)**: 应用 AI 生成的代码补丁，通过智能模糊匹配精确定位修改。同时也是一个强大的 Git Diff 可视化工具，支持版本对比和多样化导出。

> ### 🚀 想要了解如何使用？(Want to learn how to use it?)
>
> 👉 **[查看详细使用指南 (Check out the Detailed Usage Guide)](./USAGE.md)**

## 🛠️ 技术栈 (Tech Stack)

本项目采用现代化的**高性能桌面应用架构**构建，兼顾了极小的资源占用与流畅的用户体验，整体大小为10MB左右，运行内存占用约30MB：

*   **Core**: [Tauri](https://tauri.app/) (Rust + WebView) - 提供原生级的性能与超小的安装包体积。
*   **Frontend**: React 18 + TypeScript + Vite - 现代化的前端开发体验。
*   **State Management**: Zustand - 轻量且强大的状态管理。
*   **Styling**: Tailwind CSS + tailwindcss-animate - 快速构建美观的 UI。
*   **Icons**: Lucide React.

---

## 📥 下载与安装 (Download & Installation)

请前往 [Releases](../../releases) 页面下载适合您操作系统的安装包，或者直接下载运行版本(**CtxRun.exe**)，无需安装点击即用（数据存储在`C:\Users\<name>\AppData\Local\com.ctxrun`内，即`%localappdata%\com.ctxrun`）：

*   **Windows**: `.msi` 或 `.exe`

---

## ⚠️ 关于报毒 (About Virus Alert)

启动应用时，你可能会看到 **“Windows 已保护你的电脑” (Microsoft Defender SmartScreen)** 的蓝色拦截窗口。

**这是正常现象**。因为 CtxRun 是一个由个人维护的开源项目，没有购买微软数字签名证书 (EV Code Signing Certificate)，所以会被系统标记为"未知发布者"。

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

*CtxRun - Run with context, AI at your fingertips.*