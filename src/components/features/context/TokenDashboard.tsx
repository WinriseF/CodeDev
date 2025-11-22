import { CheckCircle2, AlertCircle, FileText, Database, Cpu, Save } from 'lucide-react'; // 引入 Save 图标
import { ContextStats } from '@/lib/context_assembler';
import { cn } from '@/lib/utils';

interface TokenDashboardProps {
  stats: ContextStats;
  onCopy: () => void;
  onSave: () => void; // ✨ 新增回调
  isGenerating: boolean;
}

// 常用模型上下文上限参考
const CONTEXT_LIMITS = [
  { name: 'GPT-4 (8k)', limit: 8192 },
  { name: 'Claude 3.5 (200k)', limit: 200000 },
];

export function TokenDashboard({ stats, onCopy, onSave, isGenerating }: TokenDashboardProps) {
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full max-w-2xl w-full mx-auto p-6 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. 核心数字看板 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard 
          icon={<FileText className="text-blue-500" />}
          label="Selected Files"
          value={stats.fileCount}
        />
        <StatCard 
          icon={<Database className="text-purple-500" />}
          label="Total Size"
          value={formatSize(stats.totalSize)}
        />
        <StatCard 
          icon={<Cpu className="text-orange-500" />}
          label="Est. Tokens"
          value={stats.estimatedTokens.toLocaleString()}
          highlight
        />
      </div>

      {/* 2. 容量消耗进度条 */}
      <div className="space-y-4 bg-secondary/30 p-5 rounded-xl border border-border/50">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Context Window Usage</h3>
        {CONTEXT_LIMITS.map(model => {
          const percent = Math.min(100, (stats.estimatedTokens / model.limit) * 100);
          const isOver = stats.estimatedTokens > model.limit;
          return (
            <div key={model.name} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{model.name}</span>
                <span className={cn(isOver ? "text-destructive" : "text-muted-foreground")}>
                  {percent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500 ease-out rounded-full",
                    isOver ? "bg-destructive" : (percent > 80 ? "bg-yellow-500" : "bg-primary")
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 操作区 */}
      <div className="flex flex-col items-center gap-4 mt-auto mb-10">
        {stats.fileCount === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-full text-sm">
            <AlertCircle size={16} /> Select files from the left tree
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full justify-center">
            {/* 复制按钮 */}
            <button
              onClick={onCopy}
              disabled={isGenerating}
              className={cn(
                "group relative inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold text-primary-foreground transition-all duration-200 bg-primary rounded-full shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 min-w-[200px]",
                isGenerating && "cursor-wait"
              )}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>

            {/* 保存按钮 */}
            <button
              onClick={onSave}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-foreground bg-secondary/80 border border-border rounded-full hover:bg-secondary hover:border-primary/30 transition-all active:scale-95 disabled:opacity-50"
              title="Save context as file"
            >
              <Save size={20} />
              <span>Save...</span>
            </button>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Generates formatted context from {stats.fileCount} files.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: any) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all hover:shadow-md hover:border-primary/20",
      highlight && "bg-primary/5 border-primary/20 ring-1 ring-primary/10"
    )}>
      <div className="p-2 bg-background rounded-full shadow-sm border border-border/50">
        {icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-xl font-bold tracking-tight text-foreground truncate w-full px-2" title={String(value)}>
            {value}
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase">{label}</div>
      </div>
    </div>
  );
}