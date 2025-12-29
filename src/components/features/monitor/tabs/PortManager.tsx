import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Trash2, RefreshCw, Network, Shield, ShieldAlert } from 'lucide-react'; // Removed Globe
import { useAppStore } from '@/store/useAppStore';
import { useConfirmStore } from '@/store/useConfirmStore';
import { getText } from '@/lib/i18n';
import { PortInfo } from '@/types/monitor';
import { cn } from '@/lib/utils';
import { Toast, ToastType } from '@/components/ui/Toast';

export function PortManager() {
  const { language } = useAppStore();
  const confirm = useConfirmStore();
  
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{show: boolean, msg: string, type: ToastType}>({ show: false, msg: '', type: 'success' });

  const fetchPorts = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<PortInfo[]>('get_active_ports');
      // 默认按端口号排序
      setPorts(data.sort((a, b) => a.port - b.port));
    } catch (e) {
      console.error(e);
      setToast({ show: true, msg: "Failed to scan ports", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  const filteredPorts = useMemo(() => {
    const q = search.toLowerCase();
    return ports.filter(p => 
      p.port.toString().includes(q) || 
      p.process_name.toLowerCase().includes(q) ||
      p.pid.toString().includes(q) ||
      (p.local_addr && p.local_addr.includes(q))
    );
  }, [ports, search]);

  const handleKill = async (portInfo: PortInfo) => {
    if (portInfo.is_system) {
        setToast({ show: true, msg: "Cannot kill system process.", type: 'warning' });
        return;
    }

    const confirmed = await confirm.ask({
        title: getText('monitor', 'confirmKill', language),
        message: getText('monitor', 'killMsg', language, { name: portInfo.process_name, pid: portInfo.pid.toString() }),
        type: 'danger',
        confirmText: getText('monitor', 'kill', language),
        cancelText: getText('prompts', 'cancel', language)
    });

    if (!confirmed) return;

    try {
        await invoke('kill_process', { pid: portInfo.pid });
        setToast({ show: true, msg: getText('monitor', 'killSuccess', language), type: 'success' });
        setTimeout(fetchPorts, 800); 
    } catch (err: any) {
        setToast({ show: true, msg: `Error: ${err}`, type: 'error' });
    }
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-300">
        {/* Search Bar */}
        <div className="flex gap-3 mb-4 shrink-0">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input 
                    className="w-full bg-secondary/30 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                    placeholder={getText('monitor', 'searchPorts', language)}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />
            </div>
            <button 
                onClick={fetchPorts} 
                disabled={isLoading}
                className="px-4 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
                <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
                {getText('monitor', 'refresh', language)}
            </button>
        </div>

        {/* List */}
        <div className="flex-1 border border-border rounded-xl bg-background overflow-hidden flex flex-col shadow-sm">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-secondary/30 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">{getText('monitor', 'port', language)}</div>
                <div className="col-span-1">{getText('monitor', 'proto', language)}</div>
                <div className="col-span-3">{getText('monitor', 'localAddr', language)}</div>
                <div className="col-span-2">{getText('monitor', 'procPid', language)}</div>
                <div className="col-span-3">{getText('monitor', 'procName', language)}</div>
                <div className="col-span-1 text-right">Action</div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1">
                {filteredPorts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 gap-2">
                        <Network size={32} />
                        <p className="text-sm">{getText('monitor', 'emptyPorts', language)}</p>
                    </div>
                ) : (
                    filteredPorts.map((p) => (
                        <div key={`${p.port}-${p.protocol}-${p.pid}`} className={cn("grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-secondary/40 rounded-lg transition-colors text-sm group", p.is_system && "opacity-80 bg-secondary/10")}>
                            <div className="col-span-2 font-mono text-primary font-bold flex items-center gap-1.5">
                                {p.port}
                                {p.is_system && (
                                    <div title="System Port">
                                        <Shield size={12} className="text-green-500" />
                                    </div>
                                )}
                            </div>
                            <div className="col-span-1 text-muted-foreground text-xs font-mono">{p.protocol}</div>
                            <div className="col-span-3 text-muted-foreground text-xs font-mono truncate" title={p.local_addr}>
                                {p.local_addr || '0.0.0.0'}
                            </div>
                            <div className="col-span-2 font-mono text-muted-foreground">{p.pid}</div>
                            <div className="col-span-3 font-medium truncate flex items-center gap-1.5" title={p.process_name}>
                                {p.process_name}
                            </div>
                            <div className="col-span-1 text-right">
                                {p.is_system ? (
                                    <div className="flex justify-end text-muted-foreground/30 cursor-not-allowed" title="System Process Protected">
                                        <ShieldAlert size={14} />
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleKill(p)}
                                        className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                        title={getText('monitor', 'kill', language)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        <Toast show={toast.show} message={toast.msg} type={toast.type} onDismiss={() => setToast(prev => ({...prev, show: false}))} />
    </div>
  );
}