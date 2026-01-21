import { useEffect, useRef } from 'react';
import { Prompt } from '@/types/prompt';
import { usePromptStore } from '@/store/usePromptStore';
import { useAppStore } from '@/store/useAppStore';
import { Sparkles, Command, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';

interface ChatCommandMenuProps {
  inputValue: string;
  selectedIndex: number;
  onSelect: (prompt: Prompt) => void;
}

export function ChatCommandMenu({ inputValue, selectedIndex, onSelect }: ChatCommandMenuProps) {
  const { chatTemplates } = usePromptStore();
  const { language } = useAppStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // 过滤逻辑
  const filtered = chatTemplates.filter(p =>
    inputValue === '' ||
    p.title.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 5);

  // 自动滚动
  useEffect(() => {
    if (menuRef.current && filtered.length > 0) {
      const activeEl = menuRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filtered]);

  if (filtered.length === 0) return null;

  return (
    // [UI] 调整 top 位置和阴影，使其更有悬浮感
    <div className="absolute top-[calc(100%+8px)] left-2 right-2 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 flex flex-col">

        {/* Header Tip */}
        <div className="px-3 py-2 bg-secondary/30 border-b border-border/40 flex justify-between items-center text-[10px] text-muted-foreground/70 select-none">
            <span className="font-medium flex items-center gap-1.5 uppercase tracking-wider">
                <Command size={10} />
                {language === 'zh' ? '快捷指令' : 'SLASH COMMANDS'}
            </span>
            <span className="font-mono opacity-50">TAB / ↑↓ to navigate</span>
        </div>

        {/* List Area */}
        <div ref={menuRef} className="max-h-[300px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
            {filtered.map((item, idx) => {
                const isActive = idx === selectedIndex;
                return (
                    <div
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className={cn(
                            "relative flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 group",
                            // [UI] 选中态：不再是大蓝块，而是轻微背景 + 左侧边框指示
                            isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground/80 hover:bg-secondary/40"
                        )}
                    >
                        {/* 左侧激活指示条 */}
                        {isActive && (
                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                        )}

                        <div className="flex items-center justify-between pl-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                {/* Icon */}
                                <div className={cn(
                                    "flex items-center justify-center w-5 h-5 rounded-md shrink-0 transition-colors",
                                    isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                                )}>
                                    <Sparkles size={12} />
                                </div>

                                {/* Title */}
                                <span className={cn("font-medium text-sm truncate", isActive && "text-primary")}>
                                    {item.title}
                                </span>

                                {/* Group Badge (Subtle) */}
                                <span className="text-[10px] text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded border border-transparent group-hover:border-border/50 transition-colors">
                                    {item.group}
                                </span>
                            </div>

                            {isActive && (
                                <ArrowRight size={14} className="text-primary/50 animate-pulse mr-1" />
                            )}
                        </div>

                        {/* Content Preview */}
                        <div className={cn(
                            "text-xs truncate font-mono pl-9 opacity-50 overflow-hidden text-ellipsis whitespace-nowrap",
                            isActive ? "opacity-70" : "opacity-40"
                        )}>
                            {item.content}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
}
