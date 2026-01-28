# CtxRun Development Documentation

> This document records the complete development history of the CtxRun project, compiled based on git commit history and code change analysis.

## Project Overview

**CtxRun** is an AI-powered productivity tool for developers, built on the Tauri framework.

### Tech Stack
- **Core Framework**: Tauri (Rust 1.80 + WebView2)
- **Frontend**: React 18 + TypeScript + Vite 6
- **State Management**: Zustand
- **Styling**: Tailwind CSS + tailwindcss-animate
- **Editor**: Monaco Editor

---

## Version History

### v1.4.0 (2026-01-28)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `7cb60e5` | **Search Engine Icon Optimization** | Add SearchEngineIcon component for unified brand icon management |
| `124cede` | **Backspace BUG Fix** | Fix backspace deletion logic when switching search scopes |
| `4193cc1` | **Code Cleanup** | Remove unnecessary comments and debug code |

**v1.4.0 Detailed File Changes**:
```
New Files:
  src/components/ui/SearchEngineIcon.tsx                 | +46  new search engine icon component

Modified Files:
  src/components/features/spotlight/hooks/useSpotlightSearch.ts | -6 +2  remove icon imports, icon field changed to string
  src/components/features/spotlight/core/SearchBar.tsx  | -7 +14  remove buggy reset logic, web tag uses SearchEngineIcon
  src/components/features/spotlight/modes/search/SearchMode.tsx | +9   web_search uses SearchEngineIcon with colorize support
  src/components/settings/SettingsModal.tsx              | ~8   search engine cards use SearchEngineIcon
  src/App.tsx                                           | -1   remove shortcut registration debug log
  src/components/features/context/ContextView.tsx        | -2   remove token count log
```

**Key Updates**:
- 🎨 **Search Engine Brand Icons**: New `SearchEngineIcon` component with official Google, Bing, Baidu icons and brand colors
- 🔧 **Architecture Optimization**: Hook layer no longer handles icon rendering, only passes engine type string - separation of concerns
- 🎯 **Interaction Enhancement**: Search results show white icons when selected for better dark background contrast
- 🐛 **BUG Fix**: Fixed backspace deletion logic - only exits search scope when pressing backspace on empty query
- 🧹 **Code Cleanup**: Removed unnecessary debug logs and comments

### v1.3.9 (2026-01-28)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `5b053ac` | **Add HyperView Preview** | New file preview feature supporting multiple formats |
| `d134c7c` | **Database Structure Optimization** | Split db.rs into modular structure |
| `4c5575d` | **Style Optimization** | Markdown renderer style improvements |
| `abb77f6` | **Code Cleanup** | Remove ContextView redundant code |
| `3190d8c` | **Editor Optimization** | Prompt editor interaction improvements |
| `5b71c4f` | **Animation Optimization** | Editor dialog animation smoothness enhancement |
| `d500168` | Release 1.3.9 | Version release |

**v1.3.9 HyperView Preview Feature File Changes**:
```
src-tauri/src/hyperview/mod.rs                    | +12  module entry
src-tauri/src/hyperview/protocol.rs               | +75  protocol handling
src-tauri/src/hyperview/sniffer.rs                | +99  file sniffer
src/components/features/hyperview/PreviewModal.tsx | +91  preview modal
src/components/features/hyperview/renderers/*.tsx | +196 multi-format renderers
src/components/features/context/ContextView.tsx   | +63  context view integration
src/components/features/context/FileTreeNode.tsx  | +33  file tree node
src/store/usePreviewStore.ts                      | +37  preview state management
src/types/hyperview.ts                            | +18  type definitions
```

**v1.3.9 Database Structure Optimization File Changes**:
```
src-tauri/src/db.rs              | -1338 split refactor
src-tauri/src/db/mod.rs          | +17   module export
src-tauri/src/db/init.rs         | +139  initialization logic
src-tauri/src/db/models.rs       | +110  data models
src-tauri/src/db/apps.rs         | +98   apps related
src-tauri/src/db/prompts.rs      | +555  prompts related
src-tauri/src/db/project_config.rs | +132 project config
src-tauri/src/db/secrets.rs      | +78   secrets related
src-tauri/src/db/shell_history.rs | +124  shell history
src-tauri/src/db/url_history.rs  | +155  URL history
```

