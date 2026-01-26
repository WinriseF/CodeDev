import { FileMeta } from "@/types/hyperview";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function ImageRenderer({ meta }: { meta: FileMeta }) {
  const [loading, setLoading] = useState(true);

  // 关键：构建 preview:// URL
  // Windows 路径包含反斜杠和冒号，encodeURIComponent 是必须的
  // 我们的 Rust protocol handler 会负责解码
  const src = `preview://${encodeURIComponent(meta.path)}`;

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/5 relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={src}
        alt={meta.name}
        className="max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-300"
        style={{ opacity: loading ? 0 : 1 }}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
