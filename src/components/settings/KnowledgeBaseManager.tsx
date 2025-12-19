import { useState } from 'react';
import { 
  Database, FolderPlus, Trash2, RefreshCw, Loader2 
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export function KnowledgeBaseManager() {
    const { knowledgeBases, addKnowledgeBase, removeKnowledgeBase, updateKbIndexTime } = useAppStore();
    const [indexingPath, setIndexingPath] = useState<string | null>(null);

    const handleAddFolder = async () => {
        try {
            const selected = await open({ directory: true, multiple: false });
            if (typeof selected === 'string') {
                addKnowledgeBase(selected);
                // 自动触发一次索引
                handleIndex(selected);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleIndex = async (path: string) => {
        setIndexingPath(path);
        try {
            // 调用后端接口
            // 策略：所有挂载的文件夹统一索引到 'global_kb' 集合中，方便一次性检索
            await invoke('index_project', {
                paths: [path],
                collectionName: "global_kb", 
                modelId: "jina-v3-base-zh"
            });
            updateKbIndexTime(path);
        } catch (e) {
            console.error("Indexing failed:", e);
        } finally {
            setIndexingPath(null);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="mb-4 shrink-0">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Database size={16} className="text-primary"/> 
                    外部知识库管理
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    挂载的文件夹将被统一索引，AI 助手在“知识库模式”下可检索这些内容。
                </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {knowledgeBases.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border border-dashed border-border rounded-lg bg-secondary/5">
                        <p className="text-xs">暂无挂载的知识库</p>
                    </div>
                )}

                {knowledgeBases.map((kb) => (
                    <div key={kb.path} className="group flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all">
                        <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate" title={kb.path}>{kb.name}</span>
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                                    kb.lastIndexed ? "text-muted-foreground bg-secondary" : "text-yellow-600 bg-yellow-500/10"
                                )}>
                                    {kb.lastIndexed ? new Date(kb.lastIndexed).toLocaleDateString() : '未索引'}
                                </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5" title={kb.path}>
                                {kb.path}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleIndex(kb.path)}
                                disabled={indexingPath !== null}
                                className={cn("p-1.5 rounded-md transition-colors", indexingPath === kb.path ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary hover:text-primary")}
                                title="更新索引"
                            >
                                <RefreshCw size={14} className={cn(indexingPath === kb.path && "animate-spin")} />
                            </button>
                            <button
                                onClick={() => removeKnowledgeBase(kb.path)}
                                disabled={indexingPath !== null}
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                title="移除挂载"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border shrink-0">
                <button 
                    onClick={handleAddFolder}
                    disabled={indexingPath !== null}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm active:scale-95 disabled:opacity-70 disabled:scale-100"
                >
                    {indexingPath ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />}
                    {indexingPath ? "正在建立索引..." : "挂载新文件夹"}
                </button>
            </div>
        </div>
    );
}