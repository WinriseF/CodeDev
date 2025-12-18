import { useState } from 'react';
import { 
  FolderOpen, FileText, Sparkles, FileCode, 
  CheckCircle2, ArrowRightLeft, Loader2, 
  Copy, ChevronDown, ChevronRight, Trash2, Info, GitMerge,
  CheckSquare, Square, FileImage, AlertOctagon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommitSelector } from './CommitSelector';
import { PatchFileItem, PatchMode } from './patch_types';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '@/store/useAppStore'; 
import { getText } from '@/lib/i18n';
import { useSmartContextMenu } from '@/lib/hooks';

const AI_SYSTEM_PROMPT = `You are a top-tier software engineer. Generate a code patch based on the user's request.

IMPORTANT: You must use the "SEARCH/REPLACE" block format. Do NOT use YAML or JSON. Reply in Chinese and wrap the content in Markdown code format.

Format Rules:
1. Start each file with "File: path/to/file.ext"
2. Use the following block structure for EVERY change:

<<<<<<< SEARCH
[Exact code content to find]
=======
[New code content to replace with]
>>>>>>> REPLACE

Example:

File: src/utils.ts
<<<<<<< SEARCH
export function add(a, b) {
  return a + b;
}
=======
export function add(a: number, b: number): number {
  return a + b;
}
>>>>>>> REPLACE

My request is:`;

// 定义从 PatchView 传入的 GitCommit 类型
interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface PatchSidebarProps {
  mode: PatchMode;
  setMode: (m: PatchMode) => void;
  
  projectRoot: string | null;
  onLoadProject: () => void;
  yamlInput: string;
  onYamlChange: (val: string) => void;
  onClearYaml: () => void;
  
  files: PatchFileItem[];
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;

  gitProjectRoot: string | null;
  onBrowseGitProject: () => void;
  commits: GitCommit[];
  baseHash: string;
  setBaseHash: (h: string) => void;
  compareHash: string;
  setCompareHash: (h: string) => void;
  onCompare: () => void;
  isGitLoading: boolean;

  selectedExportIds?: Set<string>;
  onToggleExport?: (id: string, checked: boolean) => void;
}

