import { useState } from 'react';
import { X, FileText, FileJson, FileCode, FileType, Columns, List, GitMerge } from 'lucide-react';
import { ExportFormat, ExportLayout } from '../patch_types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (format: ExportFormat, layout: ExportLayout) => void;
  count: number;
}

export function ExportDialog({ isOpen, onClose, onConfirm, count }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('Markdown');
  const [layout, setLayout] = useState<ExportLayout>('Split');
  const { language } = useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-[500px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-border bg-secondary/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{getText('export', 'title', language)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
                {getText('export', 'selected', language, { count: count.toString() })}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('export', 'layout', language)}</label>
                <div className="grid grid-cols-3 gap-3">
                    <LayoutOption 
                        active={layout === 'Split'} 
                        onClick={() => setLayout('Split')}
                        icon={Columns}
                        title={getText('export', 'split', language)}
                        desc={getText('export', 'splitDesc', language)}
                    />
                    <LayoutOption 
                        active={layout === 'Unified'} 
                        onClick={() => setLayout('Unified')}
                        icon={List}
                        title={getText('export', 'unified', language)}
                        desc={getText('export', 'unifiedDesc', language)}
                    />
                    <LayoutOption 
                        active={layout === 'GitPatch'} 
                        onClick={() => setLayout('GitPatch')}
                        icon={GitMerge}
                        title={getText('export', 'gitPatch', language)}
                        desc={getText('export', 'gitPatchDesc', language)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{getText('export', 'format', language)}</label>
                <div className="grid grid-cols-2 gap-2">
                    <FormatOption active={format === 'Markdown'} onClick={() => setFormat('Markdown')} icon={FileText} label={getText('export', 'markdown', language)} />
                    <FormatOption active={format === 'Json'} onClick={() => setFormat('Json')} icon={FileJson} label={getText('export', 'json', language)} />
                    <FormatOption active={format === 'Xml'} onClick={() => setFormat('Xml')} icon={FileCode} label={getText('export', 'xml', language)} />
                    <FormatOption active={format === 'Txt'} onClick={() => setFormat('Txt')} icon={FileType} label={getText('export', 'txt', language)} />
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/5 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground transition-colors">{getText('export', 'btnCancel', language)}</button>
            <button 
                onClick={() => onConfirm(format, layout)}
                className="px-6 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
            >
                {getText('export', 'btnExport', language)}
            </button>
        </div>
      </div>
    </div>
  );
}

function FormatOption({ active, onClick, icon: Icon, label }: any) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border transition-all text-xs font-medium",
                active 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background border-border text-foreground hover:border-primary/50"
            )}
        >
            <Icon size={14} /> {label}
        </button>
    )
}

function LayoutOption({ active, onClick, icon: Icon, title, desc }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all h-24 text-center",
                active 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-border bg-secondary/20 hover:border-primary/50 text-muted-foreground hover:text-foreground"
            )}
        >
            <Icon size={20} />
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold">{title}</span>
                <span className="text-[10px] opacity-70 leading-tight">{desc}</span>
            </div>
        </button>
    )
}