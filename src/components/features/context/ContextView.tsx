import { useState, useMemo, useEffect, useRef } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { writeText as writeClipboard } from '@tauri-apps/plugin-clipboard-manager';
import { 
  FolderOpen, RefreshCw, Loader2, FileJson, 
  PanelLeft, Search, ArrowRight, SlidersHorizontal, ChevronUp,
  LayoutDashboard, FileText, Bot, Database
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
import { AIContextAgent } from './AIContextAgent'; // 新引入
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';
import { Toast, ToastType } from '@/components/ui/Toast';
import { invoke } from '@tauri-apps/api/core'; // 新引入

export function ContextView() {
  const { 
    projectRoot, fileTree, isScanning, 
    projectIgnore, updateProjectIgnore, 
    refreshTreeStatus, 
    setProjectRoot, setFileTree, setIsScanning, toggleSelect, removeComments 
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
  const [rightViewMode, setRightViewMode] = useState<'dashboard' | 'preview' | 'agent'>('dashboard');

  const [toastState, setToastState] = useState<{ show: boolean; msg: string; type: ToastType }>({
      show: false,
      msg: '',
      type: 'success'
  });
  const [isIndexingProject, setIsIndexingProject] = useState(false);

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

  const handleCopyContext = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const { text, tokenCount } = await generateContext(fileTree, { removeComments });
      await writeClipboard(text);
      console.log(`Context copied! Actual tokens: ${tokenCount}`);
      triggerToast(getText('context', 'toastCopied', language), 'success');
    } catch (err) {
      console.error("Failed to copy:", err);
      triggerToast(getText('context', 'toastCopyFail', language), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToFile = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const filePath = await save({
        filters: [{ name: 'Text File', extensions: ['txt', 'md', 'json'] }],
        defaultPath: 'context.txt'
      });
      if (!filePath) {
        setIsGenerating(false);
        return;
      }
      const { text } = await generateContext(fileTree, { removeComments });
      await writeTextFile(filePath, text);
      triggerToast(getText('context', 'toastSaved', language), 'success');
    } catch (err) {
      console.error("Failed to save file:", err);
      triggerToast(getText('context', 'toastSaveFail', language), 'error');
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

  const handleBuildIndex = async () => {
    if (!projectRoot) return;
    setIsIndexingProject(true);
    try {
        triggerToast("正在构建向量索引，这可能需要几分钟...", "info");
        const count = await invoke<number>('index_project', {
            paths: [projectRoot],
            collectionName: "default_project",
            modelId: "jina-v3-base-zh"
        });
        triggerToast(`索引构建完成！共处理 ${count} 个代码块。`, "success");
    } catch (e) {
        console.error(e);
        triggerToast(`索引失败: ${e}`, "error");
    } finally {
        setIsIndexingProject(false);
    }
  };

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


        {/* 顶部操作按钮组 */}
        <div className="flex items-center gap-2">
            <button 
                onClick={handleBuildIndex}
                disabled={!projectRoot || isIndexingProject || isScanning}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                    isIndexingProject ? "bg-primary/5 text-primary border-primary/20" : "bg-secondary hover:bg-secondary/80"
                )}
                title="构建向量索引以启用 AI 智能选择"
            >
                {isIndexingProject ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                <span>{isIndexingProject ? "索引中..." : "构建索引"}</span>
            </button>

            <button onClick={handleBrowse} className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-medium transition-colors whitespace-nowrap">
              <FolderOpen size={14} /><span>{getText('context', 'browse', language)}</span>
            </button>
            <button onClick={() => performScan(projectRoot || '')} disabled={!projectRoot || isScanning} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors disabled:opacity-50">
              <RefreshCw size={16} className={cn(isScanning && "animate-spin")} />
            </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Explorer) */}
        <div 
          className={cn("flex flex-col bg-secondary/5 border-r border-border transition-all duration-75 ease-linear overflow-hidden relative group/sidebar", !isContextSidebarOpen && "w-0 border-none opacity-0")}
          style={{ width: isContextSidebarOpen ? `${contextSidebarWidth}px` : 0 }}
        >
          <div className="p-3 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between shrink-0 items-center">
             <span className="flex items-center gap-1"><FileJson size={12}/>{getText('context', 'explorer', language)}</span>
             <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-[10px]">{getText('context', 'selectedCount', language, { count: stats.fileCount.toString() })}</span>
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

        {/* Right Content Area */}
        <div className="flex-1 bg-background min-w-0 flex flex-col relative">
            <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
            
            {/* View Switcher (Floating) */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
               <div className={cn(
                  "pointer-events-auto bg-background/80 backdrop-blur-md border border-border p-1 rounded-full flex items-center shadow-lg shadow-black/5",
                  "transition-all duration-300 ease-out", 
                  "opacity-10 hover:opacity-100 hover:shadow-xl hover:scale-[1.02]" 
               )}>
                  <ViewToggleBtn 
                    active={rightViewMode === 'dashboard'} 
                    onClick={() => setRightViewMode('dashboard')}
                    icon={<LayoutDashboard size={14} />} 
                    label="仪表盘"
                  />
                  <div className="w-px h-4 bg-border/50 mx-1" />
                  
                  {/* 新增：AI 助手 Tab */}
                  <ViewToggleBtn 
                    active={rightViewMode === 'agent'} 
                    onClick={() => setRightViewMode('agent')}
                    icon={<Bot size={14} />} 
                    label="AI 助手"
                    isSpecial
                  />
                  
                  <div className="w-px h-4 bg-border/50 mx-1" />
                  <ViewToggleBtn 
                    active={rightViewMode === 'preview'} 
                    onClick={() => setRightViewMode('preview')}
                    icon={<FileText size={14} />} 
                    label="预览"
                  />
               </div>
            </div>

            {/* Content Rendering */}
            <div className="flex-1 overflow-y-auto custom-scrollbar h-full relative z-0"> 
                {rightViewMode === 'dashboard' ? (
                   <TokenDashboard 
                     stats={stats}
                     fileTree={fileTree}
                     models={activeModels}
                     onCopy={handleCopyContext}
                     onSave={handleSaveToFile}
                     isGenerating={isGenerating}
                   />
                ) : rightViewMode === 'agent' ? (
                   <AIContextAgent />
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
    </div>
  );
}

function ViewToggleBtn({ active, onClick, icon, label, isSpecial }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
        active 
          ? (isSpecial ? "bg-purple-500/10 text-purple-600 shadow-sm ring-1 ring-purple-500/20" : "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20")
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}