export function PatchSidebar({
  mode, setMode,
  projectRoot, onLoadProject,
  yamlInput, onYamlChange, onClearYaml,
  files, selectedFileId, onSelectFile,
  gitProjectRoot, onBrowseGitProject, commits,
  baseHash, setBaseHash, compareHash, setCompareHash,
  onCompare, isGitLoading,
  selectedExportIds,
  onToggleExport
}: PatchSidebarProps) {
  
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { language } = useAppStore();

  const handleCopyPrompt = async () => {
    await writeText(AI_SYSTEM_PROMPT);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePaste = (pastedText: string, textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const newValue = value.substring(0, selectionStart) + pastedText + value.substring(selectionEnd);
    onYamlChange(newValue);
    setTimeout(() => {
      if (textarea) {
        const newCursorPos = selectionStart + pastedText.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const { onContextMenu } = useSmartContextMenu({ onPaste: handlePaste });

  // 将文件列表拆分为 Git 文件和手动文件
  const gitFiles = files.filter(f => f.gitStatus);
  const manualFile = files.find(f => f.isManual);
  const aiPatchFiles = files.filter(f => !f.isManual && !f.gitStatus);

  return (
    <div className="w-[350px] flex flex-col border-r border-border bg-secondary/10 h-full select-none">
      
      <div className="p-4 border-b border-border bg-background shadow-sm z-10 shrink-0">
        <div className="flex bg-secondary p-1 rounded-lg border border-border/50">
           <button onClick={() => setMode('patch')} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", mode === 'patch' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
             <Sparkles size={14} /> {getText('patch', 'aiPatch', language)}
           </button>
           <button onClick={() => setMode('diff')} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all", mode === 'diff' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
             <ArrowRightLeft size={14} /> {getText('patch', 'manual', language)}
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {mode === 'patch' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-border">
                <button onClick={onLoadProject} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all", projectRoot ? "bg-background border-border text-foreground shadow-sm hover:border-primary/50" : "bg-primary/5 border-dashed border-primary/30 text-primary hover:bg-primary/10")} title={projectRoot || getText('common', 'selectFolder', language)}>
                    <div className="flex items-center gap-2 truncate"><FolderOpen size={14} /> <span className="truncate font-medium">{projectRoot || "Browse Project..."}</span></div>
                    {projectRoot && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                </button>
              </div>

              <div className="bg-background border-b border-border shrink-0">
                  <button onClick={() => setIsPromptOpen(!isPromptOpen)} className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:bg-secondary/50 transition-colors">
                      <span className="flex items-center gap-1.5"><Info size={12} /> {getText('patch', 'aiInstruction', language)}</span>
                      {isPromptOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {isPromptOpen && (
                      <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                          <div className="bg-secondary/30 rounded-lg border border-border p-2 space-y-2">
                              <p className="text-[10px] text-muted-foreground leading-relaxed">{getText('patch', 'promptTip', language)}</p>
                              <button onClick={handleCopyPrompt} className={cn("w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition-all", isCopied ? "bg-green-500 text-white shadow-sm" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm")}>
                                  {isCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                                  {isCopied ? getText('patch', 'copied', language) : getText('patch', 'copySystemPrompt', language)}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
              <div className="flex-1 flex flex-col min-h-0 border-b border-border bg-background">
                <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between bg-secondary/5 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><FileCode size={12} /> {getText('patch', 'aiResponseInput', language)}</span>
                  <button onClick={onClearYaml} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" title={getText('common', 'clear', language)}>
                      <Trash2 size={12} />
                  </button>
                </div>
                <textarea value={yamlInput} onChange={e => onYamlChange(e.target.value)} onContextMenu={onContextMenu} placeholder={getText('patch', 'pasteAIResponse', language) + '\n\nFile: src/App.tsx\n<<<<<<< SEARCH\n...\n=======\n...\n>>>>>>> REPLACE'} className="flex-1 w-full bg-transparent p-4 resize-none outline-none font-mono text-[11px] leading-relaxed custom-scrollbar placeholder:text-muted-foreground/30 text-muted-foreground focus:text-foreground transition-colors" spellCheck="false" />
              </div>
              <div className="h-[40%] flex flex-col min-h-0 bg-secondary/5">
                <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between bg-secondary/10 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><FileText size={12} /> Changes ({aiPatchFiles.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {aiPatchFiles.map(file => (
                     <button key={file.id} onClick={() => onSelectFile(file.id)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all group border border-transparent", selectedFileId === file.id ? "bg-background text-primary border-border shadow-sm" : "hover:bg-background/60 text-muted-foreground hover:text-foreground hover:border-border/50")}>
                     </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'diff' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-border bg-background/80 space-y-3 shrink-0">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><GitMerge size={12}/> Git Snapshot Compare</h3>
                
                <button onClick={onBrowseGitProject} className={cn("...")} title={gitProjectRoot || getText('patch', 'browseGit', language)}>
                  <div className="flex items-center gap-2 truncate"><FolderOpen size={14} className={gitProjectRoot ? "text-blue-500" : ""} /> <span className="truncate font-medium">{gitProjectRoot || getText('patch', 'browseGit', language)}</span></div>
                  {gitProjectRoot && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                </button>

                {gitProjectRoot && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">{getText('patch', 'baseVersion', language)}</label>
                      <CommitSelector commits={commits} selectedValue={baseHash} onSelect={setBaseHash} disabled={isGitLoading} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">{getText('patch', 'compareVersion', language)}</label>
                      <CommitSelector commits={commits} selectedValue={compareHash} onSelect={setCompareHash} disabled={isGitLoading} />
                    </div>
                    <button onClick={onCompare} disabled={isGitLoading || !baseHash || !compareHash} className="...">
                      {isGitLoading ? <Loader2 size={14} className="animate-spin"/> : <GitMerge size={14}/>}
                      {isGitLoading ? getText('patch', 'comparing', language) : getText('patch', 'generateDiff', language)}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col min-h-0 bg-secondary/5">
                <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between bg-secondary/10 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><FileText size={12} /> Changes ({gitFiles.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {/* 手动对比项 */}
                  {manualFile && (
                    <button onClick={() => onSelectFile(manualFile.id)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all group border", selectedFileId === manualFile.id ? "bg-background text-primary border-border shadow-sm" : "border-dashed border-border/50 hover:bg-background/60 text-muted-foreground hover:text-foreground")}>
                      <ArrowRightLeft size={14} />
                      <span className="font-medium">{manualFile.path}</span>
                    </button>
                  )}

                  {gitFiles.length > 0 && manualFile && <div className="h-px bg-border/50 my-2"/>}

                  {/* Git 文件列表 - 修改为带复选框的行 */}
                  {gitFiles.map(file => {
                    const isSelected = selectedFileId === file.id;
                    const isChecked = selectedExportIds?.has(file.id);
                    const isDisabled = file.isBinary || file.isLarge;

                    return (
                        <div key={file.id} className={cn("flex items-center gap-1 rounded-lg transition-all group/row mb-1", isSelected ? "bg-background border border-border shadow-sm" : "hover:bg-background/60 border border-transparent")}>
                            
                            {/* 复选框区域 */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDisabled && onToggleExport) {
                                        onToggleExport(file.id, !isChecked);
                                    }
                                }}
                                disabled={isDisabled}
                                className={cn(
                                    "pl-2 py-2 pr-1 cursor-pointer transition-opacity flex items-center justify-center",
                                    isDisabled ? "opacity-30 cursor-not-allowed" : "hover:text-primary opacity-60 hover:opacity-100"
                                )}
                                title={isDisabled ? getText('patch', 'binaryFile', language) : getText('patch', 'export', language)}
                            >
                                {isDisabled ? (
                                   <Square size={14} className="text-muted-foreground" />
                                ) : isChecked ? (
                                   <CheckSquare size={14} className="text-primary" />
                                ) : (
                                   <Square size={14} className="text-muted-foreground" />
                                )}
                            </button>

                            {/* 文件名按钮 */}
                            <button 
                                onClick={() => onSelectFile(file.id)} 
                                className={cn(
                                    "flex-1 flex items-center justify-between gap-2 pr-3 py-2 text-xs overflow-hidden",
                                    isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover/row:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {/* 特殊状态图标 */}
                                    {file.isBinary ? (
                                        <div title={getText('patch', 'binaryFile', language)} className="shrink-0 text-orange-400 flex items-center">
                                            <FileImage size={12} />
                                        </div>
                                    ) : file.isLarge ? (
                                        <div title={getText('patch', 'largeFile', language)} className="shrink-0 text-red-400 flex items-center">
                                            <AlertOctagon size={12} />
                                        </div>
                                    ) : null}
                                    
                                    <span className={cn("truncate text-left", isDisabled && "opacity-60 decoration-slate-400")}>
                                        {file.path}
                                    </span>
                                </div>
                                
                                <span className={cn("text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded shrink-0", file.gitStatus === 'Added' && "bg-green-500/20 text-green-500", file.gitStatus === 'Modified' && "bg-blue-500/20 text-blue-500", file.gitStatus === 'Deleted' && "bg-red-500/20 text-red-600", file.gitStatus === 'Renamed' && "bg-purple-500/20 text-purple-500")}>
                                    {file.gitStatus?.charAt(0)}
                                </span>
                            </button>
                        </div>
                    );
                  })}

                  {files.length <= 1 && !gitProjectRoot && (
                    <div className="text-center text-xs text-muted-foreground/60 p-4">
                      {getText('patch', 'gitTip', language)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}