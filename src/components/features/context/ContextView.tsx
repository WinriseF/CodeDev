import { useState, useMemo, useEffect, useRef } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { writeText as writeClipboard } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { 
  FolderOpen, RefreshCw, Loader2, FileJson, 
  PanelLeft, Search, ArrowRight, SlidersHorizontal, ChevronUp,
  LayoutDashboard, FileText, ArrowRightLeft
} from 'lucide-react';
import { useContextStore } from '@/store/useContextStore';
import { useAppStore, DEFAULT_MODELS } from '@/store/useAppStore'; 
import { scanProject } from '@/lib/fs_helper';
import { calculateIdealTreeWidth } from '@/lib/tree_utils';
import { calculateStats, generateContext } from '@/lib/context_assembler';
import { FileTreeNode } from './FileTreeNode';
import { TokenDashboard } from './TokenDashboard';
import { FilterManager } from './FilterManager';
import { ContextPreview } from './ContextPreview';
import { ScanResultDialog, SecretMatch } from './ScanResultDialog';
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';
import { Toast, ToastType } from '@/components/ui/Toast';

export function ContextView() {
  const { 
    projectRoot, fileTree, isScanning, 
    projectIgnore, updateProjectIgnore, 
    refreshTreeStatus, 
    setProjectRoot, setFileTree, setIsScanning, toggleSelect, 
    removeComments, detectSecrets, invertSelection 
  } = useContextStore();

  const { 
    isContextSidebarOpen, setContextSidebarOpen,
    contextSidebarWidth, setContextSidebarWidth,
    globalIgnore,
    models, language
  } = useAppStore(); 

  const [pathInput, setPathInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false); 
  const [rightViewMode, setRightViewMode] = useState<'dashboard' | 'preview'>('dashboard');

  const [toastState, setToastState] = useState<{ show: boolean; msg: string; type: ToastType }>({
      show: false,
      msg: '',
      type: 'success'
  });

  // 扫描弹窗状态
  const [scanState, setScanState] = useState<{
    isOpen: boolean;
    results: SecretMatch[];
    pendingText: string;
    pendingAction: 'copy' | 'save' | null;
  }>({
    isOpen: false,
    results: [],
    pendingText: '',
    pendingAction: null
  });

  const activeModels = (models && models.length > 0) ? models : DEFAULT_MODELS;

  useEffect(() => {
    if (projectRoot) setPathInput(projectRoot);
  }, [projectRoot]);

  useEffect(() => {
    if (fileTree.length > 0) {
      refreshTreeStatus(globalIgnore);
    }
  }, [globalIgnore, projectIgnore, refreshTreeStatus]);

  const stats = useMemo(() => {
    return calculateStats(fileTree);
  }, [fileTree]);

  const triggerToast = (msg: string, type: ToastType = 'success') => {
    setToastState({ show: true, msg, type });
  };

  // 通用执行器：执行最终的复制或保存
  const executeFinalAction = async (text: string, action: 'copy' | 'save') => {
      try {
          if (action === 'copy') {
              await writeClipboard(text);
              const actualTokens = Math.ceil(text.length / 4); // 简单估算用于日志
              console.log(`Context copied! Approx tokens: ${actualTokens}`);
              triggerToast(getText('context', 'toastCopied', language), 'success');
          } else if (action === 'save') {
              // 保存流程：先弹窗选路径，再写入
              const filePath = await save({
                  filters: [{ name: 'Text File', extensions: ['txt', 'md', 'json'] }],
                  defaultPath: 'context.txt'
              });
              if (!filePath) return; // 用户取消保存
              
              await writeTextFile(filePath, text);
              triggerToast(getText('context', 'toastSaved', language), 'success');
          }
      } catch (err) {
          console.error("Action failed:", err);
          triggerToast(action === 'copy' ? getText('context', 'toastCopyFail', language) : getText('context', 'toastSaveFail', language), 'error');
      }
  };

  // 安全检查流程
  const processWithSecurityCheck = async (text: string, action: 'copy' | 'save') => {
      // 1. 如果开关关闭，直接执行
      if (!detectSecrets) {
          await executeFinalAction(text, action);
          return;
      }

      // 2. 调用 Rust 进行扫描
      try {
          const results = await invoke<SecretMatch[]>('scan_for_secrets', { content: text });
          
          if (results && results.length > 0) {
              setScanState({
                  isOpen: true,
                  results,
                  pendingText: text,
                  pendingAction: action
              });
          } else {
              await executeFinalAction(text, action);
          }
      } catch (e) {
          console.error("Security scan failed:", e);
          triggerToast("Security scan error, proceeding anyway.", 'warning');
          await executeFinalAction(text, action);
      }
  };

  // 处理弹窗确认
  const handleScanConfirm = async (indicesToRedact: Set<number>) => {
      const { pendingText, pendingAction, results } = scanState;
      if (!pendingAction) return;

      let finalText = pendingText;

      if (indicesToRedact.size > 0) {
          const sortedResults = [...results].sort((a, b) => b.index - a.index);
          
          for (const match of sortedResults) {
              if (!indicesToRedact.has(match.index)) {
                  continue;
              }
              const jsIndex = match.utf16_index; 
              const val = match.value;
              let maskedValue = '';
              if (val.length <= 8) {
                  maskedValue = '*'.repeat(val.length);
              } else {
                  const visiblePart = val.substring(0, 8);
                  const maskedPart = 'X'.repeat(val.length - 8);
                  maskedValue = visiblePart + maskedPart;
              }
              const before = finalText.substring(0, jsIndex);
              const after = finalText.substring(jsIndex + val.length);
              finalText = before + maskedValue + after;
          }
      }

      setScanState(prev => ({ ...prev, isOpen: false }));
      await executeFinalAction(finalText, pendingAction);
  };

  const handleCopyContext = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const { text } = await generateContext(fileTree, { removeComments });
      await processWithSecurityCheck(text, 'copy');
    } catch (err) {
      console.error("Failed to generate:", err);
      triggerToast("Generation failed", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToFile = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const { text } = await generateContext(fileTree, { removeComments });
      await processWithSecurityCheck(text, 'save');
    } catch (err) {
      console.error("Failed to generate:", err);
      triggerToast("Generation failed", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const performScan = async (path: string) => {
    if (!path.trim()) return;
    setIsScanning(true);
    try {
      const effectiveConfig = {
        dirs: Array.from(new Set([...globalIgnore.dirs, ...projectIgnore.dirs])),
        files: Array.from(new Set([...globalIgnore.files, ...projectIgnore.files])),
        extensions: Array.from(new Set([...globalIgnore.extensions, ...projectIgnore.extensions])),
      };

      const tree = await scanProject(path, effectiveConfig);
      setFileTree(tree);
      setProjectRoot(path);
      
      const idealWidth = calculateIdealTreeWidth(tree);
      if (idealWidth > contextSidebarWidth) setContextSidebarWidth(idealWidth);
      if (!isContextSidebarOpen) setContextSidebarOpen(true);
    } catch (err) {
      console.error("Scan failed:", err);
      triggerToast("Scan failed. Check path.", 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, recursive: false });
      if (selected && typeof selected === 'string') {
        setPathInput(selected);
        await performScan(selected);
      }
    } catch (err) { console.error(err); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performScan(pathInput);
  };

  const isResizingRef = useRef(false);
  const startResizing = () => { isResizingRef.current = true; };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(200, Math.min(e.clientX - 64, 800));
      setContextSidebarWidth(newWidth);
    };
    const handleMouseUp = () => { isResizingRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setContextSidebarWidth]);

  return (
    <div className="h-full flex flex-col bg-background relative">
      
      {/* Top Bar */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-background/80 backdrop-blur z-10">
        <button 
          onClick={() => setContextSidebarOpen(!isContextSidebarOpen)} 
          className={cn("p-2 rounded-md transition-colors", !isContextSidebarOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary")}
        >
          <PanelLeft size={18} />
        </button>

        <div className="flex-1 flex items-center gap-2 bg-secondary/30 border border-border/50 rounded-md px-2 py-1 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
          <Search size={14} className="text-muted-foreground/50" />
          <input 
            className="flex-1 bg-transparent border-none outline-none text-sm h-8 placeholder:text-muted-foreground/40"
            placeholder={getText('context', 'searchPlaceholder', language)}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {pathInput && pathInput !== projectRoot && (
             <button onClick={() => performScan(pathInput)} className="p-1 hover:bg-primary hover:text-primary-foreground rounded-sm transition-colors"><ArrowRight size={14} /></button>
          )}
        </div>

        <button onClick={handleBrowse} className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-sm font-medium transition-colors whitespace-nowrap">
          <FolderOpen size={16} /><span>{getText('context', 'browse', language)}</span>
        </button>
        <button onClick={() => performScan(projectRoot || '')} disabled={!projectRoot || isScanning} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={cn(isScanning && "animate-spin")} />
        </button>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        <div 
          className={cn("flex flex-col bg-secondary/5 border-r border-border transition-all duration-75 ease-linear overflow-hidden relative group/sidebar", !isContextSidebarOpen && "w-0 border-none opacity-0")}
          style={{ width: isContextSidebarOpen ? `${contextSidebarWidth}px` : 0 }}
        >
          <div className="p-3 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between shrink-0 items-center">
             <span className="flex items-center gap-1"><FileJson size={12}/>{getText('context', 'explorer', language)}</span>
             <div className="flex items-center gap-2">
                {/* 反选按钮 */}
                <button 
                  onClick={invertSelection}
                  className="p-1 hover:bg-secondary/80 rounded transition-colors text-muted-foreground hover:text-foreground"
                  title={getText('context', 'invertSelection', language)}
                >
                   <ArrowRightLeft size={12} />
                </button>
                {/* 计数显示 */}
                <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
                  {getText('context', 'selectedCount', language, { count: stats.fileCount.toString() })}
                </span>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {!projectRoot ? (
              <div className="mt-10 flex flex-col items-center justify-center text-muted-foreground opacity-50 gap-2 text-center px-4"><p className="text-sm">{getText('context', 'enterPath', language)}</p></div>
            ) : isScanning ? (
              <div className="flex flex-col items-center justify-center mt-10 gap-3 text-sm text-muted-foreground animate-pulse"><Loader2 size={20} className="animate-spin text-primary" /><span>{getText('context', 'scanning', language)}</span></div>
            ) : fileTree.length === 0 ? (
              <div className="mt-10 text-center text-sm text-muted-foreground">{getText('context', 'emptyDir', language)}</div>
            ) : (
              fileTree.map(node => <FileTreeNode key={node.id} node={node} onToggleSelect={toggleSelect} />)
            )}
          </div>

          <div className="border-t border-border bg-background shrink-0 flex flex-col z-10">
              <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-secondary/50 transition-colors"
              >
                  <span className="flex items-center gap-2"><SlidersHorizontal size={12}/> {getText('context', 'filters', language)}</span>
                  <ChevronUp size={14} className={cn("transition-transform duration-200", showFilters ? "rotate-180" : "rotate-0")} />
              </button>
              {showFilters && (
                  <div className="h-64 p-3 bg-secondary/5 overflow-hidden border-t border-border/50 animate-in slide-in-from-bottom-2">
                      <FilterManager localConfig={projectIgnore} globalConfig={globalIgnore} onUpdate={updateProjectIgnore} />
                  </div>
              )}
          </div>
          
          {isContextSidebarOpen && <div onMouseDown={startResizing} className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-20" />}
        </div>

        <div className="flex-1 bg-background min-w-0 flex flex-col relative">
            <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
            
            {/* 视图切换按钮 */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
               <div className={cn(
                  "pointer-events-auto bg-background/80 backdrop-blur-md border border-border p-1 rounded-xl flex items-center shadow-sm",
                  "transition-all duration-300 ease-out", 
                  "opacity-10 hover:opacity-100 hover:shadow-md hover:scale-[1.02]"
               )}>
                  <ViewToggleBtn 
                    active={rightViewMode === 'dashboard'} 
                    onClick={() => setRightViewMode('dashboard')}
                    icon={<LayoutDashboard size={14} />} 
                    label={getText('context', 'tabDashboard', language)}
                  />
                  <ViewToggleBtn 
                    active={rightViewMode === 'preview'} 
                    onClick={() => setRightViewMode('preview')}
                    icon={<FileText size={14} />} 
                    label={getText('context', 'tabPreview', language)}
                  />
               </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 h-full"> 
                {rightViewMode === 'dashboard' ? (
                   <TokenDashboard 
                     stats={stats}
                     fileTree={fileTree}
                     models={activeModels}
                     onCopy={handleCopyContext}
                     onSave={handleSaveToFile}
                     isGenerating={isGenerating}
                   />
                ) : (
                   <div className="h-full">
                      <ContextPreview fileTree={fileTree} />
                   </div>
                )}
            </div>
        </div>
      </div>

      <Toast 
        message={toastState.msg} 
        type={toastState.type} 
        show={toastState.show} 
        onDismiss={() => setToastState(prev => ({ ...prev, show: false }))} 
      />

      {/* 扫描结果弹窗 */}
      <ScanResultDialog 
        isOpen={scanState.isOpen}
        results={scanState.results}
        onConfirm={handleScanConfirm}
        onCancel={() => setScanState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function ViewToggleBtn({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
        active 
          ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10" 
          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}