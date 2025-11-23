import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Terminal, Calendar, Tag, Box, Globe, Variable } from 'lucide-react';
import { Prompt } from '@/types/prompt';
import { parseVariables } from '@/lib/template';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PromptDetailTooltipProps {
  prompt: Prompt;
  anchorRect: DOMRect | null;
  isOpen: boolean;
}

export function PromptDetailTooltip({ prompt, anchorRect, isOpen }: PromptDetailTooltipProps) {
  const { language } = useAppStore();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  
  // 是否已完成定位计算
  const [isPositioned, setIsPositioned] = useState(false);
  
  const tooltipRef = useRef<HTMLDivElement>(null);

  const variables = parseVariables(prompt.content);
  
  // 它会在 DOM 变更后、浏览器绘制前同步触发，杜绝闪烁
  useLayoutEffect(() => {
    if (isOpen && anchorRect && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const tooltipRect = tooltip.getBoundingClientRect();
      const padding = 12;

      let left = anchorRect.right + padding;
      let top = anchorRect.top;

      // 视口边界检查
      if (left + tooltipRect.width > window.innerWidth) {
        left = anchorRect.left - tooltipRect.width - padding;
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - padding;
      }
      if (top < padding) top = padding;

      setPosition({ top, left });
      
      // 标记为已定位，允许显示
      setIsPositioned(true);
    } else {
      // 如果关闭了，重置状态以便下次重新计算
      setIsPositioned(false);
    }
  }, [isOpen, anchorRect]);

  if (!isOpen || !anchorRect) return null;

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  return createPortal(
    <div 
      ref={tooltipRef}
      className={cn(
        "fixed z-[100] w-[380px] transition-opacity duration-200", // 移除之前的 zoom-in 动画，因为这会干扰首次定位测量
        isPositioned ? "opacity-100" : "opacity-0 pointer-events-none" // 未定位时隐藏但保留占位
      )}
      style={{ top: position.top, left: position.left }}
    >
      {/* 流光边框容器 */}
      <div className="relative group rounded-xl p-[1.5px] overflow-hidden">
        
        {/* 动态流光背景层 */}
        <div className="absolute inset-[-50%] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#3B82F6_50%,#E2E8F0_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,#1e293b_0%,#3b82f6_50%,#1e293b_100%)] animate-[spin_4s_linear_infinite]" />
        
        {/* 内容层 (遮住中间，只漏出边缘) */}
        <div className="relative bg-popover/95 backdrop-blur-xl shadow-2xl rounded-xl overflow-hidden flex flex-col text-sm text-popover-foreground h-full">
            
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-secondary/10 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-base leading-tight">{prompt.title}</h3>
                {prompt.source === 'official' ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-500 font-medium border border-blue-500/20">
                        <Globe size={10} /> Official
                    </span>
                ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-500 font-medium border border-green-500/20">
                        <Terminal size={10} /> Local
                    </span>
                )}
            </div>
            {prompt.packId && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Box size={12} />
                    <span>Pack: {prompt.packId}</span>
                </div>
            )}
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-background/50">
            {prompt.description && (
                <div className="text-muted-foreground leading-relaxed">
                {prompt.description}
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground uppercase font-bold tracking-wider">
                <span>Prompt Template</span>
                <span className="text-[10px] opacity-60">{prompt.content.length} chars</span>
                </div>
                <pre className="bg-secondary/50 border border-border/50 rounded-lg p-3 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed text-foreground/90">
                {prompt.content.split(/(\{\{.*?\}\})/).map((part, i) => 
                    part.startsWith('{{') ? <span key={i} className="text-orange-500 font-bold">{part}</span> : part
                )}
                </pre>
            </div>
            
            {variables.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                    <div className="w-full flex items-center gap-1 text-xs text-orange-600 font-medium mb-1">
                        <Variable size={12} />
                        {getText('editor', 'tip', language).split(':')[0]}
                    </div>
                    {variables.map(v => (
                        <span key={v} className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 text-[10px] rounded border border-orange-500/20 font-mono">
                            {v}
                        </span>
                    ))}
                </div>
            )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-secondary/20 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
                <Tag size={12} />
                {prompt.tags && prompt.tags.length > 0 ? (
                    <div className="flex gap-1">
                        {prompt.tags.map(t => <span key={t} className="hover:text-foreground transition-colors">#{t}</span>)}
                    </div>
                ) : (
                    <span className="opacity-50">No tags</span>
                )}
            </div>
            <div className="flex items-center gap-1.5 opacity-70">
                <Calendar size={12} />
                <span>{formatDate(prompt.updatedAt)}</span>
            </div>
            </div>

        </div>
      </div>
    </div>,
    document.body
  );
}