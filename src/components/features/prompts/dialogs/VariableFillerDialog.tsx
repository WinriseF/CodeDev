import { useState, useEffect, useRef } from 'react';
import { X, Copy, Terminal } from 'lucide-react';
import { Prompt } from '@/types/prompt';
import { fillTemplate } from '@/lib/template';
import { writeText } from '@tauri-apps/api/clipboard';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

interface VariableFillerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt | null;
  variables: string[];
  onSuccess?: () => void;
}

export function VariableFillerDialog({ isOpen, onClose, prompt, variables, onSuccess }: VariableFillerDialogProps) {
  const { language } = useAppStore();
  
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && prompt) {
      setValues({});
      setPreview(prompt.content);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, prompt]);

  useEffect(() => {
    if (!prompt) return;
    const filled = fillTemplate(prompt.content, values);
    setPreview(filled);
  }, [values, prompt]);

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleCopy = async () => {
    if (!prompt) return;
    const finalContent = fillTemplate(prompt.content, values);
    await writeText(finalContent);
    onClose();
    onSuccess?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleCopy();
    }
  };

  if (!isOpen || !prompt) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-[550px] bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-secondary/10">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Terminal size={16} className="text-primary" />
            {getText('filler', 'title', language)}: <span className="text-foreground/80">{prompt.title}</span>
          </h3>
          <button onClick={onClose} className="hover:bg-secondary p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            {variables.map((v, index) => (
              <div key={v} className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  {v}
                </label>
                <input
                  ref={index === 0 ? firstInputRef : null}
                  className="w-full h-10 bg-secondary/30 border border-border/50 focus:border-primary/50 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                  placeholder={`${v}...`}
                  value={values[v] || ''}
                  onChange={e => handleChange(v, e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            ))}
          </div>

          <div className="pt-2">
             <div className="flex items-center justify-between mb-2 ml-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {getText('filler', 'preview', language)}
                </label>
                <span className="text-[10px] text-muted-foreground/60 bg-secondary/50 px-1.5 py-0.5 rounded">Preview</span>
             </div>
            <div className="bg-slate-950/50 dark:bg-slate-950/80 border border-border/50 rounded-lg p-4 relative group">
              <pre className={cn("text-sm font-mono text-foreground/90 whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed", !preview && "text-muted-foreground italic")}>
                {preview}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {getText('filler', 'btnCancel', language)}
          </button>
          <button onClick={handleCopy} className="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center gap-2 shadow-sm shadow-primary/20 active:scale-95 transition-all">
            <Copy size={16} />
            {getText('filler', 'btnCopy', language)}
          </button>
        </div>
      </div>
    </div>
  );
}