# CtxRun - Detailed Usage Guide

This document provides detailed usage instructions, configuration guides, and keyboard shortcut references for all core features of CtxRun.

## Table of Contents

1.  [Context Forge (File Assembly)](#1-context-forge-file-assembly)
2.  [Spotlight (Global AI Terminal)](#2-spotlight-global-ai-terminal)
3.  [Prompt Verse (Prompt Library)](#3-prompt-verse-prompt-library)
4.  [Patch Weaver (AI Completer)](#4-patch-weaver-ai-completer)
5.  [System Monitor (System Monitoring)](#5-system-monitor-system-monitoring)
6.  [Setup Guide](#6-setup-guide-setup-guide)
7.  [Common Keyboard Shortcuts Reference](#7-common-keyboard-shortcuts-reference)

---

### 1. Context Forge (File Assembly)

**Solves the pain point:** Quickly package project files into LLM-readable formats (ChatGPT/Claude/DeepSeek).

#### Core Features

*   **File Selection**:
    *   Check the code files or folders you want the AI to understand in the left file tree
    *   Supports virtual scrolling, easily handles large project directories
    *   Double-click to quickly preview selected files (supports images, videos, code, and other formats)

*   **Filter System**:
    *   Global filter rules: Configure files, folders, and extensions to ignore in settings
    *   Instant filtering: The filter input box at the bottom can quickly filter the current view

*   **Smart Statistics**:
    *   Bottom dashboard displays real-time total size of selected files
    *   **Estimated Token Count**: Accurately calculated based on actual encoding
    *   Language distribution: Automatically detects and displays file proportions by programming language

*   **Token Optimization**:
    *   Enable **"Remove Comments"** toggle to automatically strip code comments and save significant tokens
    *   Automatically detects and filters binary files (such as images, PDFs, videos, etc.)

*   **Security Scan**:
    *   Built-in sensitive information detection engine, automatically scans before copying
    *   Detects API keys, passwords, and other sensitive information
    *   Supports whitelist management, custom ignore rules

*   **Export Options**:
    *   **Copy to Clipboard**: One-click copy of structured XML text to clipboard
    *   **Export to File**: Export as TXT file, recommended for sending to AI
    *   Automatically generates project structure tree and complete file contents

---

### 2. Spotlight (Global AI Terminal)

**Default shortcut:** `Alt + S` (Windows) or `Option + S` (macOS). On Linux, the shortcut may be occupied by the system. Shortcuts can be customized in settings.

Spotlight is an always-on-top floating window with multiple modes. Press **`Tab`** to switch between search mode and AI chat mode, press **`ESC`** to exit.

#### Search Mode

Quickly search and use your command library, applications, and system functions.

**Basic Search:**
*   Enter keywords to find local or downloaded Prompts/Commands
*   For command instructions, press `Enter` to execute directly through terminal
*   For regular prompts, press `Enter` to copy content directly to clipboard
*   Automatically detects and handles URLs, press Enter to open directly in browser

**Scope Search Prefixes:**
*   `/app` - Search installed applications only
*   `/cmd` - Search command library only
*   `/pmt` - Search prompt library only
*   No prefix searches all content (applications, commands, prompts)

**Calculator Mode:**
*   Enter prefix `=` to enter calculator mode
*   Example: `=1+1` → Result 2
*   Example: `=sin(pi/2)` → Result 1
*   Supports common math functions: sin, cos, tan, log, sqrt, abs, pow, etc.
*   Supports constants: pi, e

**Shell Command Mode:**
*   Enter prefix `>` to enter Shell command mode
*   Linux/Mac example: `>ls -la`
*   Windows example: `>dir`
*   Results are displayed directly in the Spotlight window
*   Click "Run in terminal" button to execute in full terminal
*   Supports command history matching, use arrow keys to browse

**Application Launcher:**
*   Enter application name or keywords to quickly find
*   After selecting target application, press `Enter` or click "Open" to launch
*   Supports displaying application icons
*   Requires rebuilding application index in settings

#### AI Chat Mode

Chat with AI directly without switching browsers.

**How to Enter:**
*   Press `Tab` in search mode to switch to AI mode with purple interface
*   Or type `/` to open command menu for quick access

**Chat Features:**
*   Streaming replies, displays AI responses in real-time
*   Full Markdown rendering support
*   Code syntax highlighting
*   Supports copying message content (plain text or Markdown format)

**Reasoning Model Support:**
*   Supports DeepSeek-R1 and other reasoning models
*   Collapsible view of AI's "Thinking Process"
*   Automatically recognizes and processes reasoning content

**Template System:**
*   Check "Use as chat template" in prompt management
*   That prompt will be used as the system prompt for AI chat
*   Implements custom AI behavior and role settings

**Session Management:**
*   Press `Ctrl + K` (Windows) or `Cmd + K` (macOS) to clear current temporary session
*   Chat history is only saved in memory
*   Automatically clears after restart, keeping it lightweight

---

### 3. Prompt Verse (Prompt Library)

Manage your common commands and AI prompts to build a personal knowledge base.

#### Core Features

**Create and Edit:**
*   Supports creating custom groups to categorize and manage prompts
*   Write universal templates containing variables (`{{variable}}`)
*   System automatically prompts for input when using variables
*   Virtualized grid display, easily manage large numbers of prompts

**Prompt Types:**

*   **Regular Prompts**: Text content, copied to clipboard for use

*   **Executable Commands**:
    *   Create terminal command scripts
    *   Click to execute directly through terminal
    *   Commands execute sequentially from top to bottom
    *   Supports multi-line commands and complex scripts

*   **Chat Templates**:
    *   Check "Use as chat template"
    *   Used as system prompt for Spotlight AI chat
    *   Implements custom AI behavior

**Import and Export:**
*   Supports exporting to CSV format
*   Supports importing prompts from CSV
*   Convenient for backing up and sharing personal prompt libraries

**Official Store:**
*   Go to **Library** tab in settings
*   Download offline command packs (such as Linux command collection, programming assistant Prompts)
*   Automatically updates official prompt library

**Override Mechanism:**
*   If you favorite and modify official commands
*   Local modifications will override official versions, no conflicts
*   Official updates won't affect your custom versions

**Favorite System:**
*   Star frequently used prompts
*   Quick access to important content

---

### 4. Patch Weaver (AI Completer)

Bridge the gap between "AI-generated code" and "actual file modifications", applying AI output directly to code.

#### Scenario 1: AI Patch Applicator

An innovative feature designed for AI-assisted coding.

**Workflow:**

1.  **Load Project**: Click "Select Project" to select the root directory of a local project
2.  **Get Instructions**: Sidebar provides **"AI Instruction"** system prompt
3.  **Send to AI**: Copy the prompt and attach modification requirements, then send to the large language model
4.  **Paste AI Response**: AI returns text containing `<<<<<<< SEARCH ... >>>>>>> REPLACE` blocks
5.  **Auto Parse and Preview**:
    *   Instantly parses all modification operations for one or multiple files
    *   Simulates applying patches in memory
    *   Displays modification comparison in Monaco Editor-powered Diff view
6.  **Apply or Cancel**: After preview is correct, click "Apply Patches" to apply all modifications

**Supported Formats:**
*   YAML format patch blocks
*   SEARCH/REPLACE markers
*   Multi-file batch modifications

**Export Function:**
*   Export patches to multiple formats: Markdown, JSON, XML, TXT
*   Multiple layout options: Split, Unified, Git Patch

#### Scenario 2: Git Version Comparator (Git Diff Visualizer)

A powerful Git visualization tool.

**Workflow:**

1.  **Browse Git Repository**: Select a local project containing `.git` directory
2.  **Load Commit Records**: Application reads recent 50 commit records
3.  **Select Versions**: Select any two commits in dropdown to compare
4.  **Generate Diff**: Click "Generate Diff" to view differences
5.  **Review and Export**:
    *   Left list shows all changed files
    *   File status indicators: **Added (A)**, **Modified (M)**, **Deleted (D)**, **Renamed (R)**
    *   Automatically marks binary files and oversized files
    *   Click file to review in detail in right Diff view

**Special Modes:**
*   **Working Directory Mode**: Compare current working directory with last commit
*   **Base Version**: Select base version
*   **Compare Version**: Select version to compare

**Export Options:**
*   Formats: Markdown, JSON, XML, TXT
*   Layouts: Split, Unified, Git Patch

---

### 5. System Monitor (System Monitoring)

Real-time monitoring of system status and development environment.

#### Dashboard

*   **CPU Usage**: Real-time display of CPU usage percentage
*   **Memory Usage**: Shows memory usage and available memory
*   **System Uptime**: Displays time since system started
*   **Performance Metrics**: Visual display of key performance data

#### Ports Monitoring

*   View all active network ports
*   Shows listening process for each port
*   Displays process ID and name
*   Supports killing processes occupying ports

#### Environment Detection

*   **Detected IDEs**: VS Code, JetBrains series, etc.
*   **Browsers**: Chrome, Firefox, Edge, etc.
*   **SDKs and Tools**: Python, Node.js, Git, etc.
*   **Development Environment Analysis**: Complete development environment fingerprint

#### Network Diagnostics

*   Network connection status test
*   Latency detection
*   Connection quality assessment

---

### 6. Setup Guide

#### AI Configuration

To use Spotlight's AI chat feature, you need to configure model providers.

1.  Click the **Settings** icon at the bottom of left sidebar
2.  Go to **AI Configuration** tab
3.  Fill in API information:
    *   **Provider**: Select provider (only for icon distinction, does not limit usage)
        *   DeepSeek: Recommended, cost-effective
        *   OpenAI: GPT series models
        *   Anthropic: Claude series models
        *   Others: Enter custom name
    *   **API Key**: Enter your API key (data is stored locally only)
    *   **Base URL**: (Optional) If using relay services like SiliconFlow or OneAPI, enter corresponding address
        *   Example: `https://api.siliconflow.cn`
    *   **Model ID**: Enter model name
        *   DeepSeek example: `deepseek-chat`, `deepseek-reasoner`
        *   OpenAI example: `gpt-4o`, `gpt-4o-mini`
    *   **Temperature**: Set model output randomness (0-2, default 0.7)

**Recommended Configuration:**
*   **Free Option**: GLM models (has free quota)
*   **Cost-effective**: DeepSeek models
*   **High Quality**: GPT-4o or Claude 3.5 Sonnet

#### Spotlight Settings

*   **Global Shortcut**: Customize global shortcut
    *   Default: `Alt + S`
    *   Can be changed to any key combination
*   **Window Size**: Adjust Spotlight window size
*   **Rest Reminder**: Rest reminder feature
    *   Enable/disable reminders
    *   Set reminder interval

#### Appearance

*   **Theme**: Select light or dark theme
*   **Language**: Select interface language (Chinese/English)
*   **Sidebar**: Sidebar expand/collapse settings
*   **Context Panel Width**: Adjust panel width

#### Global Filters

Configure files and folders to ignore across all features:

*   **Ignore Files**: Filename patterns (like `*.log`)
*   **Ignore Folders**: Folder names (like `node_modules`)
*   **Ignore Extensions**: File extensions (like `.png`)

#### Security

*   **Secret Scanning**: Sensitive information scanning toggle
*   **Whitelist**: Manage ignored sensitive information rules
*   **Gitleaks Rules**: Detection rules based on Gitleaks

#### Library

*   **Export Configuration**: Export application configuration (including prompts, settings, etc.)
*   **Import Configuration**: Import configuration file
*   **Download Official Packs**: Download official prompt packs
*   **Export Prompts**: Export prompts to CSV
*   **Import Prompts**: Import prompts from CSV

---

### 7. Common Keyboard Shortcuts Reference

#### Global Shortcuts

| Shortcut | Function |
| :--- | :--- |
| `Alt + S` | Show/hide Spotlight (can be changed in settings) |

#### Spotlight Shortcuts

| Shortcut | Search Mode Function | AI Chat Mode Function |
| :--- | :--- | :--- |
| `Tab` | Switch to AI chat mode | Switch to search mode |
| `Enter` | Execute command/copy content/open app | Send message |
| `Arrow Up/Down` | Navigate in search results | Navigate in chat history |
| `Ctrl/Cmd + K` | - | Clear current chat history |
| `Escape` | Clear input or close Spotlight | Clear input or close Spotlight |
| `/` | Open command menu | Open command menu |
| `=` | Switch to calculator mode | - |
| `>` | Switch to Shell command mode | - |

---

**CtxRun** - Run with context, AI at your fingertips.

For questions or suggestions, please visit [GitHub Issues](https://github.com/WinriseF/CtxRun/issues) to provide feedback.
