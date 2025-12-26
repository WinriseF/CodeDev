import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, X, CheckSquare, Square, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

export interface SecretMatch {
  kind: String;
  value: String;
  index: number;
  risk_level: 'High' | 'Medium';
  utf16_index: number;
  line_number: number;
  snippet: string;
  snippet_start_line: number;
}

interface ScanResultDialogProps {
  isOpen: boolean;
  results: SecretMatch[];
  onConfirm: (indicesToRedact: Set<number>) => void;
  onCancel: () => void;
}

export function ScanResultDialog({ isOpen, results, onConfirm, onCancel }: ScanResultDialogProps) {
  const { language } = useAppStore();
  
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && results.length > 0) {
      const allIndices = new Set(results.map(r => r.index));
      setSelectedIndices(allIndices);
    }
  }, [isOpen, results]);

  if (!isOpen) return null;

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setSelectedIndices(newSet);
  };

  const getMaskedValue = (val: String) => {
    const s = val.toString();
    if (s.length <= 8) return '*'.repeat(s.length);
    const visiblePart = s.substring(0, 8);
    const maskedPart = 'X'.repeat(Math.min(s.length - 8, 24)); 
    return `${visiblePart}${maskedPart}${s.length > 32 ? '...' : ''}`;
  };

  const handleConfirm = () => {
    onConfirm(selectedIndices);
  };

  // 渲染代码片段
  const renderSnippet = (snippet: string, value: string, snippetStartLine: number) => {
    const lines = snippet.split('\n');
    const valStr = value.toString();

    return (
      <div className="bg-secondary/30 rounded-md border border-border/50 overflow-hidden text-[11px] font-mono leading-relaxed mt-2 select-text cursor-text" onClick={e => e.stopPropagation()}>
        {lines.map((line, i) => {
          const currentLineNum = snippetStartLine + i;
          const parts = line.split(valStr);
          
          return (
            <div key={i} className="flex min-w-0">
               {/* 行号栏 */}
               <div className="w-10 shrink-0 text-right pr-3 text-muted-foreground/40 select-none border-r border-border/30 bg-secondary/10 text-[10px] font-mono py-0.5">
                  {currentLineNum}
               </div>
               {/* 代码内容 */}
               <div className="pl-3 py-0.5 whitespace-pre break-all flex-1 text-foreground/80">
                  {parts.map((part, idx) => (
                    <span key={idx}>
                      {part}
                      {/* 高亮敏感词 */}
                      {idx < parts.length - 1 && (
                        <span className="bg-red-500/10 text-red-600 rounded px-0.5 border border-red-500/20 font-bold mx-0.5">
                          {valStr}
                        </span>
                      )}
                    </span>
                  ))}
               </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-[700px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-orange-500/5 border-b border-orange-500/10 shrink-0">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                        {getText('context', 'securityAlert', language)}
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 border border-orange-500/20">
                            {getText('context', 'issuesFound', language, { count: results.length.toString() })}
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {getText('context', 'securityMsg', language)}
                    </p>
                </div>
                <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-secondary/5 space-y-3 min-h-0">
            {results.map((item) => {
                const isSelected = selectedIndices.has(item.index);

                return (
                    <div 
                        key={item.index} 
                        className={cn(
                            "border rounded-lg p-3 shadow-sm flex flex-col gap-2 transition-all duration-200 cursor-pointer",
                            isSelected ? "bg-background border-border" : "bg-secondary/30 border-transparent opacity-70 hover:opacity-100"
                        )}
                        onClick={() => toggleSelection(item.index)}
                    >
                        {/* Title Row */}
                        <div className="flex items-center gap-3">
                            <button className={cn("transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}>
                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                            
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <AlertTriangle size={12} className="text-orange-500" />
                                        {item.kind}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                                        Line {item.line_number}
                                    </span>
                                </div>
                            </div>
                            
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-mono uppercase shrink-0",
                                item.risk_level === 'High' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                            )}>
                                {isSelected ? getText('context', 'willRedact', language) : getText('context', 'keepRaw', language)}
                            </span>
                        </div>
                        
                        {/* Snippet View */}
                        <div className="pl-7">
                            {renderSnippet(item.snippet, item.value.toString(), item.snippet_start_line)}
                        </div>
                        
                        {/* Preview changes if selected */}
                        {isSelected && (
                            <div className="pl-7 flex items-center gap-2 mt-1">
                                <ArrowRight size={12} className="text-muted-foreground/30" />
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Becomes:</span>
                                <code className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded border border-green-500/20 font-mono">
                                    {getMaskedValue(item.value)}
                                </code>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-background border-t border-border flex justify-between items-center gap-3 shrink-0">
            <div className="text-xs text-muted-foreground flex gap-1">
                <span dangerouslySetInnerHTML={{
                    __html: getText('context', 'itemsSelected', language, { count: `<strong>${selectedIndices.size}</strong>` })
                }} />
                <span className="opacity-50">|</span>
                <span dangerouslySetInnerHTML={{
                    __html: getText('context', 'itemsIgnored', language, { count: `<strong>${results.length - selectedIndices.size}</strong>` })
                }} />
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => onConfirm(new Set())}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                >
                    {getText('context', 'ignoreAll', language)}
                </button>
                <button 
                    onClick={handleConfirm}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2"
                >
                    <ShieldCheck size={16} />
                    {selectedIndices.size === results.length 
                        ? getText('context', 'redactAll', language) 
                        : getText('context', 'redactSelected', language)}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}