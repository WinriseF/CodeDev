import { BookOpen, FileJson, GitMerge, Settings, ChevronLeft, ChevronRight, Globe, Moon, Sun } from 'lucide-react';
import { useAppStore, AppView } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Sidebar() {
  const { currentView, setView, isSidebarOpen, toggleSidebar } = useAppStore();
  const [isDark, setIsDark] = useState(true); 

  // 菜单配置
  const menuItems: { id: AppView; icon: any; label: string }[] = [
    { id: 'prompts', icon: BookOpen, label: 'Prompt Verse' },
    { id: 'context', icon: FileJson, label: 'Context Forge' },
    { id: 'patch', icon: GitMerge, label: 'Patch Weaver' },
  ];

  return (
    <aside
      className={cn(
        // 核心动画：宽度切换 w-16 (64px) <-> w-64 (256px)
        "bg-slate-950 border-r border-slate-800 flex flex-col relative select-none transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
        isSidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* --- 1. 顶部 Header --- */}
      {/* 布局策略：使用 Grid 或 Flex 保持结构稳定，不切换 justify */}
      <div className="h-14 flex items-center border-b border-slate-800 shrink-0 overflow-hidden">
        
        {/* 左侧：Logo / 标题区域 (固定槽位) */}
        {/* 无论展开折叠，它都占据左侧空间，利用 overflow 裁剪文字 */}
        <div className="h-full flex items-center min-w-[256px] pl-5"> 
          {/* 图标：位置稍微调整以保持视觉平衡 */}
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0 mr-3" />
          
          {/* 文字：丝滑显隐 */}
          <span 
            className={cn(
              "font-bold text-slate-300 tracking-wide text-xs uppercase transition-all duration-300",
              isSidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            )}
          >
            CodeForge
          </span>
          
          {/* 展开/收起按钮：绝对定位在右侧，或者跟随流 */}
          {/* 这里我们用一个技巧：当折叠时，这个按钮会“消失”在可视区域外？ */}
          {/* 不，更好的交互是：折叠时，显示一个特定的按钮覆盖在上面 */}
        </div>

        {/* 专门的切换按钮层：绝对定位，保证不跳动 */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors z-20 h-14 border-l border-transparent",
            // 当折叠时，让按钮变宽占满整个 header，方便点击
            !isSidebarOpen && "w-full right-auto left-0 border-none hover:bg-slate-900"
          )}
          title={isSidebarOpen ? "Collapse" : "Expand"}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* --- 2. 核心导航菜单 --- */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            title={!isSidebarOpen ? item.label : undefined}
            className={cn(
              "relative flex items-center text-sm font-medium transition-all group h-10 w-full",
              // 只有背景色和文字颜色变化，布局属性不变化
              currentView === item.id
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-100"
            )}
          >
            {/* 背景高亮块：绝对定位，宽度跟随 sidebar 变化，或者是固定的小块 */}
            {/* 我们让高亮块铺满整个行，但有 padding */}
            {currentView === item.id && (
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transition-all duration-300", // 左侧指示条
                isSidebarOpen && "w-full opacity-10 border-r border-blue-500/20 left-0 bg-blue-500" // 展开时铺满
              )} />
            )}
            
            {/* 图标槽位 (Icon Dock) - 核心防抖动设计 */}
            {/* 永远固定宽度 w-16 (64px)，永远居中。无论 sidebar 多宽，它不动。 */}
            <div className="w-16 flex items-center justify-center shrink-0 z-10">
              <item.icon size={20} className="transition-transform duration-300 group-hover:scale-110" />
            </div>

            {/* 文字区域 */}
            {/* 在图标槽位右侧。折叠时被父容器 overflow-hidden 切掉 */}
            <span 
              className={cn(
                "whitespace-nowrap transition-all duration-300 z-10 origin-left",
                isSidebarOpen ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-4 scale-90"
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* --- 3. 底部扩展区域 --- */}
      <div className="border-t border-slate-800 shrink-0 flex flex-col overflow-hidden whitespace-nowrap py-2">
        
        {[
          { icon: isDark ? Moon : Sun, label: isDark ? "Dark Mode" : "Light Mode", onClick: () => setIsDark(!isDark) },
          { icon: Globe, label: "English", onClick: () => {} },
          { icon: Settings, label: "Settings", onClick: () => {}, isSettings: true }
        ].map((btn, idx) => (
          <button 
            key={idx}
            onClick={btn.onClick}
            className={cn(
              "relative flex items-center h-10 w-full text-slate-400 hover:text-slate-100 hover:bg-slate-900/50 transition-colors group/btn",
              btn.isSettings && "mt-1"
            )}
            title={!isSidebarOpen ? btn.label : undefined}
          >
            {/* 图标槽位：同样固定 w-16 居中 */}
            <div className="w-16 flex items-center justify-center shrink-0">
               <btn.icon 
                 size={18} 
                 className={cn(
                   "transition-transform duration-500", 
                   btn.isSettings && "group-hover/btn:rotate-90"
                 )} 
               />
            </div>

            {/* 文字：丝滑显隐 */}
            <span className={cn(
              "text-sm transition-all duration-300 origin-left", 
              isSidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            )}>
              {btn.label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}