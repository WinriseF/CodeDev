import { ReactNode } from 'react';
import { Prompt } from './prompt';

export type SpotlightMode = 'search' | 'chat';

export type SearchScope = 'global' | 'app' | 'command' | 'prompt' | 'math' | 'shell' | 'web';

export interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  content?: string;

  icon?: ReactNode;
  group?: string;

  originalData?: Prompt;

  type: 'prompt' | 'command' | 'action' | 'url' | 'app' | 'math' | 'shell' | 'shell_history' | 'web_search';

  isExecutable?: boolean;
  shellType?: string;
  url?: string;

  appPath?: string;

  mathResult?: string;
  shellCmd?: string;
  historyCommand?: string;
}

export interface SpotlightState {
  mode: SpotlightMode;
  query: string;
  chatInput: string;
}