**Key Updates**:
- 🖼️ **HyperView File Preview**: New file preview system supporting Markdown, code, images, binary, and more
- 🔍 **Smart File Sniffing**: Auto-detect file types and select appropriate renderers
- 📂 **Context Integration**: File tree nodes now have preview button for quick content viewing
- 🗄️ **Database Modularization**: Split single-file db.rs into 9 module files, improving code maintainability
- 🎨 **Style Optimization**: Markdown renderer improvements with better syntax highlighting and typography
- ⚡ **Editor Enhancement**: Prompt editor animation and interaction experience optimization

---

### v1.3.8 (2026-01-26)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `22036bb` | **Shell Command History** | Add shell history database and autocomplete UI |
| `f3ed5a4` | **Optimize Query** | Refine fuzzy search and pagination logic |
| `e0fb4be` | **Code Optimization** | Simplify search flow and remove redundant code |
| `727c8ea` | **UX Enhancement** | Improve Spotlight search experience |
| `00922e4` | **Auto-sync Prompts** | Daily prompts library update (GitHub Actions) |
| `bdad9c1` | Release 1.3.8 | Version release |

**v1.3.8 Shell History File Changes**:
```
src-tauri/migrations/V2__shell_history.sql              | +12  new migration
src-tauri/src/db.rs                                      | +234 database refactoring
src-tauri/src/main.rs                                    | +3   history API
src/components/features/spotlight/hooks/useSpotlightSearch.ts | +75 history search
src/components/features/spotlight/modes/search/SearchMode.tsx | +74 UI interaction
src/types/spotlight.ts                                   | +6  type definitions
```

**Key Updates**:
- 📜 **Shell History Database**: New `shell_history` table with command, timestamp, execution_count
- 🔍 **Smart Autocomplete**: Fuzzy search shell history with real-time suggestions
- ⚡ **Quick Execution**: Tab/Enter to autocomplete, immediate execution on confirm
- 🎨 **Visual Distinction**: Orange for execute, Indigo for history items
- 📊 **Usage Tracking**: Automatic command execution count tracking
- 🚀 **Performance**: Parallel search with query debouncing (100ms)

---

### v1.3.7 (2026-01-25)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `4964586` | **Optimize Mirror Download** | Adjust mirror priority, use Promise.any parallel requests |
| `560171d` | **Auto-sync Prompts Library** | Add daily auto-update prompts library workflow |
| `4964586` | **Optimize Save Filename** | Context save uses project_name_date format as default |
| `ef6267d` | Release 1.3.7 | Version release |

**v1.3.7 Mirror Download Optimization File Changes**:
```
src/store/usePromptStore.ts | -15 +15 mirror priority adjustment, Promise.any parallel requests
```

**v1.3.7 Save Filename Optimization File Changes**:
```
src/components/features/context/ContextView.tsx | +25 default filename generation logic
```

**v1.3.7 Prompts Auto-Sync File Changes**:
```
.github/workflows/update-prompts.yml | +105 daily auto-sync workflow
build/dist/packs/                   | renamed to commands/
build/dist/packs/commands/*.json    | restructured prompt data pack
```

**Key Updates**:
- 🚀 **Promise.any Parallel Requests**: Store download and Manifest fetch use parallel requests, first success returns
- 🌍 **Mirror Priority Optimization**: Gitee (China) -> GitHub Raw -> jsDelivr CDN
- 📁 **Smart Default Filename**: Context save auto-uses `{project_name}_{date}.txt` format
- 🔄 **Prompts Auto-Sync**: GitHub Actions daily auto-update awesome-chatgpt-prompts and tldr-pages
- 📦 **Data Pack Restructure**: `packs` directory renamed to `commands`, clearer classification
- 📄 **License Update**: Added NOTICES.md license declaration

---

### v1.3.6 (2026-01-22)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `dd1871f` | **Optimize Database Migration** | Introduced Refinery migration framework with legacy database patch support |
| `a888718` | Release 1.3.6 | Version release |

**v1.3.6 Database Migration Optimization File Changes**:
```
src-tauri/migrations/V1__baseline.sql | +114 baseline migration script
src-tauri/Cargo.toml                   | +3   add refinery
src-tauri/src/db.rs                    | +277 database refactoring
src/components/features/patch/PatchView.tsx | +2 adapter adjustment
```

