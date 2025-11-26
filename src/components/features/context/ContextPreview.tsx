import { useState, useEffect } from 'react';
import { Copy, FileText, Loader2, AlertCircle } from 'lucide-react';
import { FileNode } from '@/types/context';
import { generateContext } from '@/lib/context_assembler';
import { writeText } from '@tauri-apps/api/clipboard';
import { useAppStore } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore';
import { getText } from '@/lib/i18n';

interface ContextPreviewProps {
  fileTree: FileNode[];
}

export function ContextPreview({ fileTree }: ContextPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const { language } = useAppStore();
  const { removeComments } = useContextStore();

  // 当组件挂载或文件树、配置变化时，生成预览内容
  useEffect(() => {
    let isMounted = true;
    
    const loadPreview = async () => {
      setIsLoading(true);
      try {
        const { text } = await generateContext(fileTree, { removeComments });
        if (isMounted) setContent(text);
      } catch (err) {
        console.error("Preview generation failed", err);
        if (isMounted) setContent("Error generating preview.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // 防抖
    const timer = setTimeout(loadPreview, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [fileTree, removeComments]);

  const handleCopy = async () => {
    await writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Loader2 size={24} className="animate-spin text-primary" />
        <p className="text-sm">{getText('context', 'generating', language)}</p>
      </div>
    );
  }

  if (!content.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 opacity-60">
        <AlertCircle size={32} />
        <p>{getText('context', 'noFiles', language)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-secondary/10 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText size={16} className="text-primary" />
          <span>{getText('context', 'previewTitle', language)}</span>
          <span className="text-xs text-muted-foreground font-normal ml-2">
            ({getText('context', 'chars', language, { count: content.length.toLocaleString() })})
            {removeComments && <span className="ml-2 px-1.5 py-0.5 bg-green-500/10 text-green-600 text-[10px] rounded border border-green-500/20">No Comments</span>}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {isCopied ? (
            <span className="text-green-500">{getText('context', 'copied', language)}</span>
          ) : (
            <>
              <Copy size={14} /> {getText('actions', 'copy', language)}
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-hidden relative group">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-muted-foreground font-medium">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}