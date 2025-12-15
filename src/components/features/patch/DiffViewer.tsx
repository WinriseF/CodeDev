import { useEffect, useRef } from 'react';
import { DiffEditor, DiffOnMount } from '@monaco-editor/react';
import { Columns, Rows, FileCode, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DiffViewerProps {
  original: string;
  modified: string;
  fileName?: string; 
  placeholder?: string;
}

export function DiffViewer({ original, modified, fileName = '', placeholder }: DiffViewerProps) {
  const { theme } = useAppStore();
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const monacoRef = useRef<any>(null);

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'json': return 'json';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'py': return 'python';
      case 'rs': return 'rust';
      case 'go': return 'go';
      case 'java': return 'java';
      case 'md': return 'markdown';
      case 'sql': return 'sql';
      case 'yml': case 'yaml': return 'yaml';
      default: return 'plaintext';
    }
  };

  const language = getLanguage(fileName);

  const handleEditorDidMount: DiffOnMount = (editor, monaco) => {
    monacoRef.current = monaco;

    // 定义与 ContextPreview 一致的主题，但增加 Diff 专用颜色
    monaco.editor.defineTheme('codeforge-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#020817', // 匹配 App 深色背景
        'editor.lineHighlightBackground': '#1e293b20',
        'scrollbarSlider.background': '#33415550',
        'scrollbarSlider.hoverBackground': '#33415580',
        'editor.selectionBackground': '#3b82f640',
        'editorGutter.background': '#020817',
        // Diff 颜色优化：更柔和的红绿
        'diffEditor.insertedTextBackground': '#22c55e15',
        'diffEditor.removedTextBackground': '#ef444415',
        'diffEditor.diagonalFill': '#33415540',
        'editorWidget.background': '#0f172a',
        'editorWidget.border': '#1e293b',
      }
    });

    monaco.editor.defineTheme('codeforge-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f1f5f9',
        'scrollbarSlider.background': '#94a3b850',
        'editor.selectionBackground': '#bfdbfe',
        'editorGutter.background': '#ffffff',
        'diffEditor.insertedTextBackground': '#22c55e20',
        'diffEditor.removedTextBackground': '#ef444420',
      }
    });

    monaco.editor.setTheme(theme === 'dark' ? 'codeforge-dark' : 'codeforge-light');
  };

  // 监听主题切换
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'codeforge-dark' : 'codeforge-light');
    }
  }, [theme]);

  
  if (!modified && !original) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-3 bg-background animate-in fade-in duration-300">
        <div className="p-4 bg-secondary/30 rounded-full">
            <FileCode size={48} className="opacity-20" />
        </div>
        <p className="text-xs font-medium">{placeholder || "Select a file to compare"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border/50 bg-secondary/5 shrink-0 h-12">
         <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <FileCode size={14} className="text-primary" />
            <span className="opacity-80">{fileName || 'Unsaved Draft'}</span>
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                {language}
            </span>
         </div>

         <div className="flex bg-secondary/30 rounded-lg p-0.5 border border-border/50">
            <button 
              onClick={() => setRenderSideBySide(true)}
              className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all",
                  renderSideBySide ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
                <Columns size={12} /> Split
            </button>
            <button 
              onClick={() => setRenderSideBySide(false)}
              className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all",
                  !renderSideBySide ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
                <Rows size={12} /> Unified
            </button>
         </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative group">
         <DiffEditor
            height="100%"
            language={language}
            original={original}
            modified={modified}
            onMount={handleEditorDidMount}
            loading={
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-xs">Loading Diff...</span>
                </div>
            }
            options={{
                readOnly: true, 
                renderSideBySide: renderSideBySide,
                minimap: { enabled: true, scale: 0.75, renderCharacters: false }, 
                scrollBeyondLastLine: false,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
                lineHeight: 1.6,
                padding: { top: 16, bottom: 16 },
                automaticLayout: true, 
                diffWordWrap: 'off',
                wordWrap: 'on', 
                ignoreTrimWhitespace: false,
                renderLineHighlight: 'none', // 视觉降噪
                matchBrackets: 'never',
                folding: false, // 预览模式更清爽
            }}
         />
      </div>
    </div>
  );
}