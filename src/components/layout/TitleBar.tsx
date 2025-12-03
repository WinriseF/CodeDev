import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Minus, Square, X, Maximize2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

const appWindow = getCurrentWebviewWindow()

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { language } = useAppStore();

  useEffect(() => {
    const checkMaximized = async () => { setIsMaximized(await appWindow.isMaximized()); };
    const unlisten = appWindow.onResized(checkMaximized);
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => { 
      unlisten.then(f => f());
      clearInterval(timer);
    }
  }, []);

  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',     // 12月 / Dec
      day: 'numeric',     // 03
      weekday: 'short',   // 周三 / Wed
      hour: 'numeric',    // 21
      minute: '2-digit',  // 57
      hour12: false       // 24小时制
    }).format(date);
  };

  const btnClass = "h-full w-10 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors";

  return (
    <div 
      data-tauri-drag-region 
      className="h-8 bg-background flex items-center justify-between select-none border-b border-border shrink-0 transition-colors duration-300"
    >
      <div className="flex items-center gap-2 px-4 pointer-events-none h-full">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/30 border border-border/50">
           <Clock size={12} className="text-primary/70" />
           <span className="text-[10px] font-mono font-medium text-muted-foreground tracking-wide tabular-nums">
              {formatTime(currentTime)}
           </span>
        </div>
      </div>

      <div className="flex h-full">
        <button onClick={() => appWindow.minimize()} className={btnClass}><Minus size={14} /></button>
        <button onClick={toggleMaximize} className={btnClass}>{isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}</button>
        <button onClick={() => appWindow.hide()} className={cn(btnClass, "hover:bg-destructive hover:text-destructive-foreground")}><X size={14} /></button>
      </div>
    </div>
  );
}