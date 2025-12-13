import { AlertTriangle, Info, XCircle, Check } from 'lucide-react';
import { useConfirmStore } from '@/store/useConfirmStore';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { getText } from '@/lib/i18n';

export function GlobalConfirmDialog() {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();
  const { language } = useAppStore();
  
  // 防止不渲染
  if (!isOpen) return null;

  const isDanger = options.type === 'danger';
  const isWarning = options.type === 'warning';

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div 
        className="w-full max-w-[450px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4">
            <div className="flex items-start gap-4">
                <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    isDanger ? "bg-red-500/10 text-red-500" : 
                    isWarning ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-blue-500/10 text-blue-500"
                )}>
                    {isDanger ? <XCircle size={24} /> : 
                     isWarning ? <AlertTriangle size={24} /> : 
                     <Info size={24} />}
                </div>
                <div>
                    <h3 className="font-semibold text-lg text-foreground">
                        {options.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                        {options.message}
                    </p>
                </div>
            </div>
            
            {/* 装饰性背景 */}
            {isDanger && (
                <div className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-500/80">
                    {getText('common', 'highRiskWarning', language)}
                </div>
            )}
        </div>

        <div className="p-4 bg-secondary/5 border-t border-border flex justify-end gap-3">
            <button 
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
                {options.cancelText}
            </button>
            <button 
                onClick={handleConfirm}
                className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors",
                    isDanger 
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
            >
                {isDanger || isWarning ? <AlertTriangle size={16} /> : <Check size={16} />}
                {options.confirmText}
            </button>
        </div>
      </div>
    </div>
  );
}