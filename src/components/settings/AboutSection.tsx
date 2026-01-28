import { useState, useEffect } from 'react';
import { getVersion, getName } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-shell';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// [FIX] 引入 Variants 类型
import { motion, Variants } from 'framer-motion'; 
import { Github, Loader2, AlertCircle, ExternalLink, BookOpen } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { useUsageGuide } from './hooks/useUsageGuide';
import { CodeBlock } from '@/components/ui/CodeBlock';
import iconUrl from '../../../src-tauri/icons/128x128.png';

const REPO_URL = "https://github.com/WinriseF/CtxRun";

// [FIX] 显式标注类型 : Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 } 
  }
};

// [FIX] 显式标注类型 : Variants
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 100 } 
  }
};

export function AboutSection() {
  const { language } = useAppStore();
  const [appVersion, setAppVersion] = useState<string>('');
  const [appName, setAppName] = useState<string>('CtxRun');
  const { content, isLoading, error } = useUsageGuide();

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
    getName().then(setAppName).catch(() => setAppName('CtxRun'));
  }, []);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background relative selection:bg-primary/20">
      
      <style>{`
        /* 基础排版优化 */
        .about-md-body { color: var(--foreground); line-height: 1.7; font-size: 0.95rem; }
        .about-md-body p { margin-bottom: 1em; }
        
        /* 行内代码微调 */
        .about-md-body code:not(pre code) { 
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
          font-size: 0.85em; 
          background: var(--secondary);
          color: var(--primary);
          padding: 0.2em 0.4em;
          border-radius: 6px;
          border: 1px solid var(--border);
        }

        /* 标题层级 */
        .about-md-body h1, .about-md-body h2, .about-md-body h3 { 
          color: var(--foreground); 
          font-weight: 700; 
          letter-spacing: -0.02em;
          margin-top: 1.5em;
          margin-bottom: 0.75em;
        }
        .about-md-body h1:first-child { margin-top: 0; }
        .about-md-body h1 { 
          font-size: 1.75em; 
          border-bottom: 2px solid var(--border); 
          padding-bottom: 0.3em; 
        }
        .about-md-body h2 { 
          font-size: 1.4em; 
          padding-bottom: 0.3em;
          border-bottom: 1px dashed var(--border);
        }
        .about-md-body h3 { font-size: 1.15em; }

        /* 列表优化 */
        .about-md-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
        .about-md-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
        .about-md-body li { margin-bottom: 0.4em; padding-left: 0.2em; }
        .about-md-body li::marker { color: var(--muted-foreground); }

        /* 引用块美化 */
        .about-md-body blockquote { 
          border-left: 4px solid var(--primary); 
          margin: 1.5em 0; 
          padding: 1em 1.2em;
          background: linear-gradient(to right, var(--secondary), transparent);
          color: var(--muted-foreground);
          font-style: italic;
          border-radius: 0 8px 8px 0; 
        }

        /* 链接交互 */
        .about-md-body a { 
          color: var(--primary); 
          text-decoration: none; 
          font-weight: 600; 
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }
        .about-md-body a:hover { border-bottom-color: var(--primary); }

        /* 图片容器化 */
        .about-md-body img { 
          max-width: 100%; 
          height: auto; 
          border-radius: 8px; 
          margin: 1.5em 0; 
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.1);
        }

        /* 表格样式 */
        .about-md-body table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 1.5em 0; 
          font-size: 0.9em;
        }
        .about-md-body th { 
          background: var(--secondary); 
          text-align: left; 
          padding: 0.75em; 
          font-weight: 600; 
          border: 1px solid var(--border);
        }
        .about-md-body td { 
          padding: 0.75em; 
          border: 1px solid var(--border);
        }
        .about-md-body tr:nth-child(even) { background: rgba(128,128,128,0.03); }
      `}</style>

      {/* 1. 头部 Hero 区域 */}
      <div className="relative bg-gradient-to-b from-secondary/30 to-background pt-16 pb-10 border-b border-border/40 overflow-hidden">
        {/* 背景装饰光晕 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
        
        <motion.div 
          className="relative z-10 flex flex-col items-center justify-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
            <motion.div variants={itemVariants} className="relative group cursor-default">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full scale-110" />
                <img 
                    src={iconUrl} 
                    alt="App Icon" 
                    className="w-24 h-24 relative z-10 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:rotate-3 drop-shadow-2xl" 
                />
            </motion.div>

            <motion.h2 variants={itemVariants} className="text-3xl font-extrabold text-foreground tracking-tight mt-6 mb-2">
                {appName}
            </motion.h2>
            
            <motion.div variants={itemVariants} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground bg-secondary/80 px-3 py-1 rounded-full border border-border/50 backdrop-blur-sm">
                    v{appVersion}
                </span>
                <span className="text-xs text-muted-foreground/60">•</span>
                <span className="text-xs text-muted-foreground/60">Early Access</span>
            </motion.div>

            <motion.div variants={itemVariants} className="flex gap-3 mt-8">
                <button 
                    onClick={() => open(REPO_URL)}
                    className="group flex items-center gap-2 px-5 py-2.5 bg-foreground text-background hover:bg-foreground/90 rounded-full text-sm font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                    <Github size={16} className="transition-transform group-hover:-translate-y-0.5" />
                    <span>GitHub</span>
                </button>
                <button 
                    onClick={() => open(`${REPO_URL}/issues`)}
                    className="group flex items-center gap-2 px-5 py-2.5 bg-background border border-border/60 hover:bg-secondary/50 text-foreground rounded-full text-sm font-medium transition-all hover:border-border active:scale-95"
                >
                    <AlertCircle size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span>Feedback</span>
                </button>
            </motion.div>
        </motion.div>
      </div>

      {/* 2. 粘性标题栏 */}
      <div className="sticky top-0 z-20 px-8 py-3 bg-background/80 backdrop-blur-xl border-y border-border/40 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider shadow-sm transition-all">
         <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            {getText('settings', 'usageGuide', language)}
         </div>
      </div>

      {/* 内容区域 */}
      <div className="p-0 min-h-[400px] relative bg-background">
         {isLoading ? (
             <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4 opacity-70">
                 <Loader2 size={32} className="animate-spin text-primary/50" />
                 <span className="text-sm font-medium animate-pulse">{getText('settings', 'loadingUsage', language)}</span>
             </div>
         ) : error ? (
             <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 px-6 text-center"
             >
                 <div className="p-4 bg-destructive/5 rounded-full mb-4 ring-1 ring-destructive/20">
                     <AlertCircle size={32} className="text-destructive" />
                 </div>
                 <h3 className="text-lg font-semibold text-foreground mb-2">Oops!</h3>
                 <p className="text-sm text-muted-foreground mb-6 max-w-xs">{error}</p>
                 <button 
                     onClick={() => open(`${REPO_URL}/blob/main/USAGE.md`)}
                     className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs font-medium"
                 >
                     {getText('settings', 'viewSource', language)} <ExternalLink size={12} />
                 </button>
             </motion.div>
         ) : (
             <div className="px-8 py-10 max-w-4xl mx-auto">
                 <div className="about-md-body">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            // CodeBlock 保持不变，这是功能核心
                            code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                  <div className="my-6 rounded-lg overflow-hidden border border-border/40 shadow-sm">
                                      <CodeBlock language={match[1]} className="text-sm m-0 border-none shadow-none bg-secondary/10">
                                          {String(children).replace(/\n$/, '')}
                                      </CodeBlock>
                                  </div>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                            },
                            // 链接在新窗口打开，增加 Icon 暗示
                            a: ({node, children, ...props}) => (
                                <a {...props} target="_blank" rel="noopener noreferrer" onClick={(e) => {
                                    e.preventDefault();
                                    if (props.href) open(props.href);
                                }}>
                                    {children}
                                </a>
                            )
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                 </div>
                 
                 {/* 底部版权声明 */}
                 <div className="mt-16 pt-8 border-t border-border/30 text-center">
                    <p className="text-[10px] text-muted-foreground/40 font-mono">
                        © {new Date().getFullYear()} {appName}. Open Source under MIT License.
                    </p>
                 </div>
                 
                 <div className="h-12" />
             </div>
         )}
      </div>
    </div>
  );
}