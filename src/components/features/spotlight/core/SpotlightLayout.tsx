import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useSpotlight } from './SpotlightContext';
import { getText } from '@/lib/i18n';

interface SpotlightLayoutProps {
  children: ReactNode;
  header: ReactNode;
  resultCount?: number; // 用于 Footer 显示
  isStreaming?: boolean;
}

export function SpotlightLayout({ children, header, resultCount = 0, isStreaming = false }: SpotlightLayoutProps) {
  const { mode } = useSpotlight();
  const { language } = useAppStore();

  return (
    <div className="w-screen h-screen flex flex-col items-center p-1 bg-transparent font-sans overflow-hidden">
      <div className="w-full h-full flex flex-col bg-background/95 backdrop-blur border border-border/50 rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 relative overflow-hidden">
        
        {/* 背景特效 */}
        <div className={cn("absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out", mode === 'chat' ? "opacity-100" : "opacity-0")}>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10" />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/5 to-transparent" />
        </div>

        {/* 顶部搜索栏 */}
        {header}

        {/* 内容区域 */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
            {children}
        </div>
        
        {/* 底部 Footer */}
        <div data-tauri-drag-region className="h-8 shrink-0 bg-secondary/30 border-t border-border/40 flex items-center justify-between px-4 text-[10px] text-muted-foreground/60 select-none backdrop-blur-sm cursor-move relative z-10">
            <span className="pointer-events-none flex items-center gap-2">
                {mode === 'search' ? `${resultCount} ${getText('spotlight', 'results', language)}` : getText('spotlight', 'console', language)}
                {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
            </span>
            <div className="flex gap-4 pointer-events-none">
                {mode === 'search' ? (
                    <>
                        <span>{getText('spotlight', 'nav', language)} ↑↓</span>
                        <span>{getText('spotlight', 'copy', language)} / {getText('actions', 'run', language)} ↵</span>
                    </>
                ) : (
                    <>
                    <span className={cn(isStreaming && "opacity-30")}>{getText('spotlight', 'clear', language)} Ctrl+K</span> 
                    <span>{getText('spotlight', 'send', language)} ↵</span>
                    </>
                )}
                <span>{getText('spotlight', 'close', language)} Esc</span>
            </div>
        </div>
      </div>
    </div>
  );
}