**Key Updates**:
- 🗄️ **Refinery Migration Framework**: Introduced professional database migration management tool
- 🔧 **Legacy Database Patches**: Auto-detect and patch legacy database structures
- 📊 **Baseline Migration V1**: Unified database schema definition
- 🛡️ **Robustness Improvement**: Column existence checks, transaction protection

---

### v1.3.5 (2026-01-21)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `a4ca88e` | **Fix BUG** | Fixed issues related to 1.3.5 |
| `dc0be15` | **Add Template AI** | Prompts support chat template feature |
| `f71510b` | Release 1.3.5 | Version release |

**v1.3.5 Template AI Feature File Changes**:
```
src-tauri/src/db.rs                                | +97  database field extension
src-tauri/src/main.rs                              | +2   command registration
src/SpotlightApp.tsx                               | +5   click handling
src/components/features/prompts/dialogs/PromptEditorDialog.tsx | +92  editor enhancement
src/components/features/spotlight/core/ChatCommandMenu.tsx    | +113 command menu
src/components/features/spotlight/core/SearchBar.tsx          | +257 search bar refactor
src/components/features/spotlight/core/SpotlightContext.tsx   | +31  context
src/components/features/spotlight/hooks/useSpotlightChat.ts   | +54  chat logic
src/lib/template.ts                                | +29  template engine
src/store/usePromptStore.ts                        | +15  state management
src/types/prompt.ts                                | +3   type definition
```

**Key Updates**:
- 🤖 **Template AI**: Prompts can be configured as chat templates for auto-application
- 💬 **Command Menu**: Spotlight added slash command menu (/)
- 🔍 **Search Enhancement**: Search bar refactor with more complex filtering and sorting
- 🎨 **Editor Enhancement**: Prompt editor UI optimization

---

### v1.3.4 (2026-01-18)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `834a1d0` | **Fix BUG** | Fixed multiple issues |
| `8f28fa8` | Release 1.3.4 | Version release |

**Key Updates**:
- 🐛 **Bug Fixes**: Fixed Spotlight chat mode issues

---

### v1.3.3 (2026-01-18)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `d45ae11` | Release 1.3.3 | Version release |
| `34c32a0` | Release 1.3.2 | Version release |
| `0476720` | **Spotlight Enhancement** | Added calculator, shell commands, scope search |
| `828d088` | **i18n Improvement** | Unified all hardcoded strings to getText calls |
| `967da22` | **Performance Optimization** | Static regex, loading short-circuit optimization |

**v1.3.3 Spotlight Enhancement File Changes**:
```
src/types/spotlight.ts              | +12 new SearchScope and math/shell types
src/lib/calculator.ts               | +45 math expression calculator
src/components/features/spotlight/core/SpotlightContext.tsx | +8 searchScope state
src/components/features/spotlight/core/SearchBar.tsx        | +120 prefix recognition and Tag UI
src/components/features/spotlight/hooks/useSpotlightSearch.ts | +85 search logic refactor
src/components/features/spotlight/modes/search/SearchMode.tsx | +45 UI adaptation
src/lib/i18n.ts                     | +24 new i18n entries
src/SpotlightApp.tsx                | +12 click handling logic
```

**v1.3.3 i18n Optimization File Changes**:
```
src/App.tsx                          | +2 getText import
src/components/settings/SettingsModal.tsx | +6 getText calls
src/components/features/monitor/tabs/EnvFingerprint.tsx | +2 getText calls
```

**v1.3.3 Performance Optimization**:
```
src/lib/calculator.ts                | static regex, long float limit
src/components/features/spotlight/hooks/useSpotlightSearch.ts | calc/shell mode short-circuit
```

**Key Updates**:
- 🧮 **Calculator Mode**: Type `=1+1`, `=sin(pi)` for quick calculations
- 💻 **Shell Commands**: Type `>ls`, `>dir` to execute commands
- 📂 **Scope Search**: `/app` for apps, `/cmd` for commands, `/pmt` for prompts
- 🏷️ **Tag Interaction**: VSCode-like search scope tag UI
- 🌍 **i18n Unification**: All hardcoded strings migrated to i18n system
- ⚡ **Performance Optimization**: Regex reuse, loading state short-circuit

---

