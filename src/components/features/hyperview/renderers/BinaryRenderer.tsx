import { FileMeta } from "@/types/hyperview";
import { FileQuestion } from "lucide-react";

export function BinaryRenderer({ meta }: { meta: FileMeta }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-4 bg-secondary/10">
      <div className="p-6 bg-secondary rounded-full">
        <FileQuestion size={48} className="opacity-50" />
      </div>
      <div className="text-center">
        <h3 className="font-medium text-foreground">{meta.name}</h3>
        <p className="text-xs mt-1 font-mono">{meta.mime || 'application/octet-stream'}</p>
        <p className="text-xs mt-1">{formatSize(meta.size)}</p>
        <p className="text-sm mt-4 px-4 py-2 bg-secondary/50 rounded border border-border">
          Binary preview not supported yet.
        </p>
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
