import { ReactNode } from 'react';
import { Prompt } from './prompt';

export type SpotlightMode = 'search' | 'chat';

export interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  
  icon?: ReactNode;
  group?: string;
  
  originalData?: Prompt;
  
  type: 'prompt' | 'command' | 'action' | 'url'; 
  
  // 功能标志
  isExecutable?: boolean;
  shellType?: string;
  url?: string;
}

export interface SpotlightState {
  mode: SpotlightMode;
  query: string;
  chatInput: string;
}