### v1.3.1 (2026-01-18)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `8353dfa` | Release 1.3.1 | Version release |
| `04fff71` | **Optimize Git Diff** | Working Directory comparison, Rayon parallel processing, CRLF optimization |
| `2546dab` | Optimize Performance | Overall performance optimization |

**v1.3.1 Git Diff Optimization File Changes**:
```
src-tauri/src/git.rs                           | +118 Rayon parallel processing
src/components/features/patch/PatchSidebar.tsx | +14  workspace options
src/components/features/patch/PatchView.tsx    | +11  default diff logic
```

**Key Updates**:
- ⚡ **Parallel Processing**: Rayon parallel file reading, significantly faster for large projects
- 🔄 **Working Directory Support**: Added "__WORK_DIR__" virtual version for unsaved changes
- 🪟 **CRLF Optimization**: Fixed Windows line ending issues
- 🛡️ **Memory Optimization**: Large file pre-checks to prevent OOM

---

### v1.3.0 (2026-01-16)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `aae7ac5` | Release 1.3.0 | Version release |
| `547308a` | **Add Config Memory** | Context assembly configuration auto-saves to database |
| `1cff1eb` | **Add Whitelist** | Security scan supports ignoring specific secrets |
| `9e6a3e4` | Optimize Performance | Performance tuning |
| `528cf9c` | Optimize Performance | Performance optimization |

**v1.3.0 Config Memory File Changes**:
```
src-tauri/src/db.rs                       | +148 database table extension
src-tauri/src/main.rs                     | +4
src/components/settings/SettingsModal.tsx | +88 settings UI enhancement
src/store/useContextStore.ts              | +39 state persistence
src/lib/i18n.ts                           | +18 i18n
```

**v1.3.0 Whitelist Management File Changes**:
```
src-tauri/src/db.rs                                | +93
src-tauri/src/main.rs                              | +34
src/components/features/context/ScanResultDialog.tsx | +145
src/components/settings/IgnoredSecretsManager.tsx  | +124 whitelist management UI
src/components/settings/SettingsModal.tsx          | +14
src/lib/i18n.ts                                    | +28
```

**Key Updates**:
- 💾 **Configuration Persistence**: Context assembly filters, settings auto-save
- 🔓 **Whitelist Management**: Security scan supports false positive whitelisting
- 📝 **UI Optimization**: Settings UI refactor, whitelist management as separate Tab

---

### v1.2.5 (2026-01-14)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `a96a00b` | Release 1.2.5 | Version release |
| `ecafbf3` | **Add Python Support** | Command executor supports Python scripts |
| `1a33162` | Optimize Top Process | Process monitoring optimization |

**v1.2.5 Python Support File Changes**:
```
src-tauri/capabilities/migrated.json               | 4 +-
src/lib/command_executor.ts                        | +145 command executor refactor
src/types/prompt.ts                                | +2
```

**Key Updates**:
- 🐍 **Python Integration**: Command executor supports Python script execution
- ⚙️ **Command Execution Refactor**: Enhanced cross-platform command execution

---

### v1.2.4 (2026-01-12)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `794cab3` | Release 1.2.4 | Version release |
| `228472a` | i18n | i18n improvement |
| `76e346d` | Optimize UX | User experience optimization |

**Key Updates**:
- 🌍 **i18n Improvement**: More language support
- ✨ **UX Optimization**: Interaction details refinement

---

### v1.2.0 (2025-12-27)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `7087b4a` | Release 1.2.0 | Version release |
| `d9b47d9` | Optimize | Backend code optimization |
| `dd8045b` | Optimize | Frontend component optimization |
| `6fbf449` | Optimize | Performance tuning |
| `486466f` | Optimize | UI interaction optimization |
| `02cbcf9` | Optimize | State management optimization |
| `234e7da` | Optimize | Store optimization |
| `fe2002e` | Optimize | Code refactor |
| `9a50a93` | **SQL Introduction** | Refactor prompt storage, introduce SQLite database |
| `31fb4d5` | Optimize | SQL query optimization |
| `f8819bc` | Backend Optimize | Rust code optimization |
| `90ef62c` | Backend Optimize | Command handling optimization |
| `7329624` | Optimize Footprint | Reduced memory and CPU usage |

