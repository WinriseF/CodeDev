import { useState } from 'react';
import { Search as SearchIcon, Bot, Zap, AppWindow, Terminal, Sparkles, X, MessageSquare, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from './SpotlightContext';
import { useSmartContextMenu } from '@/lib/hooks';
import { getText } from '@/lib/i18n';
import { ChatCommandMenu } from './ChatCommandMenu';
import { Prompt } from '@/types/prompt';
import { usePromptStore } from '@/store/usePromptStore';

interface SearchBarProps {
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SearchBar({ onKeyDown }: SearchBarProps) {
  const {
    mode, query, chatInput, searchScope, activeTemplate,
    setQuery, setChatInput, toggleMode, inputRef, setSearchScope, setActiveTemplate
  } = useSpotlight();

  const { language, aiConfig, setAIConfig, savedProviderSettings } = useAppStore();
  // [Fix] 从 store 获取 chatTemplates 而不是 prompts
  const { chatTemplates } = usePromptStore();

  // [New] 菜单控制状态
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(0);

  // 判断是否应该显示菜单
  // 条件：Chat模式 + 没有激活模板 + 输入以/开头
  const showCommandMenu = mode === 'chat' && !activeTemplate && chatInput.startsWith('/');

  // 提取用于过滤的关键字 (去掉开头的 /)
  const commandKeyword = showCommandMenu ? chatInput.slice(1) : '';

  // 计算过滤列表 (用于键盘导航)
  // [Fix] 使用 chatTemplates 进行过滤
  const filteredPrompts = showCommandMenu
      ? chatTemplates.filter((p: Prompt) =>
          commandKeyword === '' ||
          p.title.toLowerCase().includes(commandKeyword.toLowerCase())
        ).slice(0, 5)
      : [];

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

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setChatInput(val);
      // 输入变化时重置菜单索引
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

  // [New] 处理模板选择
  const handleTemplateSelect = (prompt: Prompt) => {
      setActiveTemplate(prompt);
      setChatInput(''); // 清空输入框，准备接收参数
      setMenuSelectedIndex(0);
  };

  // [Fix] 真正的 KeyDown 处理 (包含 Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
      // 1. 特殊情况：Backspace 退出指令模式 (保持不变)
      if (mode === 'chat' && activeTemplate && chatInput === '' && e.key === 'Backspace') {
          e.preventDefault();
          setActiveTemplate(null);
          setChatInput(`/${activeTemplate.title}`);
          return;
      }

      // 2. 菜单交互逻辑 (核心修复点)
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
              // [Critical Fix]
              // 1. 阻止默认回车换行
              e.preventDefault();
              // 2. 阻止冒泡！防止被外层 ChatMode 捕获导致发送
              e.stopPropagation();

              if (!e.shiftKey) {
                  handleTemplateSelect(filteredPrompts[menuSelectedIndex]);
              }
              return; // [Critical] 直接返回，绝对不要执行下面的 onKeyDown
          }
      }

      // 3. 原有的 Search Backspace 逻辑
      if (mode === 'search' && searchScope !== 'global' && e.key === 'Backspace' && query === '') {
        e.preventDefault();
        setSearchScope('global');
        return;
      }

      // 4. 只有没命中菜单逻辑时，才传递给父组件(发送消息)
      onKeyDown?.(e);
  };

  // 渲染搜索范围或模板标签
  const renderLeftTag = () => {
    // 1. Chat Mode: Active Template Tag
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

    // 2. Search Mode Scope Tag
    if (mode === 'search' && searchScope !== 'global') {
        let IconComponent;
        let labelKey;
        let bgColor = 'bg-secondary/30';
        let textColor = 'text-muted-foreground';

        switch (searchScope) {
            case 'app': IconComponent = AppWindow; labelKey = getText('spotlight', 'Apps', language); bgColor = 'bg-cyan-500/10'; textColor = 'text-cyan-500'; break;
            case 'command': IconComponent = Terminal; labelKey = getText('spotlight', 'Commands', language); bgColor = 'bg-orange-500/10'; textColor = 'text-orange-500'; break;
            case 'prompt': IconComponent = Sparkles; labelKey = getText('spotlight', 'Prompts', language); bgColor = 'bg-purple-500/10'; textColor = 'text-purple-500'; break;
            default: return null;
        }

        return (
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200", bgColor, textColor, "group relative z-10 shrink-0")}>
                <IconComponent size={14} />
                <span>{labelKey}</span>
                <button onClick={() => { setSearchScope('global'); setQuery(''); }} className="p-0.5 ml-1 rounded-full hover:bg-black/10 text-current opacity-70 hover:opacity-100 transition-opacity"><X size={10} /></button>
            </div>
        );
    }
    return null;
  };

  return (
    <div data-tauri-drag-region className={cn("h-16 shrink-0 flex items-center px-5 gap-4 border-b transition-colors duration-300 cursor-move relative z-20", mode === 'chat' ? "border-purple-500/20" : "border-border/40")}>

      {/* 模式切换图标 */}
      <button onClick={toggleMode} className="w-6 h-6 flex items-center justify-center relative outline-none group" title={getText('spotlight', 'toggleMode', language)}>
          <SearchIcon className={cn("absolute transition-all duration-300 text-muted-foreground/70 group-hover:text-foreground", mode === 'search' ? "scale-100 opacity-100" : "scale-50 opacity-0 rotate-90")} size={24} />
          <Bot className={cn("absolute transition-all duration-300 text-purple-500", mode === 'chat' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90")} size={24} />
      </button>

      {/* 左侧标签 (Search Scope 或 Active Template) */}
      {renderLeftTag()}

      {/* 输入框 */}
      <div className="flex-1 relative h-full flex items-center">
          {/* 占位符提示: 当选中模板且输入为空时显示 */}
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
                    ? (searchScope === 'global' ? getText('spotlight', 'searchPlaceholder', language) : `${getText('spotlight', 'filterPlaceholder', language)}...`)
                    : (activeTemplate ? "" : getText('spotlight', 'chatPlaceholder', language))
            }
            value={mode === 'search' ? query : chatInput}
            onChange={mode === 'search' ? handleQueryChange : handleChatInputChange}
            autoFocus
            spellCheck={false}
          />

          {/* [New] 挂载菜单 */}
          {showCommandMenu && (
              <ChatCommandMenu
                  inputValue={commandKeyword}
                  selectedIndex={menuSelectedIndex}
                  onSelect={handleTemplateSelect}
              />
          )}
      </div>

      {/* 右侧 Provider 切换 */}
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
