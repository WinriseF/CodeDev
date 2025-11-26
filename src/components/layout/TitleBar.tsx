import { useState, useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => { setIsMaximized(await appWindow.isMaximized()); };
    const unlisten = appWindow.onResized(checkMaximized);
    return () => { unlisten.then(f => f()); }
  }, []);

  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  // 通用按钮样式
  const btnClass = "h-full w-10 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors";

  return (
    // 修改：bg-slate-950 -> bg-background, border-slate-800 -> border-border
    <div 
      data-tauri-drag-region 
      className="h-8 bg-background flex items-center justify-between select-none border-b border-border shrink-0 transition-colors duration-300"
    >
      <div className="flex items-center gap-2 px-4 pointer-events-none">
        <div className="w-3 h-3 bg-primary rounded-full" />
        <span className="text-xs font-bold text-muted-foreground tracking-wide">CodeForge AI</span>
      </div>

      <div className="flex h-full">
        <button onClick={() => appWindow.minimize()} className={btnClass}><Minus size={14} /></button>
        <button onClick={toggleMaximize} className={btnClass}>{isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}</button>
        <button onClick={() => appWindow.hide()} className={cn(btnClass, "hover:bg-destructive hover:text-destructive-foreground")}><X size={14} /></button>
      </div>
    </div>
  );
}