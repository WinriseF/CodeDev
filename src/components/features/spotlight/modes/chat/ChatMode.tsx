import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, User, Bot, Brain, ChevronDown, Check, Copy, FileText, Code } from 'lucide-react';
import { cn, stripMarkdown } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { ChatMessage } from '@/lib/llm';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

// --- 内部组件: 复制菜单 ---
function MessageCopyMenu({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { language } = useAppStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCopy = async (type: 'text' | 'markdown') => {
    try {
      const textToCopy = type === 'text' ? stripMarkdown(content) : content;
      await writeText(textToCopy);
      setIsCopied(true);
      setIsOpen(false);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="absolute top-2 left-[100%] ml-2 opacity-0 group-hover:opacity-100 transition-opacity z-20" ref={menuRef}>
       <button
         onClick={() => setIsOpen(!isOpen)}
         className={cn(
            "p-1.5 rounded-md bg-secondary/80 hover:bg-background border border-border/50 shadow-sm backdrop-blur-sm transition-colors",
            isCopied ? "text-green-500 border-green-500/20 bg-green-500/10" : "text-muted-foreground hover:text-foreground"
         )}
         title={getText('spotlight', 'copyMessage', language)}
       >
         {isCopied ? <Check size={14} /> : <Copy size={14} />}
       </button>

       {isOpen && (
         <div className="absolute right-0 top-full mt-1 w-36 bg-popover border border-border rounded-md shadow-lg py-1 flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top-right z-30">
            <button onClick={() => handleCopy('text')} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-left w-full transition-colors text-foreground">
              <FileText size={12} className="text-muted-foreground" /> <span>Copy as Text</span>
            </button>
            <button onClick={() => handleCopy('markdown')} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary text-left w-full transition-colors text-foreground">
              <Code size={12} className="text-muted-foreground" /> <span>Copy Markdown</span>
            </button>
         </div>
       )}
    </div>
  );
}

interface ChatModeProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMode({ messages, isStreaming, chatEndRef }: ChatModeProps) {
  const { language, aiConfig } = useAppStore();

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-start text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 pt-10">
        <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] animate-pulse">
          <Sparkles size={24} />
        </div>
        <h3 className="text-foreground font-medium mb-1">{getText('spotlight', 'aiReady', language)}</h3>
        <p className="text-xs text-center max-w-[200px] opacity-70 leading-relaxed">
          {getText('spotlight', 'aiDesc', language)} <span className="text-purple-500 font-medium">{aiConfig.providerId}</span>.
        </p>
        <div className="mt-8 text-[10px] opacity-40 font-mono bg-background/50 border border-border/50 px-2 py-1 rounded">
          {getText('spotlight', 'ephemeral', language)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
      <style>{`
        .markdown-body p { margin-bottom: 0.5em; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body pre { margin: 0.5em 0; }
        .markdown-body code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
        /* 针对思考过程的微调样式 */
        .reasoning-body p { margin-bottom: 0.4em; }
        .reasoning-body pre { background: rgba(0,0,0,0.1); padding: 0.5em; border-radius: 4px; overflow-x: auto; }
      `}</style>
      
      {messages.map((msg, idx) => (
        <div key={idx} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm", msg.role === 'user' ? "bg-secondary/80 border-border text-foreground" : "bg-purple-500/10 border-purple-500/20 text-purple-500")}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm border relative", msg.role === 'user' ? "bg-primary text-primary-foreground border-primary/50 rounded-tr-sm" : "bg-secondary/50 border-border/50 text-foreground rounded-tl-sm markdown-body", "select-text cursor-text")}>
            {msg.role === 'assistant' && !isStreaming && ( <MessageCopyMenu content={msg.content} /> )}
            {msg.role === 'user' ? ( <div className="whitespace-pre-wrap">{msg.content}</div> ) : (
              <>
                {msg.reasoning && (
                  <details className="mb-2 group/reasoning" open={isStreaming && idx === messages.length - 1}>
                    <summary className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground/60 cursor-pointer hover:text-purple-400 transition-colors select-none list-none outline-none">
                      <Brain size={12} />
                      <span>{getText('spotlight', 'thinking', language)}</span>
                      <ChevronDown size={12} className="group-open/reasoning:rotate-180 transition-transform duration-200" />
                    </summary>
                    <div className="mt-2 pl-2 border-l-2 border-purple-500/20 text-xs text-muted-foreground/80 leading-relaxed opacity-80 reasoning-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({node, inline, className, children, ...props}: any) {
                            return <code className={cn("bg-black/10 dark:bg-black/30 px-1 py-0.5 rounded font-mono", className)} {...props}>{children}</code>
                          }
                        }}
                      >
                        {msg.reasoning}
                      </ReactMarkdown>
                      {isStreaming && idx === messages.length - 1 && !msg.content && ( <span className="inline-block w-1.5 h-3 ml-1 bg-purple-500/50 align-middle animate-pulse" /> )}
                    </div>
                  </details>
                )}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? ( <CodeBlock language={match[1]} className="text-sm">{String(children).replace(/\n$/, '')}</CodeBlock> ) : ( <code className={cn("bg-black/20 px-1 py-0.5 rounded font-mono", className)} {...props}>{children}</code> )
                    }
                  }}
                >
                  {msg.content || (isStreaming && idx === messages.length - 1 && !msg.reasoning ? "..." : "")}
                </ReactMarkdown>
              </>
            )}
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
}