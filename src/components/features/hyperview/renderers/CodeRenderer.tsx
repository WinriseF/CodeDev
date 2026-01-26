import { useEffect, useState } from "react";
import { FileMeta } from "@/types/hyperview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

export function CodeRenderer({ meta }: { meta: FileMeta }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 临时方案：直接读文件。
    // TODO: 下一阶段改为 Rust Stream 读取，支持超大文件
    const load = async () => {
      try {
        if (meta.size > 1024 * 1024 * 5) { // > 5MB
             setContent("// File too large for simple preview.\n// Coming in Stage 2: Streaming Reader.");
        } else {
             const text = await readTextFile(meta.path);
             setContent(text);
        }
      } catch (e) {
        setContent(`Error reading file: ${e}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [meta.path]);

  // 简单的扩展名映射
  const lang = meta.name.split('.').pop() || 'plaintext';

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin"/></div>;

  return (
    <Editor
      height="100%"
      language={lang}
      value={content}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false }, // 关闭 minimap 提升性能
        domReadOnly: true,
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: 'on'
      }}
    />
  );
}