**v1.2.0 File Change Statistics**:
```
src-tauri/Cargo.toml                    |   +4
src-tauri/src/db.rs                     | +307 ++++++++++++
src-tauri/src/main.rs                   |  36 +-
src/components/features/prompts/PromptView.tsx | -254 ++++++++---------
src/store/usePromptStore.ts             | -441 ++++++++++++-----------
5 files changed, 609 insertions(+), 433 deletions(-)
```

**Key Updates**:
- 🔄 **Database Refactor**: Prompt storage migrated from JSON to SQLite, improved big data performance
- ⚡ **Performance Optimization**: Overall resource usage reduced by ~20%

---

### v1.1.7 (2025-12-26)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `647db08` | Release 1.1.7 | Version release |
| `cbf6f31` | Add | Feature component addition |
| `d0c7e6a` | Optimize | UI optimization |
| `b056212` | **Optimize Selection Logic** | Improved file tree and code block selection interaction |
| `8da8236` | Delete | Remove redundant code |
| `8ad5868` | Optimize | Code cleanup |
| `4f4d1b8` | Optimize | Style adjustment |
| `a256e8b` | Add | Scan result export feature |
| `379ab53` | Add | Context preview enhancement |
| `a4f0c5f` | Optimize | Performance optimization |
| `79b6556` | **Add gitleaks Module** | Integrated code security scanning ruleset |
| `06c1376` | **Add Privacy Scan** | Implemented sensitive information detection engine |

**v1.1.7 Privacy Scan Feature File Changes**:
```
src-tauri/src/security/engine.rs      | +110 core scan engine
src-tauri/src/security/entropy.rs     | +36  entropy calculation
src-tauri/src/security/mod.rs         | +14  module export
src-tauri/src/security/rules.rs       | +70  scan rules
src-tauri/src/security/stopwords.rs   | +105 whitelist words
src/components/features/context/ContextView.tsx        | +141
src/components/features/context/ScanResultDialog.tsx   | +122
src/components/features/context/TokenDashboard.tsx     | +33
12 files changed, 619 insertions(+), 44 deletions(-)
```

**v1.1.7 Gitleaks Security Scan Module File Changes**:
```
src-tauri/src/gitleaks/allowlist.rs              | +55  whitelist
src-tauri/src/gitleaks/mod.rs                    | +129 module entry
src-tauri/src/gitleaks/rule.rs                   | +27  rule definition
src-tauri/src/gitleaks/rules_ai.rs               | +78  AI-related rules
src-tauri/src/gitleaks/rules_cloud.rs            | +160 cloud service rules
src-tauri/src/gitleaks/rules_communication.rs    | +147 communication rules
src-tauri/src/gitleaks/rules_package.rs          | +179 package manager rules
src-tauri/src/gitleaks/rules_payment.rs          | +125 payment rules
src-tauri/src/gitleaks/rules_remaining.rs        | +203 other rules
src-tauri/src/main.rs                            | +15
11 files changed, 1119 insertions(+), 4 deletions(-)
```

**Key Updates**:
- 🔒 **Privacy Scan**: Sensitive information detection via regex and entropy calculation
- 🛡️ **Gitleaks Integration**: Supports 8 major security rule categories:
  - AI Keys (OpenAI, Anthropic, etc.)
  - Cloud Service Credentials (AWS, Azure, GCP, etc.)
  - Payment Gateways (Stripe, Square, PayPal, etc.)
  - Communication App Keys (Slack, Discord, etc.)
  - Package Manager Keys (NPM, PyPI, etc.)

---

### v1.1.6 (2025-12-18)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `ea31473` | Fix Build | Use vendored openssl, version bump to 1.1.6 |
| `8c6a6da` | Fix Build | Fixed macOS universal build support |

**Key Updates**:
- Resolved OpenSSL dependency issues
- Support Apple Silicon universal binary build

---

### v1.1.5 (2025-12-18)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `f7b51ea` | Release 1.1.5 | Version release |
| `ce49a34` | Optimize | UI optimization |
| `a63ae70` | Optimize | Interaction optimization |
| `e4d66cb` | Optimize | Code optimization |
| `37049a7` | Log Optimize | Log system improvement |
| `cc2b8c5` | Optimize | Performance optimization |
| `8cc7763` | Optimize | Style adjustment |
| `93a8dff` | Optimize | Component optimization |
| `47c33ef` | Optimize | State management optimization |
| `431f085` | Add | Commit selector component |
| `ce8336f` | Optimize | Code cleanup |
| `747e459` | Optimize | Refactor optimization |
| `04dacca` | **Add git diff** | Integrated Git Diff visualization |

