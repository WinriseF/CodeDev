import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Database, FileCode, Loader2, Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, streamChatCompletion } from '@/lib/llm';
import { CodeBlock } from '@/components/ui/CodeBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs'; // 关键：前端文件检测
import { Toast, ToastType } from '@/components/ui/Toast'; // 引入新 Toast

interface SearchResultDto {
    path: string;
    content: string;
    score: number;
}

export function AIContextAgent() {
    const { knowledgeBases, aiConfig, setAIConfig } = useAppStore();
    const { smartSelectFiles, projectRoot } = useContextStore();
    
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [mode, setMode] = useState<'project' | 'kb'>('project');
    const [isLoading, setIsLoading] = useState(false);
    
    // Toast 状态
    const [toast, setToast] = useState<{show: boolean, msg: string, type: ToastType, action?: any, duration?: number}>({
        show: false, msg: '', type: 'info'
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    // 自动滚动
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isLoading]);

    // --- AI 模型切换逻辑 ---
    const cycleProvider = () => {
        const providers: Array<'openai' | 'deepseek' | 'anthropic'> = ['deepseek', 'openai', 'anthropic'];
        const currentIndex = providers.indexOf(aiConfig.providerId);
        const nextIndex = (currentIndex + 1) % providers.length;
        setAIConfig({ providerId: providers[nextIndex] });
    };

    // --- 模型检测与下载逻辑 ---
    const checkAndDownloadModel = async () => {
        try {
            // 检查本地数据目录下的 models/jina-v3-base-zh/model.onnx 是否存在
            // 注意：这里假设后端使用的是默认目录结构
            const modelExists = await exists('models/jina-v3-base-zh/model.onnx', { baseDir: BaseDirectory.AppLocalData });
            
            if (!modelExists) {
                setToast({
                    show: true,
                    type: 'info',
                    msg: 'RAG 功能需要下载嵌入模型 (约 300MB)，是否现在下载？',
                    duration: 0, // 常驻，直到点击
                    action: {
                        label: '立即下载',
                        onClick: async () => {
                            setToast(prev => ({ ...prev, type: 'loading', msg: '正在后台下载模型，请稍候...', action: undefined }));
                            try {
                                // 技巧：调用 search_code 会触发后端的 embedder.init()，
                                // 如果文件不存在，后端会自动开始下载 (阻塞式)。
                                await invoke('search_code', {
                                    query: "init_download",
                                    collectionName: "temp_init",
                                    modelId: "jina-v3-base-zh",
                                    limit: 1,
                                    returnContent: false
                                });
                                setToast({ show: true, msg: '模型下载完成！RAG 功能已就绪。', type: 'success', duration: 3000 });
                            } catch (e) {
                                // 注意：因为后端下载可能会超时或网络波动，这里捕获错误
                                console.error(e);
                                setToast({ show: true, msg: '下载可能超时或失败，请检查网络后重试。', type: 'warning', duration: 5000 });
                            }
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Failed to check model status:", e);
        }
    };

    // 组件挂载时检测一次模型
    useEffect(() => {
        checkAndDownloadModel();
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userQuery = input.trim();
        setInput('');
        setIsLoading(true);

        const newHistory: ChatMessage[] = [...messages, { role: 'user', content: userQuery }];
        setMessages(newHistory);

        try {
            if (mode === 'project') {
                if (!projectRoot) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "请先在左侧加载一个项目目录。" }]);
                    setIsLoading(false);
                    return;
                }

                setMessages(prev => [...prev, { role: 'assistant', content: "正在分析项目代码..." }]);

                // 项目模式检索
                const results = await invoke<SearchResultDto[]>('search_code', {
                    query: userQuery,
                    collectionName: "default_project",
                    modelId: "jina-v3-base-zh",
                    limit: 15,
                    returnContent: false 
                });

                if (results.length > 0) {
                    const paths = results.map(r => r.path);
                    smartSelectFiles(paths, 'add'); 
                    const fileListMd = paths.map(p => `- \`${p.split(/[\\/]/).pop()}\``).join('\n');

                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { 
                            role: 'assistant', 
                            content: `✅ 已为您勾选了 **${paths.length}** 个最相关的文件：\n\n${fileListMd}\n\n您可以在左侧文件树中微调选择。` 
                        };
                        return next;
                    });
                } else {
                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { role: 'assistant', content: "未找到相关代码文件，请尝试构建索引或更换关键词。" };
                        return next;
                    });
                }
                setIsLoading(false);

            } else {
                // 知识库问答模式
                if (knowledgeBases.length === 0) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "请先在 **设置 -> 知识库管理** 中挂载文件夹。" }]);
                    setIsLoading(false);
                    return;
                }

                setMessages(prev => [...prev, { role: 'assistant', content: "" }]); // 占位

                // 1. 检索
                let ragContext = "";
                try {
                    const results = await invoke<SearchResultDto[]>('search_code', {
                        query: userQuery,
                        collectionName: "global_kb",
                        modelId: "jina-v3-base-zh",
                        limit: 3,
                        returnContent: true
                    });
                    if (results.length > 0) {
                        ragContext = results.map(item => `[参考] ${item.path}:\n\`\`\`\n${item.content}\n\`\`\``).join("\n\n");
                    }
                } catch(e) {
                    console.error("RAG Error:", e);
                    // RAG 失败不中断对话，只是没上下文
                }

                // 2. 生成 Prompt
                const systemPrompt = ragContext
                    ? `你是一个专业的编程助手。请基于以下参考资料回答问题：\n\n${ragContext}`
                    : `你是一个专业的编程助手。`;

                const requestMessages: ChatMessage[] = [
                    { role: 'system', content: systemPrompt },
                    ...newHistory.map(m => ({ role: m.role, content: m.content }))
                ];

                // 3. 调用 LLM
                await streamChatCompletion(
                    requestMessages,
                    aiConfig,
                    (contentDelta, reasoningDelta) => {
                        setMessages(current => {
                            const updated = [...current];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg.role === 'assistant') {
                                updated[updated.length - 1] = {
                                    ...lastMsg,
                                    content: lastMsg.content + contentDelta,
                                    reasoning: (lastMsg.reasoning || "") + reasoningDelta
                                };
                            }
                            return updated;
                        });
                    },
                    (err) => {
                        setMessages(current => {
                            const updated = [...current];
                            updated[updated.length - 1].content += `\n\n[API Error]: ${err}`;
                            return updated;
                        });
                    },
                    () => setIsLoading(false)
                );
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${e}` }]);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/50 animate-in fade-in duration-300 relative">
            {/* 顶部工具栏：显示当前模型 + 切换按钮 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                    <Bot size={14} className="text-primary" /> 
                    AI 助手
                </span>
                
                <button 
                    onClick={cycleProvider}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/30 hover:bg-secondary transition-colors border border-transparent hover:border-border/50 group"
                    title={`点击切换模型 (当前: ${aiConfig.providerId})`}
                >
                    <Zap size={12} className={cn(
                        aiConfig.providerId === 'deepseek' ? "text-blue-500" : 
                        aiConfig.providerId === 'openai' ? "text-green-500" : "text-orange-500"
                    )} />
                    <span className="opacity-70 group-hover:opacity-100 uppercase font-mono">{aiConfig.providerId}</span>
                </button>
            </div>

            {/* 消息列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3 pb-10 select-none">
                        <div className="p-4 rounded-full bg-secondary/50 border border-border">
                            <Bot size={32} />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-foreground/80">我是您的代码助手</p>
                            <p className="text-xs">选择下方模式，开始检索代码或询问知识库</p>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm mt-0.5", msg.role === 'user' ? "bg-secondary border-border" : "bg-primary/10 border-primary/20 text-primary")}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={16} />}
                        </div>
                        <div className={cn("rounded-xl px-4 py-2.5 text-sm leading-relaxed shadow-sm max-w-[85%]", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none")}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <div className="markdown-body">
                                    {msg.reasoning && (
                                        <div className="mb-2 pl-2 border-l-2 border-primary/20 text-xs text-muted-foreground/70 font-mono">
                                            {msg.reasoning}
                                        </div>
                                    )}
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({node, inline, className, children, ...props}: any) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                return !inline && match ? ( <CodeBlock language={match[1]} className="text-xs my-2">{String(children).replace(/\n$/, '')}</CodeBlock> ) : ( <code className={cn("bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]", className)} {...props}>{children}</code> )
                                            }
                                        }}
                                    >
                                        {msg.content || (isLoading && i === messages.length -1 ? "..." : "")}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 底部输入区 */}
            <div className="p-4 border-t border-border bg-background z-10">
                <div className="flex gap-2 mb-3">
                    <button 
                        onClick={() => setMode('project')}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shadow-sm", mode === 'project' ? "bg-blue-500/10 text-blue-600 border-blue-500/20 ring-1 ring-blue-500/20" : "bg-background border-border text-muted-foreground hover:bg-secondary")}
                    >
                        <FileCode size={12} /> <span>智能勾选</span>
                    </button>
                    <button 
                        onClick={() => setMode('kb')}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shadow-sm", mode === 'kb' ? "bg-orange-500/10 text-orange-600 border-orange-500/20 ring-1 ring-orange-500/20" : "bg-background border-border text-muted-foreground hover:bg-secondary")}
                    >
                        <Database size={12} /> <span>知识问答</span>
                    </button>
                </div>

                <div className="flex gap-2 relative">
                    <textarea 
                        className="flex-1 bg-secondary/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none resize-none min-h-[50px] max-h-[120px] custom-scrollbar"
                        placeholder={mode === 'project' ? "输入需求，自动勾选代码 (如: 登录验证逻辑)" : "基于挂载的知识库提问 (如: Rust 所有权)"}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={isLoading}
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:scale-95 shadow-lg shadow-primary/20 active:scale-95"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>

            {/* Toast 容器 */}
            <Toast 
                message={toast.msg} 
                type={toast.type} 
                show={toast.show} 
                onDismiss={() => setToast(prev => ({...prev, show: false}))}
                action={toast.action}
                duration={toast.duration}
            />
        </div>
    );
}