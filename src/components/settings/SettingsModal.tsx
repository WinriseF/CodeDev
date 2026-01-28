import { useState, useRef, useEffect } from 'react';
import { X, Monitor, Moon, Sun, Languages, Check, Filter, DownloadCloud, Bot, Bell, Database, Upload, Download, FileSpreadsheet, AlertTriangle, FolderCog, Shield, RefreshCw, AppWindow, Edit3, Info, Search as SearchIcon } from 'lucide-react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { usePromptStore } from '@/store/usePromptStore';
import { getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { FilterManager } from '../features/context/FilterManager';
import { PromptLibraryManager } from './PromptLibraryManager';
import { IgnoredSecretsManager } from './IgnoredSecretsManager';
import { ShortcutInput } from '@/components/ui/ShortcutInput';
import { AboutSection } from './AboutSection';
import { SearchEngineIcon } from '@/components/ui/SearchEngineIcon';

export function SettingsModal() {
  const {
    isSettingsOpen, setSettingsOpen,
    theme, setTheme,
    language, setLanguage,
    globalIgnore, updateGlobalIgnore,
    aiConfig, setAIConfig,
    savedProviderSettings,
    renameAIProvider,
    spotlightShortcut, setSpotlightShortcut,
    restReminder, setRestReminder,
    spotlightAppearance, setSpotlightAppearance,
    searchSettings, setSearchSettings
  } = useAppStore();

  const { loadPrompts, refreshGroups, refreshCounts } = usePromptStore();

  const [activeSection, setActiveSection] = useState<'appearance' | 'language' | 'filters' | 'library' | 'ai' | 'data' | 'security' | 'about' | 'search'>('appearance');
  const [importStatus, setImportStatus] = useState<string>('');
  const [isScanningApps, setIsScanningApps] = useState(false);

  // --- 新增：重命名相关的局部状态 ---
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 当进入重命名模式时，自动聚焦输入框
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
        renameInputRef.current.focus();
    }
  }, [isRenaming]);

  // 处理重命名提交
  const handleRenameSubmit = () => {
      if (renameValue.trim()) {
          renameAIProvider(aiConfig.providerId, renameValue.trim());
      }
      setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRenameSubmit();
      if (e.key === 'Escape') setIsRenaming(false);
  };
  // --- 结束新增状态 ---

  // 导出处理函数
  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
        defaultPath: `codeforge_prompts_${new Date().toISOString().split('T')[0]}.csv`
      });

      if (!filePath) return;

      const count = await invoke<number>('export_prompts_to_csv', { savePath: filePath });
      setImportStatus(`${getText('settings', 'exportSuccess', language)}: ${count} items`);
    } catch (e) {
      console.error(e);
      setImportStatus(`Export failed: ${e}`);
    }
  };

  // 导入处理函数
  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
        multiple: false
      });

      if (!filePath || typeof filePath !== 'string') return;

      const isOverwrite = confirm(getText('settings', 'importModeMsg', language));
      const mode = isOverwrite ? 'overwrite' : 'merge';

      setImportStatus(getText('settings', 'loading', language));
      const count = await invoke<number>('import_prompts_from_csv', {
        filePath,
        mode
      });

      setImportStatus(`${getText('settings', 'importSuccess', language)}: ${count} items`);

      // 刷新数据
      await loadPrompts(true);
      await refreshGroups();
      await refreshCounts();

    } catch (e) {
      console.error(e);
      setImportStatus(`Import failed: ${e}`);
    }
  };

  // 导出项目配置
  const handleExportProjectConfigs = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'JSON Config', extensions: ['json'] }],
        defaultPath: `ctxrun_project_configs_${new Date().toISOString().split('T')[0]}.json`
      });

      if (!filePath) return;

      const count = await invoke<number>('export_project_configs', { savePath: filePath });
      setImportStatus(`${getText('settings', 'exportSuccess', language)}: ${count} projects`);
    } catch (e) {
      console.error(e);
      setImportStatus(`Export failed: ${e}`);
    }
  };

  // 导入项目配置
  const handleImportProjectConfigs = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON Config', extensions: ['json'] }],
        multiple: false
      });

      if (!filePath || typeof filePath !== 'string') return;

      const isOverwrite = confirm(getText('settings', 'importProjectConfigMsg', language));
      const mode = isOverwrite ? 'overwrite' : 'merge';

      setImportStatus(getText('settings', 'loading', language));
      const count = await invoke<number>('import_project_configs', {
        filePath,
        mode
      });

      setImportStatus(`${getText('settings', 'importSuccess', language)}: ${count} projects`);
    } catch (e) {
      console.error(e);
      setImportStatus(`Import failed: ${e}`);
    }
  };

  // 刷新应用索引
  const handleRefreshApps = async () => {
    setIsScanningApps(true);
    setImportStatus(getText('common', 'loading', language));
    try {
      const msg = await invoke<string>('refresh_apps');
      setImportStatus(msg);
    } catch (e) {
      setImportStatus(`Scan failed: ${e}`);
    } finally {
      setIsScanningApps(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      
      <div className="w-full max-w-[600px] h-full max-h-[500px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-secondary/10 shrink-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <SettingsIcon />
            {getText('settings', 'title', language)}
          </h2>
          <button 
            onClick={() => setSettingsOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Sidebar Navigation */}
            <div className="w-40 bg-secondary/5 border-r border-border p-2 space-y-1 overflow-y-auto custom-scrollbar shrink-0">
                <NavBtn active={activeSection === 'appearance'} onClick={() => setActiveSection('appearance')} icon={<Monitor size={14} />} label={getText('settings', 'navAppearance', language)}  />
                <NavBtn active={activeSection === 'language'} onClick={() => setActiveSection('language')} icon={<Languages size={14} />} label={getText('settings', 'navLanguage', language)} />
                <NavBtn active={activeSection === 'search'} onClick={() => setActiveSection('search')} icon={<SearchIcon size={14} />} label={getText('settings', 'navSearch', language)} />
                <NavBtn active={activeSection === 'ai'} onClick={() => setActiveSection('ai')} icon={<Bot size={14} />} label={getText('settings', 'navAI', language)} />
                <NavBtn active={activeSection === 'security'} onClick={() => setActiveSection('security')} icon={<Shield size={14} />} label={getText('settings', 'navSecurity', language)} />
                <div className="my-2 h-px bg-border/50 mx-2" />
                <NavBtn active={activeSection === 'filters'} onClick={() => setActiveSection('filters')} icon={<Filter size={14} />} label={getText('settings', 'navFilters', language)} />
                <NavBtn active={activeSection === 'library'} onClick={() => setActiveSection('library')} icon={<DownloadCloud size={14} />} label={getText('settings', 'navLibrary', language)} />
                <NavBtn active={activeSection === 'data'} onClick={() => setActiveSection('data')} icon={<Database size={14} />} label={getText('settings', 'navData', language)} />
                <div className="my-2 h-px bg-border/50 mx-2" />
                <NavBtn active={activeSection === 'about'} onClick={() => setActiveSection('about')} icon={<Info size={14} />} label={getText('settings', 'navAbout', language)} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-0 overflow-hidden min-w-0 flex flex-col relative bg-background">
                {activeSection === 'about' ? (
                    <AboutSection />
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar p-6">
                        {activeSection === 'appearance' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {getText('settings', 'appearance', language)}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ThemeCard active={theme === 'dark'} onClick={() => setTheme('dark')} icon={<Moon size={24} />} label={getText('settings', 'themeDark', language)} />
                            <ThemeCard active={theme === 'light'} onClick={() => setTheme('light')} icon={<Sun size={24} />} label={getText('settings', 'themeLight', language)} />
                        </div>
                        
                        <div className="w-full h-px bg-border/50 my-4" />

                        {/* 快捷键设置 */}
                        <ShortcutInput value={spotlightShortcut} onChange={setSpotlightShortcut} />

                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                {getText('settings', 'spotlightSize', language)}
                            </h3>
                            
                            {/* Width Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span>{getText('settings', 'width', language)}</span>
                                    <span className="font-mono text-muted-foreground">{spotlightAppearance.width}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="500" 
                                    max="1000" 
                                    step="20"
                                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={spotlightAppearance.width}
                                    onChange={(e) => setSpotlightAppearance({ width: parseInt(e.target.value) })}
                                />
                            </div>

                            {/* Default Height Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span>{getText('settings', 'defaultHeight', language)}</span>
                                    <span className="font-mono text-muted-foreground">{spotlightAppearance.defaultHeight}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="150" 
                                    max="800" 
                                    step="10"
                                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={spotlightAppearance.defaultHeight}
                                    onChange={(e) => setSpotlightAppearance({ defaultHeight: parseInt(e.target.value) })}
                                />
                            </div>

                            {/* Max Chat Height Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span>{getText('settings', 'chatHeight', language)}</span>
                                    <span className="font-mono text-muted-foreground">{spotlightAppearance.maxChatHeight}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="400" 
                                    max="900" 
                                    step="50"
                                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={spotlightAppearance.maxChatHeight}
                                    onChange={(e) => setSpotlightAppearance({ maxChatHeight: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="w-full h-px bg-border/50 my-4" />

                        {/* 休息提醒设置 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <Bell size={14} />
                                {getText('settings', 'restReminder', language)}
                            </h3>
                            
                            <div className="space-y-3">
                                {/* 启用开关 */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">
                                            {getText('settings', 'restReminderEnabled', language)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {getText('settings', 'restReminderDesc', language)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setRestReminder({ enabled: !restReminder.enabled })}
                                        className={cn(
                                            "relative w-11 h-6 rounded-full transition-colors",
                                            restReminder.enabled ? "bg-primary" : "bg-secondary"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                                            restReminder.enabled ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>

                                {/* 间隔时间设置 */}
                                {restReminder.enabled && (
                                    <div className="space-y-3 p-3 rounded-lg bg-secondary/10 border border-border">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-foreground">
                                                {getText('settings', 'restReminderInterval', language)}
                                            </span>
                                            <span className="font-mono text-muted-foreground">
                                                {restReminder.intervalMinutes} {getText('settings', 'minutes', language)}
                                            </span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="180" 
                                            step="1"
                                            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                            value={restReminder.intervalMinutes}
                                            onChange={(e) => setRestReminder({ intervalMinutes: parseInt(e.target.value) })}
                                        />
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>1 {getText('settings', 'minutes', language)}</span>
                                            <span>180 {getText('settings', 'minutes', language)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeSection === 'language' && (
                     <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {getText('settings', 'language', language)}
                        </h3>
                        <div className="space-y-2">
                            <LangItem active={language === 'zh'} onClick={() => setLanguage('zh')} label={getText('settings', 'langZh', language)} subLabel={getText('settings', 'langSubLabelZh', language)} />
                            <LangItem active={language === 'en'} onClick={() => setLanguage('en')} label={getText('settings', 'langEn', language)} subLabel={getText('settings', 'langSubLabelEn', language)} />
                        </div>
                     </div>
                )}

                {activeSection === 'search' && (
                    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-200 overflow-y-auto custom-scrollbar">
                        <div>
                            <h3 className="text-sm font-medium text-foreground">{getText('settings', 'searchTitle', language)}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{getText('settings', 'searchDesc', language)}</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'defaultEngine', language)}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <ThemeCard
                                    active={searchSettings.defaultEngine === 'google'}
                                    onClick={() => setSearchSettings({ defaultEngine: 'google' })}
                                    icon={<SearchEngineIcon engine="google" size={24} />}
                                    label={getText('settings', 'engineGoogle', language)}
                                />
                                <ThemeCard
                                    active={searchSettings.defaultEngine === 'bing'}
                                    onClick={() => setSearchSettings({ defaultEngine: 'bing' })}
                                    icon={<SearchEngineIcon engine="bing" size={24} />}
                                    label={getText('settings', 'engineBing', language)}
                                />
                                <ThemeCard
                                    active={searchSettings.defaultEngine === 'baidu'}
                                    onClick={() => setSearchSettings({ defaultEngine: 'baidu' })}
                                    icon={<SearchEngineIcon engine="baidu" size={24} />}
                                    label={getText('settings', 'engineBaidu', language)}
                                />
                                <ThemeCard
                                    active={searchSettings.defaultEngine === 'custom'}
                                    onClick={() => setSearchSettings({ defaultEngine: 'custom' })}
                                    icon={<SearchEngineIcon engine="custom" size={24} />}
                                    label={getText('settings', 'engineCustom', language)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border/50">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'customUrlLabel', language)}</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                placeholder="https://..."
                                value={searchSettings.customUrl}
                                onChange={e => setSearchSettings({ customUrl: e.target.value })}
                            />
                            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                {getText('settings', 'customUrlTip', language)}
                            </p>
                        </div>
                    </div>
                )}

                {activeSection === 'filters' && (
                    <div className="h-full flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-foreground">{getText('settings', 'filtersTitle', language)}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getText('settings', 'filtersDesc', language)}
                            </p>
                        </div>
                        <div className="flex-1 border border-border rounded-lg p-4 bg-secondary/5 overflow-hidden flex flex-col min-h-[200px]">
                            <FilterManager 
                                localConfig={globalIgnore} 
                                onUpdate={updateGlobalIgnore}
                            />
                        </div>
                    </div>
                )}

                {/*  Content */}
                {activeSection === 'library' && (
                    <PromptLibraryManager />
                )}

                {/*  AI 设置面板 */}
                {activeSection === 'ai' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                        <div>
                            <h3 className="text-sm font-medium text-foreground">{getText('settings', 'aiTitle', language)}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{getText('settings', 'aiDesc', language)}</p>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Provider Selection Area */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'provider', language)}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* 动态渲染 savedProviderSettings 的 keys，而不是硬编码数组 */}
                                    {Object.keys(savedProviderSettings).map((p) => {
                                        const isActive = aiConfig.providerId === p;

                                        // 如果是当前选中的项，并且处于重命名模式，渲染输入框
                                        if (isActive && isRenaming) {
                                            return (
                                                <div key={p} className="relative">
                                                    <input
                                                        ref={renameInputRef}
                                                        className="w-full py-2 px-3 rounded-md text-sm border border-primary bg-background outline-none font-medium shadow-sm"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onBlur={handleRenameSubmit}
                                                        onKeyDown={handleRenameKeyDown}
                                                    />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none">
                                                        <Check size={14} />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 常规按钮渲染
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setAIConfig({ providerId: p })}
                                                className={cn(
                                                    "group relative py-2 px-3 rounded-md text-sm border transition-all capitalize flex items-center justify-center gap-2",
                                                    isActive
                                                        ? "bg-primary/10 border-primary text-primary font-medium shadow-sm"
                                                        : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                                                )}
                                                onDoubleClick={() => {
                                                    if (isActive) {
                                                        setRenameValue(p);
                                                        setIsRenaming(true);
                                                    }
                                                }}
                                            >
                                                <span className="truncate">{p}</span>

                                                {/* 仅在选中状态下显示的编辑小图标 */}
                                                {isActive && (
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRenameValue(p);
                                                            setIsRenaming(true);
                                                        }}
                                                        className="opacity-50 hover:opacity-100 hover:bg-background/50 p-0.5 rounded transition-all cursor-pointer"
                                                        title={getText('common', 'rename', language)}
                                                    >
                                                        <Edit3 size={12} />
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-muted-foreground/60 text-right pt-1">
                                    {getText('common', 'renameHelp', language)}
                                </p>
                            </div>

                            {/* API Key */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'apiKey', language)}</label>
                                <input 
                                    type="password"
                                    className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30 font-mono"
                                    placeholder={`sk-...`}
                                    value={aiConfig.apiKey}
                                    onChange={e => setAIConfig({ apiKey: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground/60">{getText('settings', 'apiKeyTip', language)}</p>
                            </div>
                            
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'temp', language)}</label>
                                    <span className="font-mono text-sm text-foreground">{aiConfig.temperature.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={aiConfig.temperature}
                                    onChange={e => setAIConfig({ temperature: parseFloat(e.target.value) })}
                                />
                                <p className="text-[10px] text-muted-foreground/60">
                                    {getText('settings', 'tempTip', language)}
                                </p>
                            </div>

                            {/* Base URL & Model */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'baseUrl', language)}</label>
                                    <input
                                        type="text"
                                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30"
                                        placeholder={getText('settings', 'baseUrlPlaceholder', language)}
                                        value={aiConfig.baseUrl || ''}
                                        onChange={e => setAIConfig({ baseUrl: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('settings', 'modelId', language)}</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30"
                                        placeholder={aiConfig.providerId === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'}
                                        value={aiConfig.modelId}
                                        onChange={e => setAIConfig({ modelId: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Management */}
                {activeSection === 'data' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">

                        {/* 顶部标题区 */}
                        <div>
                            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <FileSpreadsheet size={18} className="text-green-600"/>
                                {getText('settings', 'dataTitle', language)}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getText('settings', 'dataDesc', language)}
                            </p>
                        </div>

                        {/* 1. Prompt 数据管理卡片 (改造成横向) */}
                        <div className="bg-secondary/20 border border-border rounded-lg p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 text-green-600 rounded-md">
                                        <Database size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium">{getText('settings', 'promptsBackup', language)}</h4>
                                        <p className="text-xs text-muted-foreground">CSV Format</p>
                                    </div>
                                </div>
                            </div>

                            {/* 双按钮并排 */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleExport}
                                    className="flex items-center justify-center gap-2 py-2 bg-background border border-border hover:border-primary/50 hover:text-primary rounded-md text-xs font-medium transition-all shadow-sm"
                                >
                                    <Download size={14} />
                                    {getText('settings', 'btnExportCsv', language)}
                                </button>
                                <button
                                    onClick={handleImport}
                                    className="flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-xs font-medium transition-all shadow-sm"
                                >
                                    <Upload size={14} />
                                    {getText('settings', 'btnImportCsv', language)}
                                </button>
                            </div>

                            {/* 导入状态提示 */}
                            {importStatus && (
                                <div className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5 pt-1 border-t border-border/30 mt-1">
                                    <Check size={10} /> {importStatus}
                                </div>
                            )}
                        </div>

                        {/* 分割线 */}
                        <div className="w-full h-px bg-border/50 my-2" />

                        {/* 2. 项目配置管理卡片 (保持横向，风格统一) */}
                        <div>
                            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <FolderCog size={18} className="text-blue-600"/>
                                {getText('settings', 'projectConfigTitle', language)}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getText('settings', 'projectConfigDesc', language)}
                            </p>
                        </div>

                        <div className="bg-secondary/20 border border-border rounded-lg p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-md">
                                        <Database size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium">{getText('settings', 'configBackup', language)}</h4>
                                        <p className="text-xs text-muted-foreground">JSON Format</p>
                                    </div>
                                </div>
                            </div>

                            {/* 双按钮并排 */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleExportProjectConfigs}
                                    className="flex items-center justify-center gap-2 py-2 bg-background border border-border hover:border-primary/50 hover:text-primary rounded-md text-xs font-medium transition-all shadow-sm"
                                >
                                    <Download size={14} />
                                    {getText('settings', 'btnExportJson', language)}
                                </button>
                                <button
                                    onClick={handleImportProjectConfigs}
                                    className="flex items-center justify-center gap-2 py-2 bg-background border border-border hover:border-primary/50 hover:text-primary rounded-md text-xs font-medium transition-all shadow-sm"
                                >
                                    <Upload size={14} />
                                    {getText('settings', 'btnImportJson', language)}
                                </button>
                            </div>
                        </div>

                        {/* 底部提示 */}
                        <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex gap-2 items-start text-xs text-yellow-600/80">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <p>{getText('settings', 'csvTip', language)}</p>
                        </div>

                        {/* 分割线 */}
                        <div className="w-full h-px bg-border/50 my-2" />

                        {/* 应用索引管理 */}
                        <div>
                            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <AppWindow size={18} className="text-cyan-600"/>
                                {getText('spotlight', 'appIndex', language)}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {getText('spotlight', 'rebuildAppIndex', language)}
                            </p>
                        </div>

                        <div className="bg-secondary/20 border border-border rounded-lg p-4 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                                {getText('spotlight', 'appIndexStored', language)}
                            </div>
                            <button
                                onClick={handleRefreshApps}
                                disabled={isScanningApps}
                                className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:border-primary/50 hover:text-primary rounded-md text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={cn(isScanningApps && "animate-spin")} />
                                {getText('spotlight', 'refreshIndexNow', language)}
                            </button>
                        </div>
                    </div>
                )}

                {/* Security & Whitelist Section */}
                {activeSection === 'security' && (
                    <IgnoredSecretsManager />
                )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("relative flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all duration-200", active ? "border-primary bg-primary/5 text-primary" : "border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:border-border/80")}>
      {active && <div className="absolute top-2 right-2 text-primary"><Check size={16} strokeWidth={3} /></div>}
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function LangItem({ active, onClick, label, subLabel }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200", active ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground hover:bg-secondary/40")}>
      <div className="flex flex-col items-start"><span className="font-medium text-sm">{label}</span><span className="text-xs text-muted-foreground opacity-70">{subLabel}</span></div>
      {active && <Check size={18} strokeWidth={2.5} />}
    </button>
  );
}

function NavBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap overflow-hidden text-ellipsis", active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <div className="shrink-0">{icon}</div> {label}
    </button>
  );
}

function SettingsIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}