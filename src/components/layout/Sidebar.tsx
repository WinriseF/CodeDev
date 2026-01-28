import { motion } from "framer-motion";
import { BookOpen, FileJson, GitMerge, Settings, ChevronLeft, ChevronRight, FileText, Files } from 'lucide-react';
import { useAppStore, AppView } from '@/store/useAppStore';
import { getMenuLabel, getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const {
    currentView, setView,
    isSidebarOpen, toggleSidebar,
    language, setSettingsOpen
  } = useAppStore();

  const menuItems: { id: AppView; icon: any }[] = [
    { id: 'prompts', icon: BookOpen },
    { id: 'context', icon: FileJson },
    { id: 'patch', icon: GitMerge },
    { id: 'memos', icon: FileText },
    { id: 'files', icon: Files },
  ];

  return (
    <aside
      className={cn(
        "bg-background border-r border-border flex flex-col relative select-none transition-[width] duration-300 ease-in-out overflow-hidden",
        isSidebarOpen ? "w-48" : "w-16"
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center border-b border-border shrink-0 overflow-hidden">
        <div className="h-full flex items-center min-w-[256px] pl-5"> 
          <div className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0 mr-3 transition-all duration-300",
              "bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 animate-gradient-dot",
              isSidebarOpen ? "opacity-100 scale-100" : "opacity-0 scale-0"
            )} 
          />
          <span className={cn(
              "font-bold text-foreground tracking-wide text-xs uppercase transition-all duration-300",
              isSidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            )}
          >
            CtxRun
          </span>
        </div>

        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-20 h-14 border-l border-transparent",
            !isSidebarOpen && "w-full right-auto left-0 border-none hover:bg-secondary"
          )}
          title={isSidebarOpen ? getText('actions', 'collapse', language) : getText('actions', 'expand', language)}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            title={!isSidebarOpen ? getMenuLabel(item.id, language) : undefined}
            className={cn(
              "relative flex items-center text-sm font-medium transition-all group h-10 w-full",
              currentView === item.id
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {currentView === item.id && (
              <motion.div
                layoutId="sidebar-indicator"
                className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
            <div className="w-16 flex items-center justify-center shrink-0 z-10">
              <item.icon size={20} className="transition-transform duration-300 group-hover:scale-110" />
            </div>
            <span className={cn(
                "whitespace-nowrap transition-all duration-300 z-10 origin-left",
                isSidebarOpen ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-4 scale-90"
              )}
            >
              {getMenuLabel(item.id, language)}
            </span>
          </button>
        ))}
      </nav>

      {/* Footer - 只有设置按钮 */}
      <div className="border-t border-border shrink-0 flex flex-col overflow-hidden whitespace-nowrap py-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            "relative flex items-center h-10 w-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors group/btn"
          )}
          title={!isSidebarOpen ? getText('menu', 'settings', language) : undefined}
        >
          <div className="w-16 flex items-center justify-center shrink-0">
             <Settings 
               size={18} 
               className="transition-transform duration-500 group-hover/btn:rotate-90" 
             />
          </div>
          <span className={cn(
            "text-sm transition-all duration-300 origin-left", 
            isSidebarOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
          )}>
            {getText('menu', 'settings', language)}
          </span>
        </button>
      </div>
    </aside>
  );
}