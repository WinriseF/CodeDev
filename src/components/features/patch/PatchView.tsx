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
import { Loader2, Wand2 } from 'lucide-react';
import { streamChatCompletion } from '@/lib/llm';

const MANUAL_DIFF_ID = 'manual-scratchpad';

export function PatchView() {
  const { language, aiConfig } = useAppStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState<PatchMode>('patch');
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [yamlInput, setYamlInput] = useState('');
  const [files, setFiles] = useState<PatchFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

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
    if (mode === 'patch' && projectRoot && yamlInput.trim()) {
        const process = async () => {
            const filePatches = parseMultiFilePatch(yamlInput);
            
            const newFiles: PatchFileItem[] = await Promise.all(filePatches.map(async (fp) => {
                const fullPath = `${projectRoot}/${fp.filePath}`;
                try {
                    const original = await readTextFile(fullPath);
                    const result = applyPatches(original, fp.operations);
                    
                    return { 
                        id: fullPath, 
                        path: fp.filePath, 
                        original, 
                        modified: result.modified, 
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
            const firstError = newFiles.find(f => f.status === 'error');
            if (firstError) setSelectedFileId(firstError.id);
            else if (newFiles.length > 0 && !selectedFileId) setSelectedFileId(newFiles[0].id);
        };
        const timer = setTimeout(process, 300);
        return () => clearTimeout(timer);
    } else if (mode === 'patch' && !yamlInput.trim()) {
        setFiles([]);
    }
  }, [mode, projectRoot, yamlInput]);

  const handleAiFix = async (file: PatchFileItem) => {
      if (isFixing || !file.original) return;
      
      const patchData = parseMultiFilePatch(yamlInput).find(p => p.filePath === file.path);
      if (!patchData) return;

      setIsFixing(true);
      showNotification("AI repairing...");

      const prompt = `
I have a file content and a desired change (SEARCH/REPLACE block), but the SEARCH block doesn't match the file content exactly due to formatting differences.

Please apply the change intelligently to the file and return the FULL updated file content. Do not return markdown code blocks, just the raw code.

ORIGINAL FILE:
${file.original}

DESIRED CHANGE (SEARCH/REPLACE):
${patchData.operations.map(op => `<<<<<<< SEARCH\n${op.originalBlock}\n=======\n${op.modifiedBlock}\n>>>>>>> REPLACE`).join('\n\n')}
`;

      let fullResponse = "";
      
      try {
          await streamChatCompletion(
              [{ role: 'user', content: prompt }],
              aiConfig,
              (text) => { fullResponse += text; },
              (err) => { console.error(err); showNotification("AI Fix Failed"); },
              () => {
                  const cleanCode = fullResponse.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                  
                  setFiles(prev => prev.map(f => {
                      if (f.id === file.id) {
                          return { ...f, modified: cleanCode, status: 'success', errorMsg: undefined };
                      }
                      return f;
                  }));
                  setIsFixing(false);
                  showNotification("AI Fix Applied!");
              }
          );
      } catch (e) {
          setIsFixing(false);
      }
  };

  const handleSave = async (file: PatchFileItem) => {
    if (!file.modified || file.isManual) return;
    
    let warning = getText('patch', 'saveConfirmMessage', language, { path: file.path });
    if (file.status === 'error') {
        warning = `⚠️ This file has errors! Ensure you have verified the result.\n\n${warning}`;
    }

    const confirmed = await confirm(
        warning,
        { title: getText('patch', 'saveConfirmTitle', language), type: file.status === 'error' ? 'error' : 'warning' }
    );
    
    if (confirmed) {
        try {
            await writeTextFile(file.id, file.modified);
            showNotification(getText('patch', 'toastSaved', language));
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, original: file.modified, status: 'success', errorMsg: undefined } : f));
        } catch (e) {
            console.error(e);
            showNotification("Save Failed");
        }
    }
  };

  const currentFile = files.find(f => f.id === selectedFileId);

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
      
      <div className="flex-1 flex flex-col min-w-0 relative">
          {currentFile && currentFile.status === 'error' && !currentFile.isManual && (
              <div className="absolute bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <button 
                    onClick={() => handleAiFix(currentFile)}
                    disabled={isFixing}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                      {isFixing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                      {isFixing ? "AI is fixing..." : "Fix with AI"}
                  </button>
              </div>
          )}

          <DiffWorkspace 
             selectedFile={currentFile || null}
             onSave={handleSave}
             onCopy={async (txt) => { await writeClipboard(txt); showNotification("Copied"); }}
             onManualUpdate={handleManualUpdate}
             isSidebarOpen={isSidebarOpen}
             onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
      </div>

      <Toast message={toastMsg} type="success" show={showToast} onDismiss={() => setShowToast(false)} />
    </div>
  );
}