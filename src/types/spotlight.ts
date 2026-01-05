import { ReactNode } from 'react';
import { Prompt } from './prompt';

export type SpotlightMode = 'search' | 'chat';

export interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  
  // UI 属性
  icon?: ReactNode;
  group?: string;
  
  originalData?: Prompt;
  
  // 行为标记
  type: 'prompt' | 'command' | 'action'; 
  isExecutable?: boolean;
  shellType?: string;
}

export interface SpotlightState {
  mode: SpotlightMode;
  query: string;
  chatInput: string;
}