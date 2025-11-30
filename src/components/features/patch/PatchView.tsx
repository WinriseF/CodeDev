import { useState, useEffect } from 'react';
import { open as openDialog, confirm } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { writeText as writeClipboard } from '@tauri-apps/api/clipboard';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { parseMultiFilePatch, applyPatches } from '@/lib/patch_parser';
import { PatchSidebar } from './PatchSidebar';
import { DiffWorkspace } from './DiffWorkspace';
import { PatchMode, PatchFileItem } from './patch_types';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

const MANUAL_DIFF_ID = 'manual-scratchpad';

export function PatchView() {
  const { language } = useAppStore();
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [mode, setMode] = useState<PatchMode>('patch');
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [yamlInput, setYamlInput] = useState('');
  
  const [files, setFiles] = useState<PatchFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  useEffect(() => {
      if (mode === 'diff') {
          const manualItem: PatchFileItem = {
              id: MANUAL_DIFF_ID,
              path: 'Manual Comparison',
              original: '',
              modified: '',
              status: 'success',
              isManual: true
          };
          setFiles([manualItem]);
          setSelectedFileId(MANUAL_DIFF_ID);
      } else {
          if (files.length === 1 && files[0].id === MANUAL_DIFF_ID) {
              setFiles([]);
              setSelectedFileId(null);
          }
      }
  }, [mode]);

  const handleLoadProject = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === 'string') {
        setProjectRoot(selected);
        showNotification("Project Loaded");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClear = () => {
      if (mode === 'patch') {
        setYamlInput('');
        setFiles([]);
        setSelectedFileId(null);
      } else {
        const empty: PatchFileItem = { ...files[0], original: '', modified: '' };
        setFiles([empty]);
      }
  };

  const handleManualUpdate = (orig: string, mod: string) => {
      if (mode !== 'diff') return;
      setFiles(prev => prev.map(f => {
          if (f.id === MANUAL_DIFF_ID) {
              return { ...f, original: orig, modified: mod };
          }
          return f;
      }));
  };

  // --- 核心逻辑更新：处理补丁应用 ---
  useEffect(() => {
    if (mode === 'patch' && projectRoot && yamlInput.trim()) {
        const process = async () => {
            const filePatches = parseMultiFilePatch(yamlInput);
            
            const newFiles: PatchFileItem[] = await Promise.all(filePatches.map(async (fp) => {
                const fullPath = `${projectRoot}/${fp.filePath}`;
                try {
                    const original = await readTextFile(fullPath);
                    
                    // ✨ 使用新的 applyPatches，获取详细结果
                    const result = applyPatches(original, fp.operations);
                    
                    return { 
                        id: fullPath, 
                        path: fp.filePath, 
                        original, 
                        modified: result.modified, // 即使失败，也会返回部分修改的结果
                        status: result.success ? 'success' : 'error', 
                        errorMsg: result.success ? undefined : `Failed to match ${result.errors.length} blocks` 
                    };
                } catch (err) {
                    return { 
                        id: fullPath, 
                        path: fp.filePath, 
                        original: '', 
                        modified: '', 
                        status: 'error', 
                        errorMsg: 'File not found on disk' 
                    };
                }
            }));
            
            setFiles(newFiles);
            // 自动选中第一个有错误的文件，方便用户查看
            const firstError = newFiles.find(f => f.status === 'error');
            if (firstError) {
                setSelectedFileId(firstError.id);
            } else if (newFiles.length > 0 && !selectedFileId) {
                setSelectedFileId(newFiles[0].id);
            }
        };
        const timer = setTimeout(process, 500);
        return () => clearTimeout(timer);
    } else if (mode === 'patch' && !yamlInput.trim()) {
        setFiles([]);
    }
  }, [mode, projectRoot, yamlInput]);

  const handleSave = async (file: PatchFileItem) => {
    if (!file.modified || file.isManual) return;
    
    // 安全检查：如果有错误，警告用户
    let warning = getText('patch', 'saveConfirmMessage', language, { path: file.path });
    if (file.status === 'error') {
        warning = `⚠️ This file has matching errors! The patch may be incomplete.\n\n${warning}`;
    }

    const confirmed = await confirm(
        warning,
        { title: getText('patch', 'saveConfirmTitle', language), type: file.status === 'error' ? 'error' : 'warning' }
    );
    
    if (confirmed) {
        try {
            await writeTextFile(file.id, file.modified);
            showNotification(getText('patch', 'toastSaved', language));
            // 保存后，更新原始代码为当前修改后的代码，并清除错误状态（假设用户已手动修正）
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, original: file.modified, status: 'success', errorMsg: undefined } : f));
        } catch (e) {
            console.error(e);
            showNotification("Save Failed");
        }
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      
      <div 
        className={cn(
            "shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
            isSidebarOpen ? "w-[350px] opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
         <div className="w-[350px] h-full">
            <PatchSidebar 
                mode={mode}
                setMode={setMode}
                projectRoot={projectRoot}
                onLoadProject={handleLoadProject}
                yamlInput={yamlInput}
                onYamlChange={setYamlInput}
                onClearYaml={handleClear}
                files={files}
                selectedFileId={selectedFileId}
                onSelectFile={setSelectedFileId}
            />
         </div>
      </div>
      
      <DiffWorkspace 
         selectedFile={files.find(f => f.id === selectedFileId) || null}
         onSave={handleSave}
         onCopy={async (txt) => { await writeClipboard(txt); showNotification("Copied"); }}
         onManualUpdate={handleManualUpdate}
         isSidebarOpen={isSidebarOpen}
         onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <Toast message={toastMsg} type="success" show={showToast} onDismiss={() => setShowToast(false)} />
    </div>
  );
}