import { useState, useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ShortcutInput({ value, onChange }: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLDivElement>(null);
  const { language } = useAppStore();
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      // 忽略单独的修饰键按下，只记录组合
      const keys = new Set<string>();
      if (e.ctrlKey) keys.add('Ctrl');
      if (e.metaKey) keys.add('Command'); // Mac
      if (e.altKey) keys.add('Alt');
      if (e.shiftKey) keys.add('Shift');

      // 获取主键
      let key = e.key;
      // 处理一些特殊键名
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      
      // 如果不是修饰键本身，则添加
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.add(key);
        // 如果已经按下了主键，且有修饰键，则完成录制
        if (keys.size > 0) {
            const shortcutString = Array.from(keys).join('+');
            onChange(shortcutString);
            setIsRecording(false);
        }
      }
      
      setCurrentKeys(keys);
    };

    const handleKeyUp = () => {
       // 可选：松开所有键才结束？通常不需要，按下主键即结束体验更好
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 点击外部取消录制
    const handleClickOutside = (e: MouseEvent) => {
        if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
            setIsRecording(false);
        }
    };
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecording, onChange]);

  return (
    <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {getText('settings', 'shortcutLabel', language)}
        </label>
        <div className="flex gap-2">
            <div
                ref={inputRef}
                onClick={() => { setIsRecording(true); setCurrentKeys(new Set()); }}
                className={cn(
                    "flex-1 h-9 rounded-lg border flex items-center px-3 text-sm cursor-pointer transition-all select-none",
                    isRecording 
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                        : "border-border bg-secondary/30 hover:border-primary/50"
                )}
            >
                {isRecording ? (
                    <span className="text-primary font-medium animate-pulse">
                        {currentKeys.size > 0 
                            ? Array.from(currentKeys).join(' + ') 
                            : getText('settings', 'shortcutPressKeys', language)}
                    </span>
                ) : (
                    <div className="flex items-center gap-2 w-full">
                        <Keyboard size={14} className="text-muted-foreground" />
                        <span className={cn("font-mono font-medium", !value && "text-muted-foreground italic")}>
                            {value || getText('settings', 'shortcutNotSet', language)}
                        </span>
                    </div>
                )}
            </div>
            
            {value && !isRecording && (
                <button 
                    onClick={() => onChange('')}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-secondary/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                    title={getText('settings', 'shortcutClear', language)}
                >
                    <X size={14} />
                </button>
            )}
        </div>
        <p className="text-[10px] text-muted-foreground/60">
            {getText('settings', 'shortcutTip', language)}
        </p>
    </div>
  );
}