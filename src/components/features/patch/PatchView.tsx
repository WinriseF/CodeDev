import { useState, useEffect } from 'react';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { writeText as writeClipboard } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { parseMultiFilePatch, applyPatches } from '@/lib/patch_parser';
import { PatchSidebar } from './PatchSidebar';
import { DiffWorkspace } from './DiffWorkspace';
import { PatchMode, PatchFileItem } from './patch_types';
import { Toast, ToastType } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { Loader2, Wand2, AlertTriangle, FileText, Check } from 'lucide-react';
import { streamChatCompletion } from '@/lib/llm';
import { invoke } from '@tauri-apps/api/core';

const MANUAL_DIFF_ID = 'manual-scratchpad';

// 定义从 Rust 传来的数据类型
interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitDiffFile {
  path: string;
  status: 'Added' | 'Modified' | 'Deleted' | 'Renamed';
  original_content: string;
  modified_content: string;
}

export function PatchView() {
  const { language, aiConfig } = useAppStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState<PatchMode>('patch');
  
  // AI Patch 功能的状态
  const [patchProjectRoot, setPatchProjectRoot] = useState<string | null>(null);
  const [yamlInput, setYamlInput] = useState('');
  
  // 通用文件列表和UI状态
  const [files, setFiles] = useState<PatchFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  // Toast 状态
  const [toastState, setToastState] = useState<{ show: boolean; msg: string; type: ToastType }>({
    show: false,
    msg: '',
    type: 'success'
  });

  const [isFixing, setIsFixing] = useState(false);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; file: PatchFileItem | null }>({
      show: false,
      file: null
  });

  // Git 对比功能的状态
  const [gitProjectRoot, setGitProjectRoot] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [baseHash, setBaseHash] = useState<string>('');
  const [compareHash, setCompareHash] = useState<string>('');
  const [isGitLoading, setIsGitLoading] = useState(false);

  const showNotification = (msg: string, type: ToastType = 'success') => {
    setToastState({ show: true, msg, type });
  };
  
  // 模式切换时的副作用处理
  useEffect(() => {
    if (mode === 'diff') {
      const isManualOrGitFile = (f: PatchFileItem) => f.isManual || !!f.gitStatus;
      // 如果当前文件列表不是手动/Git模式的，就清空
      if (files.length > 0 && !files.every(isManualOrGitFile)) {
        setFiles(prev => prev.filter(isManualOrGitFile));
      }
      // 确保“手动对比”项总是存在
      if (!files.some(f => f.id === MANUAL_DIFF_ID)) {
        const manualItem: PatchFileItem = { id: MANUAL_DIFF_ID, path: 'Manual Comparison', original: '', modified: '', status: 'success', isManual: true };
        setFiles(prev => [manualItem, ...prev]);
        // 智能选择默认项
        if (!selectedFileId && !gitProjectRoot) {
          setSelectedFileId(MANUAL_DIFF_ID);
        }
      }
    } else if (mode === 'patch') {
      // 切换回AI模式，只保留AI patch文件
      const aiFiles = files.filter(p => !p.isManual && !p.gitStatus);
      setFiles(aiFiles);
      // 如果之前选中的是手动或Git项，则重置选中状态
      if (selectedFileId === MANUAL_DIFF_ID || files.find(f => f.id === selectedFileId)?.gitStatus) {
        setSelectedFileId(aiFiles.length > 0 ? aiFiles[0].id : null);
      }
    }
  }, [mode]);

  // =================================================================
  // 原功能逻辑
  // =================================================================

  const handleLoadPatchProject = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === 'string') {
        setPatchProjectRoot(selected);
        showNotification(getText('patch', 'projectLoaded', language));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClear = () => {
      setYamlInput('');
      setFiles([]);
      setSelectedFileId(null);
  };

  const handleManualUpdate = (orig: string, mod: string) => {
      if (mode !== 'diff') return;
      setFiles(prev => prev.map(f => {
          if (f.id === MANUAL_DIFF_ID) return { ...f, original: orig, modified: mod };
          return f;
      }));
  };

  useEffect(() => {
    if (mode !== 'patch' || !patchProjectRoot || !yamlInput.trim()) {
      if(mode === 'patch') setFiles([]);
      return;
    }

    const timer = setTimeout(async () => {
        const filePatches = parseMultiFilePatch(yamlInput);
        const newFiles: PatchFileItem[] = await Promise.all(filePatches.map(async (fp) => {
            const fullPath = `${patchProjectRoot}/${fp.filePath}`;
            try {
                const original = await readTextFile(fullPath);
                const result = applyPatches(original, fp.operations);
                return { 
                    id: fullPath, 
                    path: fp.filePath, 
                    original, 
                    modified: result.modified, 
                    status: result.success ? 'success' : 'error', 
                    errorMsg: result.success ? undefined : getText('patch', 'failedToMatch', language, { count: result.errors.length.toString() })
                };
            } catch (err) {
                return { 
                    id: fullPath, 
                    path: fp.filePath, 
                    original: '', 
                    modified: '', 
                    status: 'error', 
                    errorMsg: getText('patch', 'fileNotFound', language) 
                };
            }
        }));
        
        setFiles(newFiles);
        const firstError = newFiles.find(f => f.status === 'error');
        if (firstError) {
          setSelectedFileId(firstError.id);
        } else if (newFiles.length > 0) {
          setSelectedFileId(newFiles[0].id);
        } else {
          setSelectedFileId(null);
        }
    }, 300);

    return () => clearTimeout(timer);
  }, [mode, patchProjectRoot, yamlInput, language]);

  const handleAiFix = async (file: PatchFileItem) => {
      if (isFixing || !file.original) return;
      const patchData = parseMultiFilePatch(yamlInput).find(p => p.filePath === file.path);
      if (!patchData) return;
      setIsFixing(true);
      showNotification(getText('patch', 'aiRepairing', language), 'info');
      const prompt = `...`; // 省略长字符串
      let fullResponse = "";
      try {
          await streamChatCompletion(
              [{ role: 'user', content: prompt }], aiConfig,
              (text) => { fullResponse += text; },
              (err) => { console.error(err); showNotification(getText('patch', 'aiFixFailed', language), 'error'); },
              () => {
                  const cleanCode = fullResponse.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                  setFiles(prev => prev.map(f => f.id === file.id ? { ...f, modified: cleanCode, status: 'success', errorMsg: undefined } : f));
                  setIsFixing(false);
                  showNotification(getText('patch', 'aiFixApplied', language), 'success');
              }
          );
      } catch (e) {
          setIsFixing(false);
      }
  };
  
  const handleSaveClick = (file: PatchFileItem) => {
    if (!file.modified || file.isManual || file.gitStatus) return;
    setConfirmDialog({ show: true, file });
  };

  const executeSave = async () => {
    const file = confirmDialog.file;
    if (!file) return;
    try {
        await writeTextFile(file.id, file.modified);
        showNotification(getText('patch', 'toastSaved', language));
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, original: file.modified, status: 'success', errorMsg: undefined } : f));
        setConfirmDialog({ show: false, file: null });
    } catch (e) {
        console.error(e);
        showNotification(getText('patch', 'saveFailed', language), 'error');
    }
  };

  // =================================================================
  // Git 相关逻辑函数
  // =================================================================

  const handleBrowseGitProject = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === 'string') {
        setGitProjectRoot(selected);
        setIsGitLoading(true);
        try {
          const result = await invoke<GitCommit[]>('get_git_commits', { projectPath: selected });
          setCommits(result);
          if (result.length >= 2) {
            setCompareHash(result[0].hash);
            setBaseHash(result[1].hash);
          } else if (result.length > 0) {
            setCompareHash(result[0].hash);
            setBaseHash(result[0].hash);
          }
        } catch (err: any) {
          showNotification(`Error loading commits: ${err.toString()}`, 'error');
          setCommits([]);
        } finally {
          setIsGitLoading(false);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleGenerateDiff = async () => {
    if (!gitProjectRoot || !baseHash || !compareHash) return;
    setIsGitLoading(true);
    setFiles(prev => prev.filter(p => p.isManual)); 
    setSelectedFileId(null);
    try {
      const result = await invoke<GitDiffFile[]>('get_git_diff', {
        projectPath: gitProjectRoot,
        oldHash: baseHash,
        newHash: compareHash,
      });
      const newFiles: PatchFileItem[] = result.map(f => ({
        id: f.path, path: f.path, original: f.original_content, modified: f.modified_content,
        status: 'success', gitStatus: f.status,
      }));
      setFiles(prev => [...prev.filter(p => p.isManual), ...newFiles]);
      if (newFiles.length > 0) {
        setSelectedFileId(newFiles[0].id);
      } else {
         setSelectedFileId(MANUAL_DIFF_ID);
         showNotification('No differences found between the selected commits.', 'info');
      }
    } catch (err: any) {
      showNotification(`Error generating diff: ${err.toString()}`, 'error');
    } finally {
      setIsGitLoading(false);
    }
  };

  const [_isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!gitProjectRoot || !baseHash || !compareHash) return;

    const filesToExport = files.filter(f => f.gitStatus);
    if (filesToExport.length === 0) {
        showNotification("No changes to export.", "info");
        return;
    }

    setIsExporting(true);
    try {
        const diffText = await invoke<string>('get_git_diff_text', {
            projectPath: gitProjectRoot,
            oldHash: baseHash,
            newHash: compareHash,
        });

        const filePath = await save({
            title: "Export Git Diff",
            defaultPath: `diff_${baseHash.slice(0,7)}_${compareHash.slice(0,7)}.diff`,
            filters: [{ name: "Diff File", extensions: ["diff", "patch", "txt"] }]
        });

        if (filePath) {
            await writeTextFile(filePath, diffText);
            showNotification("Diff exported successfully!", "success");
        }

    } catch (err: any) {
        showNotification(`Export failed: ${err.toString()}`, 'error');
    } finally {
        setIsExporting(false);
    }
  };

  const currentFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="h-full flex overflow-hidden bg-background relative">
      <div className={cn("shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-r border-border", isSidebarOpen ? "w-[350px] opacity-100" : "w-0 opacity-0 border-none")}>
        <div className="w-[350px] h-full">
            <PatchSidebar 
                mode={mode} setMode={setMode}
                projectRoot={patchProjectRoot} onLoadProject={handleLoadPatchProject}
                yamlInput={yamlInput} onYamlChange={setYamlInput} onClearYaml={handleClear}
                files={files} selectedFileId={selectedFileId} onSelectFile={setSelectedFileId}
                gitProjectRoot={gitProjectRoot} onBrowseGitProject={handleBrowseGitProject}
                commits={commits} baseHash={baseHash} setBaseHash={setBaseHash}
                compareHash={compareHash} setCompareHash={setCompareHash}
                onCompare={handleGenerateDiff} isGitLoading={isGitLoading}
            />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 relative">
          {currentFile && currentFile.status === 'error' && !currentFile.isManual && (
              <div className="absolute bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <button onClick={() => handleAiFix(currentFile)} disabled={isFixing} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50">
                      {isFixing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                      {isFixing ? "AI is fixing..." : "Fix with AI"}
                  </button>
              </div>
          )}

          <DiffWorkspace 
             selectedFile={currentFile || null}
             onSave={handleSaveClick}
             onCopy={async (txt) => { await writeClipboard(txt); showNotification(getText('patch', 'copied', language)); }}
             onManualUpdate={handleManualUpdate}
             isSidebarOpen={isSidebarOpen}
             onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
             isReadOnly={currentFile?.isManual !== true}
             onExport={mode === 'diff' && gitProjectRoot ? handleExport : undefined}
          />
      </div>

      {confirmDialog.show && confirmDialog.file && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
              <div className="w-full max-w-[450px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 pb-4">
                      <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", confirmDialog.file.status === 'error' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500")}>
                              <AlertTriangle size={24} />
                          </div>
                          <div>
                              <h3 className="font-semibold text-lg text-foreground">{getText('patch', 'saveConfirmTitle', language)}</h3>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{confirmDialog.file.status === 'error' ? "This file has errors. Saving might break code." : getText('patch', 'saveConfirmMessage', language, { path: '' }).replace('"{path}"', '')}</p>
                          </div>
                      </div>
                      <div className="mt-5 bg-secondary/30 border border-border rounded-lg p-3 flex items-start gap-3">
                          <FileText size={16} className="text-muted-foreground mt-0.5" />
                          <code className="text-xs font-mono text-foreground break-all leading-relaxed">{confirmDialog.file.path}</code>
                      </div>
                  </div>
                  <div className="p-4 bg-secondary/5 border-t border-border flex justify-end gap-3">
                      <button onClick={() => setConfirmDialog({ show: false, file: null })} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">{getText('patch', 'cancel', language)}</button>
                      <button onClick={executeSave} className={cn("px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors", confirmDialog.file.status === 'error' ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
                          {confirmDialog.file.status === 'error' ? (<><AlertTriangle size={16} /> Force Save</>) : (<><Check size={16} /> {getText('patch', 'confirm', language)}</>)}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <Toast 
        message={toastState.msg} 
        type={toastState.type} 
        show={toastState.show} 
        onDismiss={() => setToastState(prev => ({ ...prev, show: false }))} 
      />
    </div>
  );
}