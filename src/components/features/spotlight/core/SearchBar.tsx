import { Search as SearchIcon, Bot, Zap, AppWindow, Terminal, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from './SpotlightContext';
import { useSmartContextMenu } from '@/lib/hooks';
import { getText } from '@/lib/i18n';
import { SearchScope } from '@/types/spotlight';

interface SearchBarProps {
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SearchBar({ onKeyDown }: SearchBarProps) {
  const { mode, query, chatInput, setQuery, setChatInput, toggleMode, inputRef, searchScope, setSearchScope } = useSpotlight();
  const { language, aiConfig, setAIConfig } = useAppStore();

  // 处理搜索前缀的逻辑
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // 如果当前有作用域，但用户删除了所有内容，且再按 Backspace，则退出作用域
    if (searchScope !== 'global' && inputValue === '' && e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType === 'deleteContentBackward') {
        setSearchScope('global');
        setQuery('');
        return;
    }

    // 仅在全局搜索模式下，检查前缀
    if (mode === 'search' && searchScope === 'global') {
      if (inputValue.startsWith('/app ')) {
        setSearchScope('app');
        setQuery('');
        return;
      }
      if (inputValue.startsWith('/cmd ')) {
        setSearchScope('command');
        setQuery('');
        return;
      }
      if (inputValue.startsWith('/pmt ')) {
        setSearchScope('prompt');
        setQuery('');
        return;
      }
    }

    // 如果没有匹配到特殊前缀，或者已经处于特定搜索模式，则正常更新 query
    setQuery(inputValue);
  };

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


  const cycleProvider = () => {
    const providers: Array<'openai' | 'deepseek' | 'anthropic'> = ['deepseek', 'openai', 'anthropic'];
    const currentIndex = providers.indexOf(aiConfig.providerId);
    const nextIndex = (currentIndex + 1) % providers.length;
    setAIConfig({ providerId: providers[nextIndex] });
  };

  // 渲染搜索范围标签
  const renderSearchScopeTag = () => {
    if (mode !== 'search' || searchScope === 'global') return null;

    let IconComponent;
    let labelKey;
    let bgColor = 'bg-secondary/30';
    let textColor = 'text-muted-foreground';

    switch (searchScope) {
      case 'app':
        IconComponent = AppWindow;
        labelKey = getText('spotlight', 'Apps', language);
        bgColor = 'bg-cyan-500/10';
        textColor = 'text-cyan-500';
        break;
      case 'command':
        IconComponent = Terminal;
        labelKey = getText('spotlight', 'Commands', language);
        bgColor = 'bg-orange-500/10';
        textColor = 'text-orange-500';
        break;
      case 'prompt':
        IconComponent = Sparkles;
        labelKey = getText('spotlight', 'Prompts', language);
        bgColor = 'bg-purple-500/10';
        textColor = 'text-purple-500';
        break;
      default:
        return null;
    }

    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
          bgColor, textColor,
          "group relative z-10 shrink-0"
        )}
        title={`Searching in ${labelKey}`}
      >
        <IconComponent size={14} />
        <span>{labelKey}</span>
        <button
          onClick={() => { setSearchScope('global'); setQuery(''); }}
          className="p-0.5 ml-1 rounded-full hover:bg-black/10 text-current opacity-70 hover:opacity-100 transition-opacity"
          title={getText('common', 'clear', language)}
        >
          <X size={10} />
        </button>
      </div>
    );
  };

  return (
    <div data-tauri-drag-region className={cn("h-16 shrink-0 flex items-center px-5 gap-4 border-b transition-colors duration-300 cursor-move relative z-10", mode === 'chat' ? "border-purple-500/20" : "border-border/40")}>
      <button onClick={toggleMode} className="w-6 h-6 flex items-center justify-center relative outline-none group" title={getText('spotlight', 'toggleMode', language)}>
          <SearchIcon className={cn("absolute transition-all duration-300 text-muted-foreground/70 group-hover:text-foreground", mode === 'search' ? "scale-100 opacity-100" : "scale-50 opacity-0 rotate-90")} size={24} />
          <Bot className={cn("absolute transition-all duration-300 text-purple-500", mode === 'chat' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90")} size={24} />
      </button>

      {/* 插入搜索范围标签 */}
      {renderSearchScopeTag()}

      <input
        ref={inputRef}
        onContextMenu={onContextMenu}
        onKeyDown={(e) => {
          // 额外处理 Backspace 退出 Scope 的逻辑
          if (mode === 'search' && searchScope !== 'global' && e.key === 'Backspace' && query === '') {
            e.preventDefault();
            setSearchScope('global');
          }
          // 调用外部传入的 onKeyDown
          onKeyDown?.(e);
        }}
        className="flex-1 bg-transparent border-none outline-none text-xl placeholder:text-muted-foreground/40 h-full text-foreground caret-primary relative z-10"
        placeholder={
            mode === 'search'
                ? (searchScope === 'global' ? getText('spotlight', 'searchPlaceholder', language) : `${getText('spotlight', 'filterPlaceholder', language)}...`)
                : getText('spotlight', 'chatPlaceholder', language)
        }
        value={mode === 'search' ? query : chatInput}
        onChange={mode === 'search' ? handleQueryChange : (e => setChatInput(e.target.value))}
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
