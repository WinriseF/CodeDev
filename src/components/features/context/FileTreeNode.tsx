import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileCode } from 'lucide-react';
import { FileNode } from '@/types/context';
import { cn } from '@/lib/utils';

interface FileTreeNodeProps {
  node: FileNode;
  level?: number; // 缩进层级
  onToggleSelect: (id: string, checked: boolean) => void;
}

export function FileTreeNode({ node, level = 0, onToggleSelect }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false); // 默认折叠还是展开可自定
  const indent = level * 16 + 12; // 计算左侧 padding (像素)

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.kind === 'dir') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleSelect(node.id, e.target.checked);
  };

  // 图标选择逻辑
  const Icon = node.kind === 'dir' 
    ? (isExpanded ? ChevronDown : ChevronRight) 
    : null; // 文件没有展开箭头

  const TypeIcon = node.kind === 'dir' ? Folder : FileCode;

  return (
    <div>
      {/* 节点行 */}
      <div 
        className={cn(
          "flex items-center py-1 pr-2 hover:bg-secondary/50 cursor-pointer select-none transition-colors text-sm group",
          !node.isSelected && "opacity-60 hover:opacity-100" // 未选中时稍微变淡
        )}
        style={{ paddingLeft: `${indent}px` }}
        onClick={handleExpandClick}
      >
        {/* 1. 展开/折叠箭头 (仅文件夹) */}
        <div className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground">
          {Icon && <Icon size={14} />}
        </div>

        {/* 2. 复选框 */}
        <div className="mr-2 flex items-center" onClick={e => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={node.isSelected}
            onChange={handleCheckboxChange}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-transparent text-primary focus:ring-0 cursor-pointer accent-primary"
          />
        </div>

        {/* 3. 文件图标 */}
        <TypeIcon 
          size={14} 
          className={cn(
            "mr-2 shrink-0", 
            node.kind === 'dir' ? "text-blue-400" : "text-muted-foreground"
          )} 
        />

        {/* 4. 文件名 */}
        <span className={cn("truncate", node.kind === 'dir' && "font-medium")}>
          {node.name}
        </span>
      </div>

      {/* 递归渲染子节点 */}
      {isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}