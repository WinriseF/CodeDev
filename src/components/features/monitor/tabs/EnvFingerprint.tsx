import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Terminal, Copy, RefreshCw, Check, Search, 
  Cpu, Globe, Code2, Layers, Database, Box, 
  AppWindow, Wrench, Play, Sparkles
} from 'lucide-react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAppStore } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore'; 
import { getText } from '@/lib/i18n';
import { EnvReport, ToolInfo, AiContextReport } from '@/types/monitor';
import { cn } from '@/lib/utils';

export function EnvFingerprint() {
  const { language } = useAppStore();
  const { projectRoot } = useContextStore(); 
  
  const [data, setData] = useState<EnvReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [copied, setCopied] = useState(false); // 用于普通报告复制
  const [filter, setFilter] = useState('');

  // AI Context 专用状态
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiCopied, setAiCopied] = useState(false); // 用于 AI Context 复制反馈

  const fetchData = async () => {
    setLoading(true);
    setHasScanned(true); 
    try {
      const res = await invoke<EnvReport>('get_env_info', { projectPath: projectRoot });
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 直接生成并复制，不弹窗
  const handleCopyAiContext = async () => {
      if (!projectRoot) return;
      if (isAiLoading || aiCopied) return;

      setIsAiLoading(true);
      try {
          const report = await invoke<AiContextReport>('get_ai_context', { projectPath: projectRoot });
          await writeText(report.markdown);
          
          setAiCopied(true);
          setTimeout(() => setAiCopied(false), 2000);
      } catch (e) {
          console.error("AI Context generation failed", e);
      } finally {
          setIsAiLoading(false);
      }
  };

  // --- 深度过滤逻辑 ---
  const filteredData = useMemo(() => {
    if (!data) return null;
    const q = filter.toLowerCase().trim();
    if (!q) return data;

    const filterTools = (list: ToolInfo[]) => 
      list.filter(t => t.name.toLowerCase().includes(q) || t.version.toLowerCase().includes(q));

    const filterSdks = (sdks: Record<string, string[]>) => {
      const res: Record<string, string[]> = {};
      Object.entries(sdks).forEach(([key, vals]) => {
        if (key.toLowerCase().includes(q) || vals.some(v => v.toLowerCase().includes(q))) {
          res[key] = vals;
        }
      });
      return res;
    };

    return {
      system: data.system,
      binaries: filterTools(data.binaries),
      browsers: filterTools(data.browsers),
      ides: filterTools(data.ides),
      languages: filterTools(data.languages),
      virtualization: filterTools(data.virtualization),
      utilities: filterTools(data.utilities),
      managers: filterTools(data.managers),
      databases: filterTools(data.databases),
      npm_packages: filterTools(data.npm_packages),
      sdks: filterSdks(data.sdks),
    };
  }, [data, filter]);

  // --- 生成 Markdown 报告 ---
  const handleCopyReport = async () => {
    if (!data) return;

    const reportTitle = getText('spotlight', 'envReport', language);
    const generatedBy = getText('spotlight', 'generatedBy', language);
    const systemLabel = getText('monitor', 'envSystem', language);
    const sdkLabel = getText('monitor', 'envSDKs', language);

    let report = `## ${reportTitle}\n${generatedBy} - ${new Date().toLocaleString()}\n\n`;

    if (data.system) {
      report += `### ${systemLabel}\n`;
      Object.entries(data.system).forEach(([k, v]) => report += `- **${k}**: ${v}\n`);
      report += `\n`;
    }

    const printSection = (key: string, list: ToolInfo[]) => {
      const title = getText('monitor', key, language);
      const valid = list.filter(i => i.version !== 'Not Found' && i.version !== 'Not Installed');
      if (valid.length === 0) return;
      report += `### ${title}\n`;
      valid.forEach(i => {
        report += `- ${i.name}: \`${i.version}\`${i.path ? ` - *${i.path}*` : ''}\n`;
      });
      report += `\n`;
    };

    printSection('envBinaries', data.binaries);
    printSection('envLanguages', data.languages);
    printSection('envBrowsers', data.browsers);
    printSection('envIDEs', data.ides);
    printSection('envDatabases', data.databases);
    printSection('envVirtualization', data.virtualization);
    printSection('envUtilities', data.utilities);
    printSection('envManagers', data.managers);
    printSection('envNpmPackages', data.npm_packages);

    if (Object.keys(data.sdks).length > 0) {
        report += `### ${sdkLabel}\n`;
        Object.entries(data.sdks).forEach(([key, vals]) => {
            report += `- **${key}**:\n`;
            vals.forEach(v => report += `  - ${v}\n`);
        });
    }

    await writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- 初始未检测状态 ---
  if (!hasScanned) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary shadow-[0_0_30px_rgba(59,130,246,0.2)]">
           <Wrench size={40} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">{getText('monitor', 'navEnv', language)}</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8 text-sm leading-relaxed">
           {getText('monitor', 'envScanDesc', language)}
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={fetchData}
              className="group relative flex items-center justify-center gap-3 px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all active:scale-95"
            >
              {loading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} className="fill-current" />}
              <span>{getText('monitor', 'envStartScan', language)}</span>
            </button>

            {/* AI Context 快捷入口 */}
            <button
                onClick={handleCopyAiContext}
                disabled={isAiLoading}
                className={cn(
                    "flex items-center justify-center gap-2 px-8 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-full text-sm font-medium transition-all disabled:opacity-50",
                    aiCopied ? "text-green-600 border-green-500/30 bg-green-500/10" : "hover:border-purple-500/30 hover:text-purple-600"
                )}
            >
                {isAiLoading ? <RefreshCw size={16} className="animate-spin" /> : aiCopied ? <Check size={16} /> : <Sparkles size={16} />}
                <span>{aiCopied ? getText('monitor', 'contextCopied', language) : getText('monitor', 'copyAiContext', language)}</span>
            </button>
        </div>
      </div>
    );
  }

  // --- 渲染辅助组件 ---
  const Section = ({ title, icon: Icon, items }: { title: string, icon: any, items: ToolInfo[] }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-border/50 pb-1">
          <Icon size={14} /> {title}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item, idx) => {
             const isFound = item.version !== 'Not Found' && item.version !== 'Not Installed';
             return (
              <div key={`${item.name}-${idx}`} className={cn(
                "border rounded-lg p-3 flex flex-col gap-1 transition-all",
                isFound 
                  ? "bg-card border-border hover:border-primary/30" 
                  : "bg-secondary/10 border-transparent opacity-60"
              )}>
                <div className="flex justify-between items-start">
                   <span className="font-semibold text-sm">{item.name}</span>
                   {isFound && <Check size={12} className="text-green-500 mt-1" />}
                </div>
                <div className={cn("text-xs font-mono truncate", isFound ? "text-muted-foreground" : "text-muted-foreground/40 italic")}>
                   {item.version}
                </div>
                {item.path && <div className="text-[10px] text-muted-foreground/40 truncate mt-1" title={item.path}>{item.path}</div>}
              </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-300">
      
      {/* Toolbar */}
      <div className="flex flex-col gap-4 mb-4 shrink-0">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe size={16} />
                <span>{getText('monitor', 'envFingerprint', language)}</span>
             </div>
             <div className="flex gap-2">
                {/* AI Context 按钮 (Toolbar 版) */}
                <button
                    onClick={handleCopyAiContext}
                    disabled={isAiLoading}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 border",
                        aiCopied
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20"
                    )}
                    title={getText('monitor', 'aiContextTooltip', language)}
                >
                    {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : aiCopied ? <Check size={14} /> : <Sparkles size={14} />}
                    {aiCopied ? getText('monitor', 'contextCopied', language) : getText('monitor', 'copyAiContext', language)}
                </button>

                <div className="w-px h-6 bg-border mx-1" />

                <button 
                    onClick={handleCopyReport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors border border-transparent hover:border-border"
                >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {getText('monitor', 'copyReport', language)}
                </button>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 border border-transparent hover:border-border"
                    title={getText('monitor', 'envRescan', language)}
                >
                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                </button>
             </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input 
                className="w-full bg-secondary/30 border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                placeholder={getText('monitor', 'envToolFilter', language)}
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 pb-10">
         {loading && !filteredData && (
             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                 <RefreshCw size={24} className="animate-spin text-primary" />
                 <span className="text-sm">{getText('monitor', 'envScanning', language)}</span>
             </div>
         )}

         {filteredData && (
            <div className="space-y-6">
                {/* 1. System Info */}
                {filteredData.system && (
                    <div className="bg-gradient-to-br from-secondary/50 to-background border border-border p-4 rounded-xl shadow-sm mb-6">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><Cpu size={14}/> {getText('monitor', 'envSystem', language)}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(filteredData.system).map(([k, v]) => (
                                <div key={k} className="flex flex-col">
                                    <span className="text-[10px] text-muted-foreground uppercase">{k}</span>
                                    <span className="font-mono text-sm font-medium">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Tool Sections */}
                <Section title={getText('monitor', 'envBinaries', language)} icon={Terminal} items={filteredData.binaries} />
                <Section title={getText('monitor', 'envLanguages', language)} icon={Code2} items={filteredData.languages} />
                <Section title={getText('monitor', 'envBrowsers', language)} icon={Globe} items={filteredData.browsers} />
                <Section title={getText('monitor', 'envIDEs', language)} icon={AppWindow} items={filteredData.ides} />
                <Section title={getText('monitor', 'envDatabases', language)} icon={Database} items={filteredData.databases} />
                <Section title={getText('monitor', 'envVirtualization', language)} icon={Layers} items={filteredData.virtualization} />
                <Section title={getText('monitor', 'envNpmPackages', language)} icon={Box} items={filteredData.npm_packages} />
                <Section title={getText('monitor', 'envManagers', language)} icon={Wrench} items={filteredData.managers} />
                <Section title={getText('monitor', 'envUtilities', language)} icon={Terminal} items={filteredData.utilities} />

                {/* 3. SDKs */}
                {Object.keys(filteredData.sdks).length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-border/50 pb-1">
                            <Layers size={14} /> {getText('monitor', 'envSDKs', language)}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(filteredData.sdks).map(([name, versions]) => (
                                <div key={name} className="border border-border bg-card rounded-lg p-3">
                                    <span className="font-semibold text-sm block mb-1">{name}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {versions.map((v, i) => (
                                            <span key={i} className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Empty State for Filter */}
                {Object.keys(filteredData.system || {}).length === 0 && filteredData.binaries.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground opacity-50">
                        {getText('monitor', 'envNoMatches', language)}
                    </div>
                )}
            </div>
         )}
      </div>
    </div>
  );
}