import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Tag, FileText, Folder, ChevronDown, Check, Plus, Sparkles, Terminal, Loader2, AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';
import { usePromptStore } from '@/store/usePromptStore';
import { useAppStore } from '@/store/useAppStore';
import { Prompt, DEFAULT_GROUP, ShellType } from '@/types/prompt';
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';

interface PromptEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Prompt | null;
}

const SHELL_OPTIONS: { value: ShellType; label: string }[] = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'cmd', label: 'Command Prompt (cmd)' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'bash', label: 'Bash' },
  { value: 'zsh', label: 'Zsh' },
  { value: 'python', label: 'Python (3.x)' },
];

const tabVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.2, ease: "easeOut" }
};

export function PromptEditorDialog({ isOpen, onClose, initialData }: PromptEditorDialogProps) {
  const { groups, addPrompt, updatePrompt } = usePromptStore();
  const { language } = useAppStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [type, setType] = useState<'command' | 'prompt'>('prompt');
  const [isExecutable, setIsExecutable] = useState(false);
  const [shellType, setShellType] = useState<ShellType>('auto');
  const [useAsChatTemplate, setUseAsChatTemplate] = useState(false);

  const [newGroupMode, setNewGroupMode] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isShellOpen, setIsShellOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pythonStatus, setPythonStatus] = useState<{
      loading: boolean;
      available: boolean;
      version: string;
      checked: boolean;
  }>({ loading: false, available: false, version: '', checked: false });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setContent(initialData.content);
        setGroup(initialData.group);
        setType(initialData.type || 'prompt');
        setIsExecutable(initialData.type === 'command' && (initialData.isExecutable || false));
        setShellType(initialData.shellType || 'auto');
        setUseAsChatTemplate(initialData.useAsChatTemplate || false);
      } else {
        setTitle('');
        setContent('');
        setGroup(DEFAULT_GROUP);
        setType('prompt');
        setIsExecutable(false);
        setShellType('auto');
        setUseAsChatTemplate(false);
      }
      setNewGroupMode(false);
      setNewGroupName('');
      setIsGroupOpen(false);
      setIsShellOpen(false);
      setIsSaving(false);
      setPythonStatus({ loading: false, available: false, version: '', checked: false });
    }
  }, [isOpen, initialData]);
  
  useEffect(() => {
    if (type === 'prompt') {
      setIsExecutable(false);
    } else {
      setUseAsChatTemplate(false);
    }
  }, [type]);

  const checkPythonEnv = useCallback(async () => {
      setPythonStatus(prev => ({ ...prev, loading: true }));
      try {
          const version = await invoke<string>('check_python_env');
          setPythonStatus({
              loading: false,
              available: true,
              version,
              checked: true
          });
      } catch {
          setPythonStatus({
              loading: false,
              available: false,
              version: '',
              checked: true
          });
      }
  }, []);

  useEffect(() => {
      if (type === 'command' && isExecutable && shellType === 'python') {
          if (!pythonStatus.checked) {
              checkPythonEnv();
          }
      }
  }, [type, isExecutable, shellType, checkPythonEnv, pythonStatus.checked]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
        let finalGroup = group;
        if (newGroupMode && newGroupName.trim()) {
          finalGroup = newGroupName.trim();
        }

        const data = {
            title,
            content,
            group: finalGroup,
            type: type,
            isExecutable: isExecutable,
            shellType: shellType,
            useAsChatTemplate: type === 'prompt' ? useAsChatTemplate : false,
        };

        if (initialData) {
          await updatePrompt(initialData.id, data);
        } else {
          await addPrompt(data);
        }
        onClose();
    } catch (error) {
        console.error("Failed to save prompt:", error);
    } finally {
        setIsSaving(false);
    }
  };

  const currentShellLabel = SHELL_OPTIONS.find(opt => opt.value === shellType)?.label || 'Auto Detect';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-[600px] bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-secondary/10 shrink-0">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            {initialData ? getText('editor', 'titleEdit', language) : getText('editor', 'titleNew', language)}
          </h2>
          <button onClick={onClose} disabled={isSaving} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 pb-24 custom-scrollbar">
          
          {/* Type Selector */}
          <div className="flex gap-2 p-1 bg-secondary/30 rounded-lg border border-border/50 relative">
             {['prompt', 'command'].map((tab) => (
                <button
                   key={tab}
                   onClick={() => setType(tab as 'prompt' | 'command')}
                   className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors relative z-10",
                      type === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                   )}
                >
                   {type === tab && (
                      <motion.div
                         layoutId="active-tab-bg"
                         className="absolute inset-0 bg-background rounded-md shadow-sm ring-1 ring-border"
                         transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                         style={{ zIndex: -1 }}
                      />
                   )}
                   {tab === 'prompt' ? <Sparkles size={16} /> : <Terminal size={16} />}
                   <span>{tab === 'prompt' ? getText('editor', 'typePrompt', language) : getText('editor', 'typeCommand', language)}</span>
                </button>
             ))}
          </div>

          {/* Chat Slash Command 配置区 */}
          <AnimatePresence mode="wait">
             {type === 'prompt' && (
                <motion.div
                   key="prompt-tab"
                   variants={tabVariants}
                   initial="initial"
                   animate="animate"
                   exit="exit"
                   className={cn(
                      "rounded-xl border border-border/60 p-3 transition-all duration-300",
                      useAsChatTemplate ? "bg-primary/5 border-primary/20" : "bg-secondary/10"
                   )}
                >
                   <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setUseAsChatTemplate(!useAsChatTemplate)}>
                      <div className="flex items-center gap-3">
                         <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300",
                            useAsChatTemplate ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground"
                         )}>
                            <MessageSquare size={16} />
                         </div>
                         <div>
                            <h3 className="text-sm font-medium text-foreground">
                               {getText('common', 'chatSlashCommand', language)}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                               {getText('common', 'chatSlashCommandDesc', language)}
                            </p>
                         </div>
                      </div>

                      <div className={cn(
                         "w-10 h-5 rounded-full relative transition-colors duration-300",
                         useAsChatTemplate ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                      )}>
                         <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow",
                            useAsChatTemplate ? "translate-x-5" : "translate-x-0.5"
                         )} />
                      </div>
                   </div>

                   {/* 智能提示 */}
                   {useAsChatTemplate && (
                      <motion.div
                         initial={{ opacity: 0, height: 0 }}
                         animate={{ opacity: 1, height: "auto" }}
                         exit={{ opacity: 0, height: 0 }}
                         transition={{ duration: 0.2 }}
                         className="mt-3 pt-3 border-t border-border/50 flex gap-2 overflow-hidden"
                      >
                         <div className="shrink-0 mt-0.5 text-primary"><Sparkles size={12} /></div>
                         <div className="text-[10px] text-muted-foreground leading-relaxed">
                            {language === 'zh' ? (
                               <>
                                  <span className="font-medium text-foreground">智能拼接模式：</span><br/>
                                  • 若内容包含 <code className="bg-secondary px-1 rounded border border-border">{'{{变量}}'}</code>，输入将自动填充。<br/>
                                  • 若无变量，输入将自动拼接到内容末尾。
                               </>
                            ) : (
                               <>
                                  <span className="font-medium text-foreground">Smart Assembly:</span><br/>
                                  • Fills <code className="bg-secondary px-1 rounded border border-border">{'{{variable}}'}</code> if present.<br/>
                                  • Otherwise, appends your input to the end.
                               </>
                            )}
                         </div>
                      </motion.div>
                   )}
                </motion.div>
             )}
          </AnimatePresence>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"> <Tag size={14} /> {getText('editor', 'labelTitle', language)} </label>
            <input autoFocus className="w-full bg-secondary/20 border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/40" placeholder={getText('editor', 'placeholderTitle', language)} value={title} onChange={e => setTitle(e.target.value)} />
            {useAsChatTemplate && title && (
                <p className="text-[10px] text-primary/80 animate-in fade-in flex items-center gap-1">
                    <Terminal size={10} />
                    {getText('common', 'triggerLabel', language)}
                    <span className="font-mono font-bold">/{title.replace(/\s+/g, '')}</span>
                </p>
            )}
          </div>

          {/* Group */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"> <Folder size={14} /> {getText('editor', 'labelGroup', language)} </label>
            {!newGroupMode ? ( 
              <div className="flex gap-2"> 
                <div className="relative flex-1"> 
                  <button type="button" onClick={() => setIsGroupOpen(!isGroupOpen)} className={cn( "w-full flex items-center justify-between bg-secondary/20 border border-border rounded-lg px-3 py-2.5 text-sm text-left outline-none transition-all", isGroupOpen ? "ring-2 ring-primary/50 border-primary/50" : "hover:border-primary/30" )} > 
                    <span className="truncate">{group}</span> 
                    <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-200", isGroupOpen && "rotate-180")} /> 
                  </button> 
                  {isGroupOpen && ( <> <div className="fixed inset-0 z-10" onClick={() => setIsGroupOpen(false)} /> <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100"> {groups.map(g => ( <button key={g} type="button" onClick={() => { setGroup(g); setIsGroupOpen(false); }} className={cn("w-full flex items-center justify-between px-3 py-2 text-sm transition-colors", group === g ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-secondary/50")} > <span>{g}</span> {group === g && <Check size={14} />} </button> ))} </div> </> )} 
                </div> 
                <button onClick={() => setNewGroupMode(true)} className="px-3 flex items-center gap-1 text-xs font-medium border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"> <Plus size={14} /> {getText('editor', 'btnNewGroup', language)} </button> 
              </div> 
            ) : ( 
              <div className="flex gap-2 animate-in fade-in duration-200"> <input className="flex-1 bg-secondary/20 border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none" placeholder={getText('editor', 'placeholderGroup', language)} autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)} /> <button onClick={() => setNewGroupMode(false)} className="px-4 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg border border-transparent hover:border-border transition-all"> {getText('editor', 'btnCancel', language)} </button> </div> 
            )}
          </div>
          
          {/* Command Options */}
          {type === 'command' && (
            <div className="space-y-4 pt-4 border-t border-border/50 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                  <label htmlFor="executable-toggle" className="flex items-center gap-2 cursor-pointer select-none">
                      <Terminal size={14} className="text-muted-foreground" />
                      <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground">{getText('editor', 'executable', language)}</span>
                          <span className="text-xs text-muted-foreground">{getText('editor', 'executableDesc', language)}</span>
                      </div>
                  </label>
                  <div onClick={() => setIsExecutable(!isExecutable)} id="executable-toggle" className={cn( "w-10 h-5 rounded-full relative transition-colors duration-300 cursor-pointer", isExecutable ? "bg-primary" : "bg-slate-300 dark:bg-slate-600" )}>
                      <div className={cn( "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow", isExecutable ? "translate-x-5" : "translate-x-0.5" )} />
                  </div>
              </div>
              
              {isExecutable && (
                  <div className="space-y-2 pl-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('editor', 'execShell', language)}</label>
                      
                      <div className="relative">
                          <button
                              type="button"
                              onClick={() => setIsShellOpen(!isShellOpen)}
                              className={cn(
                                  "w-full flex items-center justify-between bg-secondary/20 border border-border rounded-lg px-3 py-2.5 text-sm text-left outline-none transition-all",
                                  isShellOpen ? "ring-2 ring-primary/50 border-primary/50" : "hover:border-primary/30"
                              )}
                          >
                              <span>{currentShellLabel}</span>
                              <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-200", isShellOpen && "rotate-180")} />
                          </button>

                          {isShellOpen && (
                              <>
                                  <div className="fixed inset-0 z-10" onClick={() => setIsShellOpen(false)} />
                                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                      {SHELL_OPTIONS.map(opt => (
                                          <button
                                              key={opt.value}
                                              type="button"
                                              onClick={() => {
                                                  setShellType(opt.value);
                                                  setIsShellOpen(false);
                                              }}
                                              className={cn(
                                                  "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                                                  shellType === opt.value 
                                                      ? "bg-primary/10 text-primary font-medium" 
                                                      : "text-foreground hover:bg-secondary/50"
                                              )}
                                          >
                                              <span>{opt.value === 'auto' ? getText('editor', 'autoDetect', language) : opt.label}</span>
                                              {shellType === opt.value && <Check size={14} />}
                                          </button>
                                      ))}
                                  </div>
                              </>
                          )}
                      </div>

                      {shellType === 'python' && (
                          <div className={cn(
                              "flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all",
                              pythonStatus.loading ? "bg-secondary/20 border-border text-muted-foreground" :
                              pythonStatus.available ? "bg-green-500/10 border-green-500/20 text-green-600" :
                              "bg-red-500/10 border-red-500/20 text-red-500"
                          )}>
                              {pythonStatus.loading ? (
                                  <>
                                      <Loader2 size={14} className="animate-spin" />
                                      <span>{getText('common', 'checking', language)}</span>
                                  </>
                              ) : pythonStatus.available ? (
                                  <>
                                      <Check size={14} />
                                      <span className="font-mono font-medium">{pythonStatus.version}</span>
                                  </>
                              ) : (
                                  <>
                                      <AlertTriangle size={14} />
                                      <span>Python Not Found</span>
                                      <button
                                          onClick={checkPythonEnv}
                                          className="ml-auto p-1 hover:bg-red-500/10 rounded transition-colors"
                                          title={getText('monitor', 'refresh', language)}
                                      >
                                          <RefreshCw size={12} />
                                      </button>
                                  </>
                              )}
                          </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/70">
                          {shellType === 'python'
                              ? "Runs code in an isolated .py file with UTF-8 encoding."
                              : getText('patch', 'autoRecommended', language)}
                      </p>
                  </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-4 border-t border-border/50">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"> <FileText size={14} /> {getText('editor', 'labelContent', language)} </label>
            <div className="relative">
              <textarea className="w-full h-48 bg-secondary/20 border border-border rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40" placeholder={type === 'command' && isExecutable ? getText('patch', 'commandExample', language) : getText('patch', 'commandPlaceholder', language)} value={content} onChange={e => setContent(e.target.value)} />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/60 bg-background/50 px-2 py-1 rounded border border-border/50 backdrop-blur-sm">
                {type === 'command' && isExecutable ? getText('patch', 'chainCommands', language) : getText('patch', 'variableTip', language)}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/5 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"> {getText('editor', 'btnCancel', language)} </button>
          <button 
            onClick={handleSave} 
            disabled={!title || !content || isSaving} 
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-primary/20" 
          > 
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            {isSaving ? "Saving..." : getText('editor', 'btnSave', language)} 
          </button>
        </div>
      </div>
    </div>
  );
}