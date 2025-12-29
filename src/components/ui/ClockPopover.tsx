import { useState, useEffect, useRef } from 'react';
import { Clock, Copy, Check, Monitor, Cpu, HardDrive, Activity, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { getText } from '@/lib/i18n';

interface SystemInfo {
  cpu_usage: number;           
  memory_usage: number;        
  memory_total: number;        
  memory_available: number;    
  uptime: number;              
}

interface ClockPopoverProps {
  currentTime: Date;
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLDivElement>;
}

export function ClockPopover({ currentTime, isOpen, onClose, triggerRef }: ClockPopoverProps) {
  const { language, setMonitorOpen } = useAppStore(); // ✨ 获取 setMonitorOpen
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSystemInfo = async () => {
      try {
        const info = await invoke<SystemInfo>('get_system_info');
        setSystemInfo(info);
      } catch (err) {
        console.error('Failed to fetch system info:', err);
        setSystemInfo({ cpu_usage: 0, memory_usage: 0, memory_total: 0, memory_available: 0, uptime: 0 });
      }
    };

    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 2000); 

    return () => clearInterval(interval);
  }, [isOpen]);

  // 点击外部关闭逻辑
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

  const formatTime = (date: Date, includeSeconds = false) => {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false
    }).format(date);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return language === 'zh' ? `${days}天 ${hours}小时` : `${days}d ${hours}h`;
    if (hours > 0) return language === 'zh' ? `${hours}小时 ${minutes}分钟` : `${hours}h ${minutes}m`;
    return language === 'zh' ? `${minutes}分钟` : `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleCopy = async (type: 'timestamp' | 'iso' | 'full') => {
    try {
      let text = '';
      switch (type) {
        case 'timestamp': text = currentTime.getTime().toString(); break;
        case 'iso': text = currentTime.toISOString(); break;
        case 'full': text = formatTime(currentTime, true); break;
      }
      await writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) { console.error(err); }
  };

  // 打开监控面板的处理函数
  const handleOpenMonitor = () => {
      setMonitorOpen(true);
      onClose(); // 关闭当前 Popover
  };

  if (!isOpen) return null;

  const fullTime = formatTime(currentTime, true);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long' }).format(currentTime);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={popoverRef}
        className="absolute top-full left-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-left overflow-hidden flex flex-col"
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock size={14} className="text-primary/70" />
              <span>{getText('clock', 'timeDetails', language)}</span>
            </div>
            <div className="space-y-1.5 pl-6 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{getText('clock', 'fullTime', language)}:</span>
                <span className="font-mono text-foreground">{fullTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{getText('clock', 'weekday', language)}:</span>
                <span className="text-foreground">{weekday}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{getText('clock', 'timezone', language)}:</span>
                <span className="font-mono text-foreground text-[10px]">{timezone}</span>
              </div>
            </div>
          </div>

          {systemInfo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Monitor size={14} className="text-primary/70" />
                <span>{getText('clock', 'systemInfo', language)}</span>
              </div>
              <div className="space-y-1.5 pl-6 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Cpu size={12} /> {getText('clock', 'cpuUsage', language)}:</span>
                  <span className="font-mono text-foreground">{systemInfo.cpu_usage >= 0 ? `${systemInfo.cpu_usage.toFixed(1)}%` : 'N/A'}</span>
                </div>
                {systemInfo.memory_total > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><HardDrive size={12} /> {getText('clock', 'memory', language)}:</span>
                    <span className="font-mono text-foreground">
                      {formatBytes(systemInfo.memory_usage)} / {formatBytes(systemInfo.memory_total)}
                    </span>
                  </div>
                )}
                {systemInfo.uptime > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Activity size={12} /> {getText('clock', 'systemUptime', language)}:</span>
                    <span className="font-mono text-foreground">{formatUptime(systemInfo.uptime)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="text-sm font-semibold text-foreground">{getText('clock', 'quickActions', language)}</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleCopy('timestamp')} className={cn("flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-colors", copiedType === 'timestamp' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-secondary/50 hover:bg-secondary text-foreground border border-border/50")}>
                {copiedType === 'timestamp' ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[10px]">{getText('clock', 'copyTimestamp', language)}</span>
              </button>
              <button onClick={() => handleCopy('iso')} className={cn("flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-colors", copiedType === 'iso' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-secondary/50 hover:bg-secondary text-foreground border border-border/50")}>
                {copiedType === 'iso' ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[10px]">{getText('clock', 'copyISO', language)}</span>
              </button>
              <button onClick={() => handleCopy('full')} className={cn("flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-colors", copiedType === 'full' ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-secondary/50 hover:bg-secondary text-foreground border border-border/50")}>
                {copiedType === 'full' ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[10px]">{getText('clock', 'copyFull', language)}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 bg-secondary/30 border-t border-border mt-auto">
            <button 
                onClick={handleOpenMonitor}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors group"
            >
                <Activity size={14} />
                <span>{getText('monitor', 'title', language)}</span>
                <ExternalLink size={12} className="opacity-50 group-hover:opacity-100 transition-opacity ml-auto mr-1" />
            </button>
        </div>
      </div>
    </>
  );
}