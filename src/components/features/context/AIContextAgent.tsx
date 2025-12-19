import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Database, FileCode, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, streamChatCompletion } from '@/lib/llm';
import { CodeBlock } from '@/components/ui/CodeBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 定义后端返回的数据结构
interface SearchResultDto {
    path: string;
    content: string;
    score: number;
}

export function AIContextAgent() {
    const { knowledgeBases, aiConfig } = useAppStore();
    const { smartSelectFiles, projectRoot } = useContextStore();
    
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [mode, setMode] = useState<'project' | 'kb'>('project'); // 默认为项目操作模式
    const [isLoading, setIsLoading] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userQuery = input.trim();
        setInput('');
        setIsLoading(true);

        // 1. 添加用户消息
        const newHistory: ChatMessage[] = [...messages, { role: 'user', content: userQuery }];
        setMessages(newHistory);

        try {
            if (mode === 'project') {
                // --- 模式 A: 项目代码智能勾选 ---
                if (!projectRoot) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "请先在左侧加载一个项目目录。" }]);
                    setIsLoading(false);
                    return;
                }

                // 添加一个临时的“思考中”消息
                setMessages(prev => [...prev, { role: 'assistant', content: "正在分析项目代码..." }]);

                // 调用后端检索 (无需内容，只需路径)
                const results = await invoke<SearchResultDto[]>('search_code', {
                    query: userQuery,
                    collectionName: "default_project",
                    modelId: "jina-v3-base-zh",
                    limit: 15, // 检索最相关的 15 个文件
                    returnContent: false 
                });

                if (results.length > 0) {
                    const paths = results.map(r => r.path);
                    
                    // 执行 Store 动作：自动勾选
                    smartSelectFiles(paths, 'add'); 

                    // 更新最后一条消息为结果
                    const fileListMd = paths.map(p => {
                        // 简化的相对路径显示逻辑
                        const name = p.split(/[\\/]/).pop();
                        return `- \`${name}\` (${p.slice(-40)})`;
                    }).join('\n');

                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { 
                            role: 'assistant', 
                            content: `✅ 已为您勾选了 **${paths.length}** 个最相关的文件：\n\n${fileListMd}\n\n您可以在左侧文件树中微调选择，然后切换到“预览”或“仪表盘”进行操作。` 
                        };
                        return next;
                    });
                } else {
                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { role: 'assistant', content: "未在当前项目中找到与描述相关的代码文件。请尝试更换关键词，或者确保已构建索引。" };
                        return next;
                    });
                }
                setIsLoading(false);

            } else {
                // --- 模式 B: 知识库问答 (RAG) ---
                if (knowledgeBases.length === 0) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "您尚未挂载任何外部知识库。\n请前往 **设置 -> 知识库管理** 添加文件夹。" }]);
                    setIsLoading(false);
                    return;
                }

                // 添加一个空的 AI 消息用于流式输出
                setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

                // 1. 检索知识库 (统一集合 global_kb)
                const results = await invoke<SearchResultDto[]>('search_code', {
                    query: userQuery,
                    collectionName: "global_kb",
                    modelId: "jina-v3-base-zh",
                    limit: 4,
                    returnContent: true // 需要内容
                });

                // 2. 构造 Prompt
                let ragContext = "";
                if (results.length > 0) {
                    ragContext = results.map(item => `[参考资料] ${item.path}:\n\`\`\`\n${item.content}\n\`\`\``).join("\n\n");
                }

                const systemPrompt = ragContext
                    ? `你是一个专业的编程助手。请基于以下参考资料回答用户问题。如果参考资料不足，请利用你的通用知识补充，但需明确指出。\n\n${ragContext}`
                    : `你是一个专业的编程助手。`;

                const requestMessages: ChatMessage[] = [
                    { role: 'system', content: systemPrompt },
                    ...newHistory.map(m => ({ role: m.role, content: m.content }))
                ];

                // 3. 流式调用 LLM
                await streamChatCompletion(
                    requestMessages,
                    aiConfig,
                    (contentDelta, _) => {
                        setMessages(current => {
                            const updated = [...current];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg.role === 'assistant') {
                                updated[updated.length - 1] = {
                                    ...lastMsg,
                                    content: lastMsg.content + contentDelta
                                };
                            }
                            return updated;
                        });
                    },
                    (err) => {
                        setMessages(current => {
                            const updated = [...current];
                            updated[updated.length - 1].content += `\n\n[错误]: ${err}`;
                            return updated;
                        });
                    },
                    () => setIsLoading(false)
                );
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'assistant', content: `操作失败: ${e}` }]);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/50 animate-in fade-in duration-300">
            {/* 顶部提示栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Bot size={12} /> AI 智能助手
                </span>
                <span className="opacity-60">{aiConfig.providerId} / {aiConfig.modelId}</span>
            </div>

            {/* 消息列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3 pb-10">
                        <div className="p-4 rounded-full bg-secondary/50 border border-border">
                            <Bot size={32} />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-foreground/80">我是您的代码助手</p>
                            <p className="text-xs">我可以帮您筛选代码文件，或者基于知识库回答问题。</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4 max-w-sm w-full">
                            <button onClick={() => { setMode('project'); setInput("找出所有鉴权相关的逻辑"); }} className="p-2 text-xs border border-dashed border-border rounded hover:bg-secondary/50 transition-colors text-left">
                                "找出所有鉴权相关的逻辑"
                            </button>
                            <button onClick={() => { setMode('kb'); setInput("React Hooks 的最佳实践是什么？"); }} className="p-2 text-xs border border-dashed border-border rounded hover:bg-secondary/50 transition-colors text-left">
                                "React Hooks 最佳实践？"
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm mt-0.5", msg.role === 'user' ? "bg-secondary border-border" : "bg-primary/10 border-primary/20 text-primary")}>
                            {msg.role === 'user' ? <div className="text-[10px] font-bold">You</div> : <Bot size={16} />}
                        </div>
                        <div className={cn("rounded-xl px-4 py-2.5 text-sm leading-relaxed shadow-sm max-w-[85%]", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none")}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <div className="markdown-body">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({node, inline, className, children, ...props}: any) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                return !inline && match ? ( <CodeBlock language={match[1]} className="text-xs my-2">{String(children).replace(/\n$/, '')}</CodeBlock> ) : ( <code className={cn("bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]", className)} {...props}>{children}</code> )
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length-1]?.role === 'user' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-12 animate-pulse">
                        <Loader2 size={12} className="animate-spin" /> 正在思考...
                    </div>
                )}
            </div>

            {/* 底部输入区 */}
            <div className="p-4 border-t border-border bg-background z-10">
                <div className="flex gap-2 mb-3">
                    {/* 模式切换 Pill */}
                    <button 
                        onClick={() => setMode('project')}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shadow-sm", mode === 'project' ? "bg-blue-500/10 text-blue-600 border-blue-500/20 ring-1 ring-blue-500/20" : "bg-background border-border text-muted-foreground hover:bg-secondary")}
                    >
                        <FileCode size={12} /> 
                        <span>智能勾选 (当前项目)</span>
                    </button>
                    <button 
                        onClick={() => setMode('kb')}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shadow-sm", mode === 'kb' ? "bg-orange-500/10 text-orange-600 border-orange-500/20 ring-1 ring-orange-500/20" : "bg-background border-border text-muted-foreground hover:bg-secondary")}
                    >
                        <Database size={12} /> 
                        <span>知识问答 (外部挂载)</span>
                    </button>
                </div>

                <div className="flex gap-2 relative">
                    <textarea 
                        className="flex-1 bg-secondary/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none resize-none min-h-[50px] max-h-[120px] custom-scrollbar"
                        placeholder={mode === 'project' ? "描述你要找的功能模块，例如：'用户登录校验逻辑'..." : "询问知识库，例如：'Rust 的所有权机制是怎样的？'..."}
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
                <div className="text-[10px] text-muted-foreground/50 text-center mt-2">
                    {mode === 'project' ? "AI 将根据语义自动勾选左侧文件树" : "AI 将参考已挂载的知识库目录回答问题"}
                </div>
            </div>
        </div>
    );
}