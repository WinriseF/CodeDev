import { useState } from 'react';
import { Search as SearchIcon, Bot, Zap, AppWindow, Terminal, Sparkles, X, MessageSquare, CornerDownRight, Calculator, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from './SpotlightContext';
import { useSmartContextMenu } from '@/lib/hooks';
import { getText } from '@/lib/i18n';
import { ChatCommandMenu } from './ChatCommandMenu';
import { Prompt } from '@/types/prompt';
import { usePromptStore } from '@/store/usePromptStore';
import { SearchScope } from '@/types/spotlight';

interface SearchBarProps {
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SearchBar({ onKeyDown }: SearchBarProps) {
  const {
    mode, query, chatInput, searchScope, activeTemplate,
    setQuery, setChatInput, toggleMode, inputRef, setSearchScope, setActiveTemplate
  } = useSpotlight();

  const { language, aiConfig, setAIConfig, savedProviderSettings } = useAppStore();
  const { chatTemplates } = usePromptStore();

  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);

  const showCommandMenu = mode === 'chat' && !activeTemplate && chatInput.startsWith('/');
  const commandKeyword = showCommandMenu ? chatInput.slice(1) : '';

  const filteredPrompts = showCommandMenu
      ? chatTemplates.filter((p: Prompt) =>
          commandKeyword === '' ||
          p.title.toLowerCase().includes(commandKeyword.toLowerCase())
        ).slice(0, 5)
      : [];

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (searchScope !== 'global' && inputValue === '' && e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType === 'deleteContentBackward') {
        setSearchScope('global');
        setQuery('');
        return;
    }

    if (mode === 'search' && searchScope === 'global') {
      const match = inputValue.match(/^([=]|>|》|\?|？)/);

      if (match) {
        const trigger = match[1];
        let targetScope: SearchScope | null = null;

        if (trigger === '=') targetScope = 'math';
        else if (trigger === '>' || trigger === '》') targetScope = 'shell';
        else if (trigger === '?' || trigger === '？') targetScope = 'web';

        if (targetScope) {
            setSearchScope(targetScope);
            const cleanQuery = inputValue.substring(trigger.length);
            setTimeout(() => {
                setQuery(cleanQuery);
            }, 0);
            return;
        }
      }

      if (inputValue.startsWith('/app ')) { setSearchScope('app'); setQuery(''); return; }
      if (inputValue.startsWith('/cmd ')) { setSearchScope('command'); setQuery(''); return; }
      if (inputValue.startsWith('/pmt ')) { setSearchScope('prompt'); setQuery(''); return; }
    }

    setQuery(inputValue);
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setChatInput(val);
      if (val.startsWith('/')) {
          setMenuSelectedIndex(0);
      }
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
    const providers = Object.keys(savedProviderSettings);
    const currentIndex = providers.indexOf(aiConfig.providerId);

    if (providers.length > 0) {
        const nextIndex = (currentIndex + 1) % providers.length;
        setAIConfig({ providerId: providers[nextIndex] });
    }
  };

  const handleTemplateSelect = (prompt: Prompt) => {
      setActiveTemplate(prompt);
      setChatInput('');
      setMenuSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (mode === 'chat' && activeTemplate && chatInput === '' && e.key === 'Backspace') {
          e.preventDefault();
          setActiveTemplate(null);
          setChatInput(`/${activeTemplate.title}`);
          return;
      }

      if (showCommandMenu && filteredPrompts.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMenuSelectedIndex(prev => (prev + 1) % filteredPrompts.length);
              return;
          }
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMenuSelectedIndex(prev => (prev - 1 + filteredPrompts.length) % filteredPrompts.length);
              return;
          }
          if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();

              if (!e.shiftKey) {
                  handleTemplateSelect(filteredPrompts[menuSelectedIndex]);
              }
              return;
          }
      }

      if (mode === 'search' && searchScope !== 'global' && e.key === 'Backspace' && query === '') {
        e.preventDefault();
        setSearchScope('global');
        return;
      }

      onKeyDown?.(e);
  };

  const renderLeftTag = () => {
    if (mode === 'chat' && activeTemplate) {
        return (
            <div className="flex items-center gap-1.5 pl-2 pr-3 py-1 bg-blue-600 text-white rounded-md text-xs font-bold transition-all duration-300 animate-in zoom-in-95 group relative z-10 shrink-0 select-none shadow-sm shadow-blue-500/20">
                <MessageSquare size={14} className="fill-current" />
                <span className="truncate max-w-[100px]">{activeTemplate.title}</span>
                <button
                  onClick={() => { setActiveTemplate(null); setChatInput(`/${activeTemplate.title}`); }}
                  className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X size={10} />
                </button>
            </div>
        );
    }

    if (mode === 'search' && searchScope !== 'global') {
        let IconComponent;
        let bgColor = 'bg-secondary/30';
        let textColor = 'text-muted-foreground';
        let borderColor = 'border-transparent';

        switch (searchScope) {
            case 'app':
                IconComponent = AppWindow;
                bgColor = 'bg-cyan-500/10'; textColor = 'text-cyan-500'; borderColor = 'border-cyan-500/20';
                break;
            case 'command':
                IconComponent = Terminal;
                bgColor = 'bg-orange-500/10'; textColor = 'text-orange-500'; borderColor = 'border-orange-500/20';
                break;
            case 'prompt':
                IconComponent = Sparkles;
                bgColor = 'bg-purple-500/10'; textColor = 'text-purple-500'; borderColor = 'border-purple-500/20';
                break;
            case 'math':
                IconComponent = Calculator;
                bgColor = 'bg-emerald-500/10'; textColor = 'text-emerald-500'; borderColor = 'border-emerald-500/20';
                break;
            case 'shell':
                IconComponent = Terminal;
                bgColor = 'bg-slate-500/10'; textColor = 'text-foreground'; borderColor = 'border-slate-500/20';
                break;
            case 'web':
                IconComponent = Globe;
                bgColor = 'bg-blue-500/10'; textColor = 'text-blue-500'; borderColor = 'border-blue-500/20';
                break;
            default: return null;
        }

        return (
            <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 animate-in zoom-in-95 group relative z-10 shrink-0 border",
                bgColor, textColor, borderColor
            )}>
                <IconComponent size={18} />
            </div>
        );
    }
    return null;
  };

  return (
    <div data-tauri-drag-region className={cn("h-16 shrink-0 flex items-center px-5 gap-4 border-b transition-colors duration-300 cursor-move relative z-20", mode === 'chat' ? "border-purple-500/20" : "border-border/40")}>

      <button onClick={toggleMode} className="w-6 h-6 flex items-center justify-center relative outline-none group" title={getText('spotlight', 'toggleMode', language)}>
          <SearchIcon className={cn("absolute transition-all duration-300 text-muted-foreground/70 group-hover:text-foreground", mode === 'search' ? "scale-100 opacity-100" : "scale-50 opacity-0 rotate-90")} size={24} />
          <Bot className={cn("absolute transition-all duration-300 text-purple-500", mode === 'chat' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90")} size={24} />
      </button>

      {renderLeftTag()}

      <div className="flex-1 relative h-full flex items-center">
          {mode === 'chat' && activeTemplate && !chatInput && (
              <div className="absolute left-0 text-muted-foreground/30 text-xl pointer-events-none flex items-center gap-2 animate-in fade-in duration-300">
                  <CornerDownRight size={16} />
                  <span className="text-sm italic font-medium">Input parameter...</span>
              </div>
          )}

          <input
            ref={inputRef}
            onContextMenu={onContextMenu}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none outline-none text-xl placeholder:text-muted-foreground/40 h-full text-foreground caret-primary relative z-10"
            placeholder={
                mode === 'search'
                    ? (searchScope === 'global' ? getText('spotlight', 'searchPlaceholder', language) :
                       searchScope === 'math' ? "Expression..." :
                       searchScope === 'shell' ? "Shell Command..." :
                       searchScope === 'web' ? "Search Google..." :
                       `${getText('spotlight', 'filterPlaceholder', language)}...`)
                    : (activeTemplate ? "" : getText('spotlight', 'chatPlaceholder', language))
            }
            value={mode === 'search' ? query : chatInput}
            onChange={mode === 'search' ? handleQueryChange : handleChatInputChange}
            autoFocus
            spellCheck={false}
          />

          {showCommandMenu && (
              <ChatCommandMenu
                  inputValue={commandKeyword}
                  selectedIndex={menuSelectedIndex}
                  onSelect={handleTemplateSelect}
              />
          )}
      </div>

      <div className="flex items-center gap-2 relative z-10">
         {mode === 'chat' && (
            <button onClick={cycleProvider} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 hover:bg-secondary text-[10px] font-medium transition-colors border border-border/50 group" title={getText('spotlight', 'currentProvider', language, { provider: aiConfig.providerId })}>
                <Zap size={10} className={cn(
                    aiConfig.providerId.toLowerCase().includes('deepseek') ? "text-blue-500" :
                    aiConfig.providerId.toLowerCase().includes('openai') ? "text-green-500" :
                    aiConfig.providerId.toLowerCase().includes('anthropic') ? "text-purple-500" :
                    "text-orange-500"
                )} />
                <span className="opacity-70 group-hover:opacity-100 uppercase truncate max-w-[80px]">
                    {aiConfig.providerId}
                </span>
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
