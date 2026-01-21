export type ShellType = 'auto' | 'cmd' | 'powershell' | 'bash' | 'zsh' | 'python';

export interface Prompt {
  id: string;
  title: string;
  content: string;
  group: string;
  description?: string;
  tags?: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;

  source?: 'local' | 'official';
  packId?: string;
  originalId?: string;

  type?: 'command' | 'prompt';

  isExecutable?: boolean;
  shellType?: ShellType;

  // [New] 标记是否作为聊天模式下的快捷指令 (/指令)
  useAsChatTemplate?: boolean;
}

export const DEFAULT_GROUP = 'Default';

export interface PackManifestItem {
  id: string;
  language: string;
  platform: string;
  name: string;
  description: string;
  count: number;
  size_kb: number;
  url: string;
  category?: 'command' | 'prompt';
}

export interface PackManifest {
  updated_at: number;
  version: string;
  packages: PackManifestItem[];
}