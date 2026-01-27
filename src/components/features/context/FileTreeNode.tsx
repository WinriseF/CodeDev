import { ChevronRight, ChevronDown, Folder, FileCode, Lock, Eye } from 'lucide-react';
import { FileNode } from '@/types/context';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getText } from '@/lib/i18n';
import { CSSProperties } from 'react';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  style: CSSProperties;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleExpand: (id: string) => void;
  onPreview?: (path: string) => void;
}

export function FileTreeNode({
  node,
  depth,
  isExpanded,
  hasChildren,
  style,
  onToggleSelect,
  onToggleExpand,
  onPreview
}: FileTreeNodeProps) {
  const { language } = useAppStore();

  // 计算缩进
  const indent = depth * 16 + 12;

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.id);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (node.isLocked) return;
    onToggleSelect(node.id, e.target.checked);
  };

  // 处理双击
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.kind === 'file' && onPreview) {
      onPreview(node.path);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreview) onPreview(node.path);
  };

  const Icon = hasChildren ? (isExpanded ? ChevronDown : ChevronRight) : null;
  const TypeIcon = node.kind === 'dir' ? Folder : FileCode;

  return (
    <div
      className={cn(
        "flex items-center py-1 pr-2 cursor-pointer select-none transition-colors text-sm group absolute w-full box-border",
        node.isLocked
          ? "opacity-40 cursor-not-allowed bg-secondary/20"
          : "hover:bg-secondary/50",
        !node.isSelected && !node.isLocked && "opacity-60 hover:opacity-100"
      )}
      style={{
        ...style,
        paddingLeft: `${indent}px`
      }}
      onClick={handleExpandClick}
      onDoubleClick={handleDoubleClick}
      title={node.isLocked ? getText('common', 'ignoredByFilter', language) : node.path}
    >
      <div className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground">
        {Icon && <Icon size={14} />}
      </div>

      <div className="mr-2 flex items-center" onClick={e => e.stopPropagation()}>
        {node.isLocked ? (
          <Lock size={12} className="text-muted-foreground" />
        ) : (
          <input
            type="checkbox"
            checked={node.isSelected}
            onChange={handleCheckboxChange}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-transparent text-primary focus:ring-0 cursor-pointer accent-primary"
          />
        )}
      </div>

      <TypeIcon
        size={14}
        className={cn(
          "mr-2 shrink-0",
          node.kind === 'dir' ? "text-blue-400" : "text-muted-foreground"
        )}
      />

      <span className={cn("truncate flex-1", node.kind === 'dir' && "font-medium", node.isLocked && "line-through decoration-slate-600")}>
        {node.name}
      </span>

      {/* 新增：悬浮时显示的预览按钮 (仅文件显示) */}
      {node.kind === 'file' && !node.isLocked && onPreview && (
        <button
          onClick={handlePreviewClick}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded mr-1 text-muted-foreground hover:text-primary transition-all"
          title="Preview (Double Click)"
        >
          <Eye size={12} />
        </button>
      )}
    </div>
  );
}
