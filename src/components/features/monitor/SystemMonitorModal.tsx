import { useState, Suspense, lazy } from 'react';
import { X, Activity, Network, Terminal, Settings2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 懒加载子组件
const MonitorDashboard = lazy(() => import('./tabs/MonitorDashboard').then(module => ({ default: module.MonitorDashboard })));
const PortManager = lazy(() => import('./tabs/PortManager').then(module => ({ default: module.PortManager })));
const EnvFingerprint = lazy(() => import('./tabs/EnvFingerprint').then(module => ({ default: module.EnvFingerprint })));
const NetworkDoctor = lazy(() => import('./tabs/NetworkDoctor').then(module => ({ default: module.NetworkDoctor })));

type TabType = 'dashboard' | 'ports' | 'env' | 'network';

export function SystemMonitorModal() {
  const { isMonitorOpen, setMonitorOpen, language } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  if (!isMonitorOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      {/* 
         修复说明：
         1. h-[650px]: 设定一个理想的固定高度，防止加载时内容撑开导致的跳变。
         2. max-h-[90vh]: 强制最大高度不超过视口的 90%，确保在小屏幕下不会溢出，保证右上角的关闭按钮永远在可视区域内。
         3. w-full max-w-[950px]: 保持宽度自适应但有上限。
      */}
      <div className="w-full max-w-[950px] h-[650px] max-h-[90vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-secondary/10 shrink-0 select-none">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            {getText('monitor', 'title', language)}
          </h2>
          <button
            onClick={() => setMonitorOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-48 bg-secondary/5 border-r border-border p-2 space-y-1 overflow-y-auto custom-scrollbar shrink-0 select-none">
            <NavBtn 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<Activity size={16} />} 
              label={getText('monitor', 'navDashboard', language)} 
            />
            <NavBtn 
              active={activeTab === 'ports'} 
              onClick={() => setActiveTab('ports')} 
              icon={<Network size={16} />} 
              label={getText('monitor', 'navPorts', language)} 
            />
            <NavBtn 
              active={activeTab === 'env'} 
              onClick={() => setActiveTab('env')} 
              icon={<Terminal size={16} />} 
              label={getText('monitor', 'navEnv', language)} 
            />
            <NavBtn 
              active={activeTab === 'network'} 
              onClick={() => setActiveTab('network')} 
              icon={<Settings2 size={16} />} 
              label={getText('monitor', 'navNetwork', language)} 
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative bg-background/50">
            <Suspense fallback={<DashboardSkeleton />}>
              {activeTab === 'dashboard' && <MonitorDashboard />}
              {activeTab === 'ports' && <PortManager />}
              {activeTab === 'env' && <EnvFingerprint />}
              {activeTab === 'network' && <NetworkDoctor />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors whitespace-nowrap overflow-hidden text-ellipsis",
        active
          ? "bg-primary/10 text-primary font-medium border border-primary/10"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
      )}
    >
      <div className="shrink-0">{icon}</div> {label}
    </button>
  );
}

// 骨架屏优化：高度填满容器，布局模拟真实的 Dashboard
function DashboardSkeleton() {
  return (
    <div className="h-full flex flex-col p-6 gap-6 animate-in fade-in duration-500">
      
      {/* 顶部指标卡片骨架 */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-card border border-border p-4 rounded-xl shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-secondary rounded animate-pulse" />
                <div className="h-3 w-20 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-secondary rounded animate-pulse" />
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-primary/10 rounded-full animate-pulse" />
            </div>
            <div className="h-2 w-24 bg-secondary rounded ml-auto animate-pulse" />
          </div>
        ))}
      </div>

      {/* 进程列表骨架 - 模拟表格结构 */}
      <div className="flex-1 min-h-0 bg-secondary/20 rounded-xl border border-border overflow-hidden flex flex-col">
        {/* 表头骨架 */}
        <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center bg-secondary/10 shrink-0">
          <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-20 bg-secondary rounded animate-pulse" />
        </div>
        
        {/* 表格内容骨架 */}
        <div className="flex-1 p-2 space-y-1 overflow-hidden">
          {/* 模拟表头行 */}
          <div className="flex gap-4 px-4 py-2 mb-2">
             <div className="h-3 w-16 bg-secondary/50 rounded" />
             <div className="h-3 w-32 bg-secondary/50 rounded" />
             <div className="h-3 w-24 bg-secondary/50 rounded ml-auto" />
          </div>
          {/* 模拟数据行 */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5 rounded-md odd:bg-secondary/10">
              <div className="h-3 w-12 bg-secondary rounded animate-pulse opacity-50" /> {/* PID */}
              <div className="h-3 w-40 bg-secondary rounded animate-pulse" /> {/* Name */}
              <div className="h-3 w-16 bg-secondary rounded animate-pulse hidden sm:block" /> {/* User */}
              <div className="h-3 w-12 bg-secondary rounded animate-pulse ml-auto" /> {/* CPU */}
              <div className="h-3 w-16 bg-secondary rounded animate-pulse" /> {/* Mem */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}