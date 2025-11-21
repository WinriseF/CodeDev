import { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileJson, GitMerge, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore, AppView } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { currentView, setView, sidebarWidth, setSidebarWidth, isSidebarOpen, toggleSidebar } = useAppStore();
  const [isResizing, setIsResizing] = useState(false);

  // 菜单项
  const menuItems: { id: AppView; icon: any; label: string }[] = [
    { id: 'prompts', icon: BookOpen, label: 'Prompt Verse' },
    { id: 'context', icon: FileJson, label: 'Context Forge' },
    { id: 'patch', icon: GitMerge, label: 'Patch Weaver' },
  ];

  // 开始拖拽
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  // 停止拖拽
  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 处理拖拽过程
  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        // 限制最小最大宽度
        if (newWidth > 160 && newWidth < 480) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, setSidebarWidth]
  );

  // 绑定全局鼠标事件
  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // 如果折叠了，只显示一个很窄的条
  if (!isSidebarOpen) {
    return (
      <aside className="w-14 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4 gap-4 pt-12">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-800 rounded-md text-slate-400">
          <ChevronRight size={20} />
        </button>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "p-2 rounded-md transition-colors",
              currentView === item.id ? "bg-blue-900/20 text-blue-400" : "text-slate-400 hover:bg-slate-800"
            )}
            title={item.label}
          >
            <item.icon size={20} />
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside 
      style={{ width: sidebarWidth }} 
      className="bg-slate-950 border-r border-slate-800 flex flex-col relative group pt-8"
    >
      {/* 顶部操作区 */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Explorer</span>
        <button onClick={toggleSidebar} className="text-slate-500 hover:text-slate-300">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* 菜单列表 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all truncate",
              currentView === item.id
                ? "bg-blue-900/20 text-blue-400 border border-blue-900/30"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            )}
          >
            <item.icon size={18} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 shrink-0">
         <div className="flex items-center gap-2 text-slate-500 text-sm">
             <Settings size={16}/>
             <span>v3.0.0</span>
         </div>
      </div>

      {/* 拖拽手柄 (Resizer Handle) */}
      <div
        onMouseDown={startResizing}
        className={cn(
          "absolute right-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10",
          isResizing && "bg-blue-600 w-1.5" // 拖拽时变宽变亮
        )}
      />
    </aside>
  );
}