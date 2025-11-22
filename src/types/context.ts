// src/types/context.ts

// 1. 黑名单配置接口
export interface IgnoreConfig {
  dirs: string[];       // 忽略的文件夹名 (如: node_modules, .git)
  files: string[];      // 忽略的文件名 (如: package-lock.json)
  extensions: string[]; // 忽略的后缀 (如: png, exe, lock)
}

// 默认黑名单配置
export const DEFAULT_IGNORE_CONFIG: IgnoreConfig = {
  dirs: [
    'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'target', 
    'bin', 'obj', '__pycache__', 'coverage', 'venv', '.next', '.nuxt'
  ],
  files: [
    '.DS_Store', 'thumbs.db', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
  ],
  extensions: [
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp',
    'mp3', 'mp4', 'mov', 'avi',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', '7z', 'rar',
    'exe', 'dll', 'so', 'dylib', 'class', 'jar',
    'bin', 'pyc', 'log'
  ]
};

// 2. 文件节点接口 (适配 VS Code 风格树)
export interface FileNode {
  id: string;         // 唯一标识 (通常是完整路径)
  name: string;       // 文件/文件夹名
  path: string;       // 完整路径
  kind: 'file' | 'dir';
  size?: number;      // 字节大小
  
  // UI 交互状态
  isSelected: boolean;      // 是否被勾选 (用于生成 Context)
  isPartial?: boolean;      // (仅文件夹) 是否半选状态 (子文件部分被选)
  isExpanded?: boolean;     // (仅文件夹) 是否展开
  
  children?: FileNode[];    // 子节点
}