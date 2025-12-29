import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Cpu, HardDrive, Zap, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { SystemMetrics, ProcessInfo } from '@/types/monitor';

export function MonitorDashboard() {
  const { language } = useAppStore();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [isLoadingProcs, setIsLoadingProcs] = useState(false);

  // 格式化字节
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    // 1. 快速轮询基础指标 (2s)
    const fetchMetrics = async () => {
      try {
        const data = await invoke<SystemMetrics>('get_system_metrics');
        setMetrics(data);
      } catch (e) {
        console.error(e);
      }
    };

    // 2. 慢速轮询进程列表 (5s)
    const fetchProcesses = async () => {
      // 避免重复请求
      if (isLoadingProcs) return; 
      try {
        const data = await invoke<ProcessInfo[]>('get_top_processes');
        setProcesses(data);
      } catch (e) {
        console.error(e);
      }
    };

    fetchMetrics();
    fetchProcesses();

    const metricTimer = setInterval(fetchMetrics, 2000);
    const procTimer = setInterval(fetchProcesses, 5000);

    return () => {
      clearInterval(metricTimer);
      clearInterval(procTimer);
    };
  }, []);

  return (
    <div className="h-full flex flex-col p-6 gap-6 animate-in fade-in duration-300">
      
      {/* 顶部指标卡片 */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <MetricCard 
          icon={<Cpu className="text-blue-500" />} 
          label={getText('monitor', 'cpu', language)} 
          value={`${metrics?.cpu_usage.toFixed(1) || 0}%`} 
          subValue="Total Load"
          percent={metrics?.cpu_usage || 0}
          color="bg-blue-500"
        />
        <MetricCard 
          icon={<HardDrive className="text-purple-500" />} 
          label={getText('monitor', 'memory', language)} 
          value={metrics ? formatBytes(metrics.memory_used) : '...'} 
          subValue={metrics ? `/ ${formatBytes(metrics.memory_total)}` : ''}
          percent={metrics ? (metrics.memory_used / metrics.memory_total) * 100 : 0}
          color="bg-purple-500"
        />
      </div>

      {/* 进程列表 */}
      <div className="flex-1 flex flex-col min-h-0 bg-secondary/20 rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center bg-secondary/10">
           <h3 className="font-semibold text-sm flex items-center gap-2">
             <Zap size={16} className="text-orange-500" />
             {getText('monitor', 'topProcesses', language)}
           </h3>
           <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
             Auto-refresh (5s)
           </span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <table className="w-full text-left text-xs">
             <thead className="bg-secondary/30 text-muted-foreground font-medium sticky top-0 backdrop-blur-md">
               <tr>
                 <th className="px-4 py-2 w-16">{getText('monitor', 'procPid', language)}</th>
                 <th className="px-4 py-2">{getText('monitor', 'procName', language)}</th>
                 <th className="px-4 py-2 w-20 text-right">{getText('monitor', 'procCpu', language)}</th>
                 <th className="px-4 py-2 w-24 text-right">{getText('monitor', 'procMem', language)}</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-border/30">
               {processes.map((proc) => (
                 <tr key={proc.pid} className="hover:bg-secondary/40 transition-colors">
                   <td className="px-4 py-2 font-mono opacity-70">{proc.pid}</td>
                   <td className="px-4 py-2 font-medium truncate max-w-[200px]" title={proc.name}>{proc.name}</td>
                   <td className="px-4 py-2 text-right font-mono text-blue-500">{proc.cpu_usage.toFixed(1)}%</td>
                   <td className="px-4 py-2 text-right font-mono text-purple-500">{formatBytes(proc.memory)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, subValue, percent, color }: any) {
  return (
    <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex flex-col gap-3">
       <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
             {icon} {label}
          </div>
          <span className="text-lg font-bold tabular-nums">{value}</span>
       </div>
       
       <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-500", color)} 
            style={{ width: `${Math.min(percent, 100)}%` }} 
          />
       </div>
       <div className="text-[10px] text-right text-muted-foreground">{subValue}</div>
    </div>
  )
}