export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'DeepSeek' | 'Other';
  contextLimit: number;
  inputPricePerMillion: number;
  color?: string;
}

export interface AIProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  modelId: string;
  temperature: number;
}

export interface AIProviderSetting {
  apiKey: string;
  baseUrl?: string;
  modelId: string;
  temperature: number;
}

export const DEFAULT_PROVIDER_SETTINGS: Record<string, AIProviderSetting> = {
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o', temperature: 0.7 },
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', modelId: 'deepseek-chat', temperature: 0.7 },
  anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', modelId: 'claude-3-5-sonnet', temperature: 0.7 }
};

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  providerId: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  modelId: 'deepseek-chat',
  temperature: 0.7
};