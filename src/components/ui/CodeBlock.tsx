import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { writeText } from '@tauri-apps/api/clipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language: string;
  children: string;
  className?: string;
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await writeText(children);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className={cn("relative group rounded-md overflow-hidden my-2", className)}>
      {/* 复制按钮 - 默认隐藏，悬停显示 */}
      <button
        onClick={handleCopy}
        className={cn(
          "absolute right-2 top-2 z-10 p-1.5 rounded-md transition-all duration-200",
          "bg-secondary/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground",
          "opacity-0 group-hover:opacity-100", // 悬停显示逻辑
          isCopied && "opacity-100 bg-green-500/10 text-green-500 border-green-500/20" // 复制成功状态
        )}
        title={isCopied ? "Copied!" : "Copy code"}
      >
        {isCopied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      {/* 语言标识 - 可选，悬停显示 */}
      <div className="absolute left-4 top-0 text-[10px] text-muted-foreground/50 font-mono opacity-0 group-hover:opacity-100 transition-opacity select-none pointer-events-none">
        {language}
      </div>

      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem', // text-sm
          lineHeight: '1.5',
          borderRadius: '0.375rem', // rounded-md
          backgroundColor: 'rgba(0, 0, 0, 0.2)' //稍微加深背景
        }}
        codeTagProps={{
          style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}