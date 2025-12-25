import { ShieldAlert, AlertTriangle, EyeOff, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';

// 与 Rust 后端 struct 对应
export interface SecretMatch {
  kind: String;
  value: String;
  index: number;
  risk_level: 'High' | 'Medium';
}

interface ScanResultDialogProps {
  isOpen: boolean;
  results: SecretMatch[];
  onConfirm: (strategy: 'redact' | 'raw') => void;
  onCancel: () => void;
}

export function ScanResultDialog({ isOpen, results, onConfirm, onCancel }: ScanResultDialogProps) {
  const { language } = useAppStore();

  if (!isOpen) return null;

  // 简单的脱敏预览逻辑（仅用于展示）
  const getMaskedPreview = (val: String) => {
    const s = val.toString();
    if (s.length <= 8) return '*'.repeat(s.length);
    // 保留前8位，其余替换为 X
    const visiblePart = s.substring(0, 8);
    const maskedPart = 'X'.repeat(Math.min(s.length - 8, 24)); // 限制 X 的最大长度防止溢出
    return `${visiblePart}${maskedPart}${s.length > 32 ? '...' : ''}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-[550px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-orange-500/5 border-b border-orange-500/10">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                        Security Alert
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 border border-orange-500/20">
                            {results.length} Issues Found
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        CodeForge detected potential sensitive information in your selection. 
                        We recommend redacting them before sharing with AI.
                    </p>
                </div>
                <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] p-4 custom-scrollbar bg-secondary/5 space-y-3">
            {results.map((item, idx) => (
                <div key={idx} className="bg-background border border-border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-orange-500" />
                            {item.kind}
                        </span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-mono uppercase",
                            item.risk_level === 'High' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                        )}>
                            {item.risk_level} Risk
                        </span>
                    </div>
                    
                    {/* Preview Box */}
                    <div className="flex items-center gap-3 bg-secondary/30 rounded p-2 border border-border/50">
                        <div className="flex-1 font-mono text-xs text-muted-foreground break-all">
                            {getMaskedPreview(item.value)}
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                            <EyeOff size={12} /> Masked Preview
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-background border-t border-border flex justify-between items-center gap-3">
            <button 
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
                {getText('prompts', 'cancel', language)}
            </button>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => onConfirm('raw')}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                >
                    Ignore Risk (Unsafe)
                </button>
                <button 
                    onClick={() => onConfirm('redact')}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2"
                >
                    <ShieldCheck size={16} />
                    Redact & Copy
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}