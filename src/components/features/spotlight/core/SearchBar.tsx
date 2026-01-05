import { Search as SearchIcon, Bot, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from './SpotlightContext';
import { useSmartContextMenu } from '@/lib/hooks';
import { getText } from '@/lib/i18n';

interface SearchBarProps {
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SearchBar({ onKeyDown }: SearchBarProps) {
  const { mode, query, chatInput, setQuery, setChatInput, toggleMode, inputRef } = useSpotlight();
  const { language, aiConfig, setAIConfig } = useAppStore();

  // 粘贴逻辑
  const handlePaste = (pastedText: string, input: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!input || !(input instanceof HTMLInputElement)) return;
    const { selectionStart, selectionEnd } = input;
    const currentValue = mode === 'search' ? query : chatInput;
    const newValue = currentValue.substring(0, selectionStart ?? 0) + pastedText + currentValue.substring(selectionEnd ?? 0);
    
    if (mode === 'search') setQuery(newValue);
    else setChatInput(newValue);

    setTimeout(() => {
      const newCursorPos = (selectionStart ?? 0) + pastedText.length;
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const { onContextMenu } = useSmartContextMenu({ onPaste: handlePaste });

  // 切换 AI 提供商 (逻辑复用)
  const cycleProvider = () => {
    const providers: Array<'openai' | 'deepseek' | 'anthropic'> = ['deepseek', 'openai', 'anthropic'];
    const currentIndex = providers.indexOf(aiConfig.providerId);
    const nextIndex = (currentIndex + 1) % providers.length;
    setAIConfig({ providerId: providers[nextIndex] });
  };

  return (
    <div data-tauri-drag-region className={cn("h-16 shrink-0 flex items-center px-5 gap-4 border-b transition-colors duration-300 cursor-move relative z-10", mode === 'chat' ? "border-purple-500/20" : "border-border/40")}>
      <button onClick={toggleMode} className="w-6 h-6 flex items-center justify-center relative outline-none group" title={getText('spotlight', 'toggleMode', language)}>
          <SearchIcon className={cn("absolute transition-all duration-300 text-muted-foreground/70 group-hover:text-foreground", mode === 'search' ? "scale-100 opacity-100" : "scale-50 opacity-0 rotate-90")} size={24} />
          <Bot className={cn("absolute transition-all duration-300 text-purple-500", mode === 'chat' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90")} size={24} />
      </button>

      <input
        ref={inputRef}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        className="flex-1 bg-transparent border-none outline-none text-xl placeholder:text-muted-foreground/40 h-full text-foreground caret-primary relative z-10"
        placeholder={mode === 'search' ? getText('spotlight', 'searchPlaceholder', language) : getText('spotlight', 'chatPlaceholder', language)}
        value={mode === 'search' ? query : chatInput}
        onChange={e => mode === 'search' ? setQuery(e.target.value) : setChatInput(e.target.value)}
        autoFocus
        spellCheck={false}
      />
      
      <div className="flex items-center gap-2 relative z-10">
         {mode === 'chat' && (
            <button onClick={cycleProvider} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 hover:bg-secondary text-[10px] font-medium transition-colors border border-border/50 group" title={getText('spotlight', 'currentProvider', language, { provider: aiConfig.providerId })}>
                <Zap size={10} className={cn(aiConfig.providerId === 'deepseek' ? "text-blue-500" : aiConfig.providerId === 'openai' ? "text-green-500" : "text-orange-500")} />
                <span className="opacity-70 group-hover:opacity-100 uppercase">{aiConfig.providerId}</span>
            </button>
         )}
         <div className="flex items-center gap-2 pointer-events-none opacity-50">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors duration-300", mode === 'chat' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-secondary text-muted-foreground border-border")}>TAB</span>
              {mode === 'search' && query && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-medium border border-border">ESC {getText('spotlight', 'clear', language)}</span>}
         </div>
      </div>
    </div>
  );
}