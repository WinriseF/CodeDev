import { useState, useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window'; // Tauri v1 窗口 API
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  // 监听窗口最大化状态，以便切换图标
  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    // 监听窗口尺寸变化事件
    const unlisten = appWindow.onResized(checkMaximized);
    return () => {
      unlisten.then(f => f());
    }
  }, []);

  const togglePfMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  return (
    <div 
      data-tauri-drag-region 
      className="h-8 bg-slate-950 flex items-center justify-between select-none border-b border-slate-800"
    >
      {/* 左侧：Logo 和 标题 (支持拖拽) */}
      <div className="flex items-center gap-2 px-4 pointer-events-none">
        <div className="w-3 h-3 bg-blue-500 rounded-full" />
        <span className="text-xs font-bold text-slate-300 tracking-wide">CodeForge AI</span>
      </div>

      {/* 右侧：窗口控制按钮 (不需要拖拽，所以要用 no-drag 防止冲突) */}
      <div className="flex h-full">
        <button 
          onClick={() => appWindow.minimize()}
          className="h-full w-10 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Minus size={14} />
        </button>
        
        <button 
          onClick={togglePfMaximize}
          className="h-full w-10 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {isMaximized ? <Maximize2 size={12} /> : <Square size={12} />}
        </button>
        
        <button 
          onClick={() => appWindow.close()}
          className="h-full w-10 flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}