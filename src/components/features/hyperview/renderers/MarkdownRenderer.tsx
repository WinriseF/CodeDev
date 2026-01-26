import { useEffect, useState } from "react";
import { FileMeta } from "@/types/hyperview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { cn } from "@/lib/utils";

export function MarkdownRenderer({ meta }: { meta: FileMeta }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (meta.size > 1024 * 1024 * 2) { // > 2MB
             setContent("# File too large\n\nPreviewing large markdown files is disabled for performance.");
        } else {
             const text = await readTextFile(meta.path);
             setContent(text);
        }
      } catch (e) {
        setContent(`# Error\n\nCould not read file: ${e}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [meta.path]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-muted-foreground"/></div>;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-background p-8">
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({node, inline, className, children, ...props}: any) {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <CodeBlock language={match[1]} className="not-prose my-4">
                    {String(children).replace(/\n$/, '')}
                </CodeBlock>
              ) : (
                <code className={cn("bg-secondary px-1.5 py-0.5 rounded font-mono text-xs", className)} {...props}>
                  {children}
                </code>
              )
            },
            // 自定义链接渲染，防止跳出应用
            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />,
            // 优化表格样式
            table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table {...props} className="w-full border-collapse border border-border" /></div>,
            th: ({node, ...props}) => <th {...props} className="border border-border bg-secondary/50 p-2 text-left" />,
            td: ({node, ...props}) => <td {...props} className="border border-border p-2" />,
            hr: ({node, ...props}) => <hr {...props} className="border-border my-6" />,
            blockquote: ({node, ...props}) => <blockquote {...props} className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground" />
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
