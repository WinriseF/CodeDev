import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Globe, RefreshCw, Signal, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { NetDiagResult } from '@/types/monitor';
import { cn } from '@/lib/utils';

export function NetworkDoctor() {
  const { language } = useAppStore();
  const [results, setResults] = useState<NetDiagResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnosis = async () => {
    setLoading(true);
    // 先清空状态，给用户重新加载的感觉
    setResults([]); 
    try {
      const res = await invoke<NetDiagResult[]>('diagnose_network');
      setResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnosis();
  }, []);

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-300">
      
      <div className="flex justify-between items-center mb-6 shrink-0 bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
         <div className="flex gap-3 items-center">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Globe size={20} />
            </div>
            <div>
                <h3 className="font-semibold text-sm">{getText('monitor', 'navNetwork', language)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 opacity-80">HTTP HEAD Latency Test</p>
            </div>
         </div>
         <button 
            onClick={runDiagnosis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border shadow-sm hover:bg-secondary rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
         >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            {loading ? getText('monitor', 'diagnosing', language) : getText('monitor', 'diagnose', language)}
         </button>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
         <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-secondary/30 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
             <div className="col-span-5">{getText('monitor', 'netTarget', language)}</div>
             <div className="col-span-3">{getText('monitor', 'netStatus', language)}</div>
             <div className="col-span-2 text-right">{getText('monitor', 'netLatency', language)}</div>
             <div className="col-span-2 text-right">{getText('monitor', 'netCode', language)}</div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
             {loading && results.length === 0 && (
                 <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">
                     Ping...
                 </div>
             )}
             
             {results.map((item) => {
                 let statusColor = "text-green-500";
                 let statusIcon = <CheckCircle2 size={16} />;
                 let statusText = getText('monitor', 'statusSuccess', language);

                 if (item.status === 'Fail' || item.status_code >= 400) {
                     statusColor = "text-destructive";
                     statusIcon = <XCircle size={16} />;
                     statusText = getText('monitor', 'statusFail', language);
                 } else if (item.status === 'Slow') {
                     statusColor = "text-yellow-500";
                     statusIcon = <AlertTriangle size={16} />;
                     statusText = getText('monitor', 'statusSlow', language);
                 }

                 return (
                     <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-secondary/40 rounded-lg transition-colors text-sm">
                         <div className="col-span-5 flex flex-col min-w-0">
                             <span className="font-medium text-foreground truncate">{item.name}</span>
                             <span className="text-[10px] text-muted-foreground truncate opacity-60 font-mono">{item.url}</span>
                         </div>
                         <div className="col-span-3 flex items-center gap-2">
                             <span className={cn(statusColor)}>{statusIcon}</span>
                             <span className={cn("text-xs font-medium", statusColor)}>{statusText}</span>
                         </div>
                         <div className="col-span-2 text-right font-mono flex items-center justify-end gap-1 text-muted-foreground">
                             {item.latency > 0 ? (
                                <>
                                    <Signal size={12} className={item.latency < 200 ? "text-green-500" : "text-yellow-500"} />
                                    {item.latency}ms
                                </>
                             ) : "-"}
                         </div>
                         <div className="col-span-2 text-right font-mono opacity-70">
                             {item.status_code || "-"}
                         </div>
                     </div>
                 )
             })}
         </div>
      </div>
    </div>
  );
}