import { motion } from "framer-motion";
import { useState, useMemo, useEffect, useRef, type CSSProperties, memo } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { basename } from '@tauri-apps/api/path';
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
import { calculateIdealTreeWidth, flattenTree } from '@/lib/tree_utils';
import { getSelectedPaths, generateHeader } from '@/lib/context_assembler';
import { FileTreeNode } from './FileTreeNode';
import { TokenDashboard } from './TokenDashboard';
import { FilterManager } from './FilterManager';
import { ContextPreview } from './ContextPreview';
import { ScanResultDialog, SecretMatch } from './ScanResultDialog';
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';
import { Toast, ToastType } from '@/components/ui/Toast';
import { FileNode } from '@/types/context';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface FlatNode {
  node: FileNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}

interface RowProps {
  index: number;
  style: CSSProperties;
  data: {
    items: FlatNode[];
    onToggleSelect: (id: string, checked: boolean) => void;
    onToggleExpand: (id: string) => void;
  };
}

const Row = memo(function Row({ index, style, data }: RowProps) {
  const { items, onToggleSelect, onToggleExpand } = data;
  const item = items[index];

  return (
    <FileTreeNode
      node={item.node}
      depth={item.depth}
      isExpanded={item.isExpanded}
      hasChildren={item.hasChildren}
      style={style}
      onToggleSelect={onToggleSelect}
      onToggleExpand={onToggleExpand}
    />
  );
});

export function ContextView() {
  const {
    projectRoot, fileTree, isScanning,
    projectIgnore, updateProjectIgnore,
    refreshTreeStatus,
    setProjectRoot, setFileTree, setIsScanning, toggleSelect,
    removeComments, detectSecrets, invertSelection,
    expandedIds, toggleExpand
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

  const selectedFileCount = useMemo(() => {
    let count = 0;
    const traverse = (nodes: typeof fileTree) => {
      for (const node of nodes) {
        if (node.kind === 'file' && node.isSelected) count++;
        if (node.children) traverse(node.children);
      }
    };
    traverse(fileTree);
    return count;
  }, [fileTree]);

  const flatData = useMemo(() => {
    return flattenTree(fileTree, expandedIds);
  }, [fileTree, expandedIds]);

  const rowData = useMemo(() => ({
    items: flatData,
    onToggleSelect: toggleSelect,
    onToggleExpand: toggleExpand
  }), [flatData, toggleSelect, toggleExpand]);

  const triggerToast = (msg: string, type: ToastType = 'success') => {
    setToastState({ show: true, msg, type });
  };

  const getDefaultSavePath = async () => {
    let namePart = 'context';

    if (projectRoot) {
      try {
        const base = await basename(projectRoot);
        if (base) namePart = base;
      } catch (e) {
        const separator = projectRoot.includes('\\') ? '\\' : '/';
        const cleanRoot = projectRoot.endsWith(separator) ? projectRoot.slice(0, -1) : projectRoot;
        namePart = cleanRoot.split(separator).pop() || 'context';
      }
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    return `${namePart}_${timeStr}.txt`;
  };

  const executeFinalAction = async (text: string, action: 'copy' | 'save') => {
      try {
          if (action === 'copy') {
              await writeClipboard(text);
              const actualTokens = Math.ceil(text.length / 4);
              console.log(`Context copied! Approx tokens: ${actualTokens}`);
              triggerToast(getText('context', 'toastCopied', language), 'success');
          } else if (action === 'save') {
              const defaultPath = await getDefaultSavePath();
              const filePath = await save({
                  filters: [{ name: 'Text File', extensions: ['txt', 'md', 'json'] }],
                  defaultPath: defaultPath
              });
              if (!filePath) return;

              await writeTextFile(filePath, text);
              triggerToast(getText('context', 'toastSaved', language), 'success');
          }
      } catch (err) {
          console.error("Action failed:", err);
          triggerToast(action === 'copy' ? getText('context', 'toastCopyFail', language) : getText('context', 'toastSaveFail', language), 'error');
      }
  };

  const processWithSecurityCheck = async (text: string, action: 'copy' | 'save') => {
      if (!detectSecrets) {
          await executeFinalAction(text, action);
          return;
      }

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
      const paths = getSelectedPaths(fileTree);
      if (paths.length === 0) return;

      const header = generateHeader(fileTree, removeComments);

      if (detectSecrets) {
        const text = await invoke<string>('get_context_content', { paths, header, removeComments });
        await processWithSecurityCheck(text, 'copy');
      } else {
        await invoke('copy_context_to_clipboard', { paths, header, removeComments });
        triggerToast(getText('context', 'toastCopied', language), 'success');
      }
    } catch (err) {
      console.error("Failed to copy:", err);
      triggerToast("Copy failed", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToFile = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const paths = getSelectedPaths(fileTree);
      const header = generateHeader(fileTree, removeComments);

      const defaultPath = await getDefaultSavePath();
      const filePath = await save({
        filters: [{ name: 'Text File', extensions: ['txt', 'md', 'json'] }],
        defaultPath: defaultPath
      });

      if (!filePath) {
        setIsGenerating(false);
        return;
      }

      if (detectSecrets) {
        const text = await invoke<string>('get_context_content', { paths, header, removeComments });
        await processWithSecurityCheck(text, 'save');
      } else {
        await invoke('save_context_to_file', {
          paths,
          header,
          removeComments,
          savePath: filePath
        });
        triggerToast(getText('context', 'toastSaved', language), 'success');
      }
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
                <button
                  onClick={invertSelection}
                  className="p-1 hover:bg-secondary/80 rounded transition-colors text-muted-foreground hover:text-foreground"
                  title={getText('context', 'invertSelection', language)}
                >
                   <ArrowRightLeft size={12} />
                </button>
                <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
                  {getText('context', 'selectedCount', language, { count: selectedFileCount.toString() })}
                </span>
             </div>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {!projectRoot ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50 gap-2 text-center px-4"><p className="text-sm">{getText('context', 'enterPath', language)}</p></div>
            ) : isScanning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground animate-pulse"><Loader2 size={20} className="animate-spin text-primary" /><span>{getText('context', 'scanning', language)}</span></div>
            ) : fileTree.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{getText('context', 'emptyDir', language)}</div>
            ) : (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    itemCount={flatData.length}
                    itemSize={28}
                    width={width}
                    className="custom-scrollbar"
                    overscanCount={10}
                    itemData={rowData}
                    itemKey={(index) => rowData.items[index]?.node.id ?? index}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
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
        "relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors outline-none",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
      )}
    >
      {active && (
        <motion.div
          layoutId="context-view-toggle"
          className="absolute inset-0 bg-background shadow-sm rounded-lg ring-1 ring-black/5 dark:ring-white/10"
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );
}