**v1.1.5 Git Diff Feature File Changes**:
```
src-tauri/src/main.rs                  | +157 command registration
src/components/features/patch/CommitSelector.tsx | +128 commit selector
src/components/features/patch/DiffWorkspace.tsx  | +-28 workspace
src/components/features/patch/PatchSidebar.tsx   | +-284 sidebar
src/components/features/patch/PatchView.tsx      | +-416 main view
src/components/features/patch/patch_types.ts     | +-7  type definition
6 files changed, 686 insertions(+), 334 deletions(-)
```

**Key Updates**:
- 📊 **Git Diff Visualization**: View code differences between any two commits
- 🔀 **Commit Selector**: Dropdown to select historical commits for comparison
- 📦 **Multiple Export Formats**: Support HTML, JSON, Markdown exports

---

### v1.1.4 (2025-12-16)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `bddd26e` | Release 1.1.4 | Version release |
| `8af3223` | Optimize | Code optimization |
| `010c2d6` | Add | Filter management feature |
| `9aa51b9` | Optimize | Filter logic optimization |
| `adb64fa` | Optimize | Context assembly optimization |
| `1c38713` | Optimize | Token calculation optimization |
| `50acca4` | Optimize | Tree structure optimization |
| `25dd382` | Optimize | File tree optimization |
| `e00dc4a` | Optimize | Interaction optimization |
| `d231b05` | Optimize | Search optimization |
| `f1fe6a3` | Optimize | Hotkey optimization |
| `9dabaab` | Optimize | Hotkey handling optimization |
| `94621d4` | Optimize | Notification system optimization |

**Key Updates**:
- 🔍 **File Filters**: Filter by file type, size, path, etc.
- 📁 **Context Assembly**: Select specific files/directories for combination

---

### v1.1.3 (2025-12-14)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `696303e` | Release 1.1.3 | Version release |
| `e8303dc` | Add | Export feature |
| `7303fcd` | **Logo Replacement** | Brand visual upgrade |
| `49d79cc` | **Optimize Notification** | Notification system refactor |
| `87a5ecd` | Optimize | UI optimization |

**v1.1.3 Logo Replacement File Changes** (54 files):
```
images/logo.png                     | new Logo image (320KB)
src-tauri/icons/*                   | multi-size app icons
src-tauri/icons/android/*           | Android platform icons
src-tauri/icons/ios/*               | iOS platform icons
```

**Key Updates**:
- 🎨 **Brand Upgrade**: New logo design, multi-platform icon adaptation
- 🔔 **Notification System**: Support operation result notifications, error hints, progress hints

---

### v1.1.2 (2025-12-04)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `ba2b14a` | Release 1.1.2 | Version release |
| `2c58cab` | Update | Version number update |
| `561b20a` | Update | Configuration update |
| `23b5bbb` | **Optimize Custom Hotkey** | Support custom hotkey and wake method configuration |

**Key Updates**:
- ⌨️ **Custom Hotkey**: Support custom global wake hotkey
- 🎯 **Wake Method**: Support tray icon click, hotkey, and other wake methods

---

### v1.1.1 (2025-12-04)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `c92574f` | Release 1.1.1 | Version release |
| `f61a5ff` | Optimize | Basic feature optimization |
| `baf2876` | Optimize | Code completion |

---

### v1.1.0 Early Version (2025-12 Early)

| Commit Hash | Change | Description |
|-------------|--------|-------------|
| `2df3e62` | **Add Clock Feature** | Title bar integrated real-time clock display |

**v1.1.0 Clock Feature File Changes**:
```
src/components/ui/ClockPopover.tsx | +301 clock popover component
src/components/layout/TitleBar.tsx | +-24 title bar integration
src/components/settings/SettingsModal.tsx | +-68 clock config in settings
src/lib/i18n.ts                   | +-44 i18n support
14 files changed, 1177 insertions(+), 29 deletions(-)
```

---

## Core Feature Evolution

