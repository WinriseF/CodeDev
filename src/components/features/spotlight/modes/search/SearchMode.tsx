import { useEffect, useRef } from 'react';
// 引入 History 图标
import { Command, Sparkles, Terminal, CornerDownLeft, Check, Zap, Globe, AppWindow, Calculator, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { SpotlightItem } from '@/types/spotlight';
import { getText } from '@/lib/i18n';
import { useSpotlight } from '../../core/SpotlightContext';
import { invoke } from '@tauri-apps/api/core';
// 引入命令执行器和 Context Store
import { executeCommand } from '@/lib/command_executor';
import { useContextStore } from '@/store/useContextStore';

interface SearchModeProps {
  results: SpotlightItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (item: SpotlightItem) => void;
  copiedId: string | null;
}

export function SearchMode({ results, selectedIndex, setSelectedIndex, onSelect, copiedId }: SearchModeProps) {
  const { language } = useAppStore();
  const { setQuery, inputRef } = useSpotlight(); // 获取 inputRef 用于聚焦
  const { projectRoot } = useContextStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results]);

  const isCommand = (item: SpotlightItem) => item.type === 'command' || (item.content && item.content.length < 50);

  const handleSelect = async (item: SpotlightItem) => {

    // >>> 逻辑 A: 历史记录补全 <<<
    if (item.type === 'shell_history') {
      const command = item.historyCommand?.trim() || '';
      if (command) {
        // 1. 将命令填入搜索框，保持前缀
        setQuery(`> ${command}`);

        // 2. 聚焦输入框并将光标移到末尾
        setTimeout(() => {
          const input = inputRef.current;
          if (input) {
            input.focus();
            const pos = command.length + 2; // +2 是因为 "> "
            input.setSelectionRange(pos, pos);
          }
        }, 0);

        // 3. 核心需求：重新定位到第一行（即"执行"选项）
        setSelectedIndex(0);
      }
      return; // 结束，不执行
    }

    // >>> 逻辑 B: 执行命令 <<<
    if (item.type === 'shell') {
      const commandToExecute = (item.shellCmd || '').trim();

      console.log('[Spotlight] Executing shell command:', commandToExecute);

      if (!commandToExecute) return;

      // 1. 立即清空输入框
      setQuery('');

      // 2. 并行执行：执行命令 + 记录历史
      const executionTask = executeCommand(commandToExecute, 'auto', projectRoot)
        .catch(err => console.error('[Spotlight] Execution failed:', err));

      console.log('[Spotlight] Recording command to history:', commandToExecute);
      const recordTask = invoke('record_shell_command', { command: commandToExecute })
        .then(() => console.log('[Spotlight] Command recorded successfully'))
        .catch(err => console.error('[Spotlight] History record failed:', err));

      await Promise.all([executionTask, recordTask]);
      return;
    }

    // 其他类型保持原有逻辑
    onSelect(item);
  };

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 opacity-60 min-h-[100px]">
        <Command size={24} strokeWidth={1.5} />
        <span className="text-sm">{getText('spotlight', 'noCommands', language)}</span>
      </div>
    );
  }

  const getActionLabel = (item: SpotlightItem) => {
    if (item.type === 'url') return getText('spotlight', 'openLink', language);
    if (item.type === 'app') return getText('spotlight', 'openApp', language);
    if (item.type === 'shell' || item.isExecutable) return getText('actions', 'run', language);
    if (item.type === 'shell_history') return getText('actions', 'run', language); // 或 "Autocomplete"
    if (item.type === 'math') return getText('spotlight', 'copyResult', language) || "Copy";
    return getText('spotlight', 'copy', language);
  };

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar scroll-smooth">
      {results.map((item, index) => {
        const isActive = index === selectedIndex;
        const isCopied = copiedId === item.id;
        const isExecutable = !!item.isExecutable;
        const hasDesc = !!item.description;

        let Icon = Sparkles;
        // ... (图标选择逻辑)
        if (item.type === 'shell_history') Icon = History; // 历史记录用 History 图标
        if (item.type === 'shell') Icon = Zap;     // 当前执行用 Zap 图标
        else if (item.type === 'math') Icon = Calculator;
        else if (item.type === 'url') Icon = Globe;
        else if (item.type === 'app') Icon = AppWindow;
        else if (isExecutable) Icon = Zap;
        else if (isCommand(item)) Icon = Terminal;

        return (
          <div
            key={item.id}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "relative px-4 py-3 rounded-lg flex items-start gap-4 cursor-pointer transition-all duration-150 group",
              isActive
                ? (item.type === 'shell' ? "bg-orange-600 text-white shadow-sm scale-[0.99]" : // 区分颜色：橙色强调执行
                   item.type === 'shell_history' ? "bg-indigo-600 text-white shadow-sm scale-[0.99]" : // 区分颜色：靛青色表示历史
                   isExecutable ? "bg-indigo-600 text-white shadow-sm scale-[0.99]" :
                   item.type === 'url' ? "bg-blue-600 text-white shadow-sm scale-[0.99]" :
                   item.type === 'app' ? "bg-cyan-600 text-white shadow-sm scale-[0.99]" :
                   item.type === 'math' ? "bg-emerald-600 text-white shadow-sm scale-[0.99]" :
                   "bg-primary text-primary-foreground shadow-sm scale-[0.99]")
                : "text-foreground hover:bg-secondary/40",
              isCopied && "bg-green-500 text-white"
            )}
          >
            <div className={cn(
              "w-9 h-9 mt-0.5 rounded-md flex items-center justify-center shrink-0 transition-colors",
              isActive ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground",
              isCopied && "bg-white/20"
            )}>
              {isCopied ? <Check size={18} /> : (
                item.icon && typeof item.icon === 'object' ? item.icon : <Icon size={18} />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className={cn(
                  "font-semibold truncate text-sm tracking-tight",
                  isActive ? "text-white" : "text-foreground",
                  item.type === 'shell' && "font-bold text-base" // 当前执行项字体加大
                )}>
                  {item.title}
                </span>

                {isActive && !isCopied && (
                  <span className="text-[10px] opacity-70 flex items-center gap-1 font-medium bg-black/10 px-1.5 rounded whitespace-nowrap">
                    <CornerDownLeft size={10} />
                    {item.type === 'shell_history' ? "Tab / Enter to Complete" : getActionLabel(item)}
                  </span>
                )}
              </div>

              {hasDesc && (
                <div className={cn(
                  "text-xs transition-all flex items-center gap-1",
                  isActive ? "opacity-90 text-white/90" : "text-muted-foreground opacity-70 truncate"
                )}>
                  {item.type === 'shell_history' && <History size={12} />}
                  {item.description}
                </div>
              )}

              {item.type !== 'math' && (
                <div className={cn("text-xs transition-all duration-200", isActive ? (item.type === 'app' ? "opacity-80 text-white/80 truncate" : "mt-1 bg-black/20 rounded p-2 text-white/95 whitespace-pre-wrap break-all line-clamp-6") : (hasDesc ? "hidden" : "text-muted-foreground opacity-50 truncate"))}>
                    {item.content}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
