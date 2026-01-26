import { ReactNode } from 'react';
import { Prompt } from './prompt';

export type SpotlightMode = 'search' | 'chat';

// 新增：搜索范围类型定义
export type SearchScope = 'global' | 'app' | 'command' | 'prompt';

export interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  content?: string;

  icon?: ReactNode;
  group?: string;

  originalData?: Prompt;

  // >>> 修改：新增 'shell' 和 'shell_history' 类型
  type: 'prompt' | 'command' | 'action' | 'url' | 'app' | 'math' | 'shell' | 'shell_history';

  isExecutable?: boolean;
  shellType?: string;
  url?: string;

  appPath?: string;

  // 新增：特定类型的字段
  mathResult?: string;
  shellCmd?: string;

  // >>> 新增：Shell 相关字段
  historyCommand?: string; // 用于历史记录
}

export interface SpotlightState {
  mode: SpotlightMode;
  query: string;
  chatInput: string;
}