### 1. Context Forge (File Assembly)
| Version | Feature |
|---------|---------|
| v1.2.4 | i18n improvement |
| v1.2.5 | Python script support |
| v1.3.0 | Configuration auto-save |
| v1.3.0 | Whitelist management |
| v1.3.1 | Rayon parallel processing |

### 2. Spotlight (Global AI Terminal)
| Version | Feature |
|---------|---------|
| Initial | Global hotkey wake (`Alt+S`) |
| v1.1.2 | Custom hotkey configuration |
| v1.1.3 | Notification system integration |
| v1.3.3 | Calculator mode (`=`) |
| v1.3.3 | Shell command execution (`>`) |
| v1.3.3 | Scope search (`/app`, `/cmd`, `/pmt`) |
| v1.3.3 | Tag interaction UI |

### 3. Prompt Verse (Prompt Library)
| Version | Feature |
|---------|---------|
| Initial | Basic prompt management |
| v1.2.0 | SQLite database refactor, significant performance improvement |

### 4. Patch Weaver (AI Completer & Git Diff)
| Version | Feature |
|---------|---------|
| v1.1.5 | Git Diff visualization |
| v1.1.5 | Commit selector |
| v1.1.5 | Multi-format export |
| v1.3.1 | Working Directory comparison |
| v1.3.1 | Rayon parallel processing |
| v1.3.1 | CRLF line ending optimization |

---

## Security Feature Evolution

### Privacy Scan Engine (v1.1.7)

**Core Components**:
- `engine.rs`: Scan engine main program
- `entropy.rs`: Shannon entropy calculation (detect high-randomness keys)
- `rules.rs`: Regex rule set
- `stopwords.rs`: Whitelist words (filter false positives)
- `allowlist.rs`: Value whitelist (UUID, Git SHA, URL, etc.)

**Detection Flow**:
```
File Content → Regex Matching → Entropy Calculation → Whitelist Filtering → Risk Level
```

### Gitleaks Security Rules (v1.1.7)

**Rule Categories**:
| Category | Examples |
|----------|----------|
| AI Keys | OpenAI API Key, Anthropic Key |
| Cloud Services | AWS Access Key, Azure SAS Token |
| Payment Gateways | Stripe, Square, PayPal |
| Communication Apps | Slack, Discord, Twilio |
| Package Managers | NPM, PyPI, RubyGems |
| Databases | MongoDB, PostgreSQL connection strings |
| Generic Keys | Generic API Key, Bearer Token |

### Whitelist Management (v1.3.0)

**New Features**:
- UI-based whitelist management (`IgnoredSecretsManager.tsx`)
- Whitelist persistence (SQLite)
- Regex whitelist support

---

## Automation

### Prompt Library Auto-Sync
```yaml
# GitHub Actions
Trigger: Daily or upstream update
Action: Sync awesome-chatgpt-prompts and tldr-pages
Commit: github-actions[bot]
```

---

## Build & Release

### Release Process
```
1. Feature development complete
2. Code review (GitHub PR)
3. Version update (package.json, Cargo.toml)
4. GitHub Actions auto-build
5. Generate installer
```

### Current Build Status
| Platform | Install Size | Memory |
|----------|--------------|--------|
| Windows | ~10 MB | ~30 MB |
| macOS | ~15 MB | ~35 MB |

---

## Directory Structure

```
ctxrun/
├── src/                      # React frontend source
│   ├── components/           # UI components
│   │   ├── features/         # Feature components
│   │   │   ├── context/      # Context assembly
│   │   │   ├── prompts/      # Prompt management
│   │   │   └── patch/        # Code diff
│   │   ├── layout/           # Layout components
│   │   ├── settings/         # Settings UI
│   │   └── ui/               # Base UI
│   ├── lib/                  # Utilities
│   ├── store/                # Zustand state management
│   └── types/                # TypeScript types
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── db.rs             # SQLite database
│   │   ├── git.rs            # Git operations (with Rayon parallel)
│   │   ├── gitleaks/         # Security scan
│   │   ├── monitor.rs        # Process monitoring
│   │   └── main.rs           # Entry point
│   └── Cargo.toml
├── build/dist/               # Pre-built resources
│   └── packs/                # Prompt data packs
└── models/                   # LLM model configurations
```

---

*Document last updated: 2026-01-28*
*Compiled based on git commit history and code diff analysis*
