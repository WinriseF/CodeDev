import { useState, Suspense, lazy } from 'react';
import { X, Activity, Network, Terminal, Settings2, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 懒加载子组件 (将在下一批次创建)
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
      <div className="w-full max-w-[850px] h-[600px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-secondary/10 shrink-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            {getText('monitor', 'title', language)}
          </h2>
          <button 
            onClick={() => setMonitorOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Sidebar */}
            <div className="w-48 bg-secondary/5 border-r border-border p-2 space-y-1 overflow-y-auto custom-scrollbar shrink-0">
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
                <Suspense fallback={
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <span className="text-sm">Loading module...</span>
                    </div>
                }>
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
    )
}