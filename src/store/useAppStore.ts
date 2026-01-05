import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_GLOBAL_IGNORE } from '@/types/context';
import { fetch } from '@tauri-apps/plugin-http';
import { emit } from '@tauri-apps/api/event'; 
import { AIModelConfig, AIProviderConfig, AIProviderSetting, DEFAULT_AI_CONFIG, DEFAULT_PROVIDER_SETTINGS } from '@/types/model';

// --- 1. 导出类型 ---
export type AppView = 'prompts' | 'context' | 'patch';
export type AppTheme = 'dark' | 'light';
export type AppLang = 'en' | 'zh';

// --- 2. 默认/兜底模型数据 ---
export const DEFAULT_MODELS: AIModelConfig[] = [
  {
    "id": "Gemini-3-pro-preview",
    "name": "Gemini 3 Pro",
    "provider": "Google",
    "contextLimit": 1048576,
    "inputPricePerMillion": 2.00,
    "color": "bg-blue-600"
  },
  {
    "id": "Grok-4-1",
    "name": "Grok 4.1",
    "provider": "Other",
    "contextLimit": 2000000,
    "inputPricePerMillion": 0.20,
    "color": "bg-gray-900"
  },
  {
    "id": "DeepSeek-v3-2",
    "name": "DeepSeek V3.2",
    "provider": "DeepSeek",
    "contextLimit": 128000,
    "inputPricePerMillion": 0.28,
    "color": "bg-purple-600"
  },
  {
    "id": "GLM-4-6",
    "name": "GLM 4.6",
    "provider": "Other",
    "contextLimit": 200000,
    "inputPricePerMillion": 0.6,
    "color": "bg-blue-400"
  }
];

// 配置 URL 列表 (CDN 优先 + GitHub 原站)
const REMOTE_CONFIG_URLS = [
  'https://gitee.com/winriseF/models/raw/master/models/models.json',
  'https://cdn.jsdelivr.net/gh/WinriseF/Code-Forge-AI@main/models/models.json', // 方案一：jsDelivr CDN
  'https://raw.githubusercontent.com/WinriseF/Code-Forge-AI/main/models/models.json' // 方案二：GitHub 原站
];

export interface SpotlightAppearance {
  width: number;        // 默认 640
  defaultHeight: number; // 默认/搜索模式固定高度，默认 400
  maxChatHeight: number; // 聊天模式最大高度，默认 600
}

export interface RestReminderConfig {
  enabled: boolean;     // 是否启用
  intervalMinutes: number; // 提醒间隔（分钟），默认 45
}

// --- 3. Store 接口 ---
interface AppState {
  // UI State
  currentView: AppView;
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  isMonitorOpen: boolean;
  isPromptSidebarOpen: boolean;
  isContextSidebarOpen: boolean;
  contextSidebarWidth: number;
  theme: AppTheme;
  language: AppLang;
  spotlightAppearance: SpotlightAppearance;
  //快捷键
  spotlightShortcut: string; 
  // Filters
  globalIgnore: IgnoreConfig;
  // Rest Reminder
  restReminder: RestReminderConfig;

  // Models State
  models: AIModelConfig[];
  lastUpdated: number;

  aiConfig: AIProviderConfig;
  savedProviderSettings: Record<string, AIProviderSetting>;

  // Actions
  setView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setMonitorOpen: (open: boolean) => void;
  setPromptSidebarOpen: (open: boolean) => void;
  setContextSidebarOpen: (open: boolean) => void;
  setContextSidebarWidth: (width: number) => void;
  setTheme: (theme: AppTheme, skipEmit?: boolean) => void;
  setLanguage: (lang: AppLang) => void;
  updateGlobalIgnore: (type: keyof IgnoreConfig, action: 'add' | 'remove', value: string) => void;
  setAIConfig: (config: Partial<AIProviderConfig>) => void;
  setSpotlightShortcut: (shortcut: string) => void;
  setRestReminder: (config: Partial<RestReminderConfig>) => void;
  // Async Actions
  syncModels: () => Promise<void>;
  resetModels: () => void;
  setSpotlightAppearance: (config: Partial<SpotlightAppearance>) => void;
}

// --- 4. Store 实现 ---
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始值
      currentView: 'prompts',
      isSidebarOpen: true,
      isSettingsOpen: false,
      isMonitorOpen: false,
      isPromptSidebarOpen: true,
      isContextSidebarOpen: true,
      contextSidebarWidth: 300,
      theme: 'dark',
      language: 'zh',
      spotlightShortcut: 'Alt+S', 
      aiConfig: DEFAULT_AI_CONFIG,
      savedProviderSettings: DEFAULT_PROVIDER_SETTINGS,
      globalIgnore: DEFAULT_GLOBAL_IGNORE,
      restReminder: {
        enabled: false,
        intervalMinutes: 45
      },
      
      // 模型初始值
      models: DEFAULT_MODELS,
      lastUpdated: 0,

      // Setters
      spotlightAppearance: { width: 640, defaultHeight: 400, maxChatHeight: 600 },
      setSpotlightAppearance: (config) => set((state) => ({
        spotlightAppearance: { ...state.spotlightAppearance, ...config }
      })),
      setView: (view) => set({ currentView: view }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      setMonitorOpen: (open) => set({ isMonitorOpen: open }),
      setPromptSidebarOpen: (open) => set({ isPromptSidebarOpen: open }),
      setContextSidebarOpen: (open) => set({ isContextSidebarOpen: open }),
      setContextSidebarWidth: (width) => set({ contextSidebarWidth: width }),
      setTheme: (theme, skipEmit = false) => set(() => {
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        if (!skipEmit) {
            emit('theme-changed', theme).catch(err => console.error(err));
        }
        return { theme };
      }),
      setSpotlightShortcut: (shortcut) => set({ spotlightShortcut: shortcut }),
      setRestReminder: (config) => set((state) => ({
        restReminder: { ...state.restReminder, ...config }
      })),
      setAIConfig: (config) => set((state) => {
        const newConfig = { ...state.aiConfig, ...config };
        const currentProviderId = newConfig.providerId;

        // 情况1：切换了 Provider
        if (config.providerId && config.providerId !== state.aiConfig.providerId) {
            // 尝试从已保存的配置中加载
            const saved = state.savedProviderSettings[config.providerId] || DEFAULT_PROVIDER_SETTINGS[config.providerId] || {
                apiKey: '',
                baseUrl: '',
                modelId: '',
                temperature: 0.7
            };

            return {
                aiConfig: {
                    ...newConfig,
                    apiKey: saved.apiKey,
                    baseUrl: saved.baseUrl,
                    modelId: saved.modelId,
                    temperature: saved.temperature
                }
            };
        }

        // 情况2：修改了当前 Provider 的具体配置 (apiKey/modelId/etc)
        // 自动保存回 savedProviderSettings
        const newSavedSettings = { ...state.savedProviderSettings };
        newSavedSettings[currentProviderId] = {
            apiKey: newConfig.apiKey,
            baseUrl: newConfig.baseUrl,
            modelId: newConfig.modelId,
            temperature: newConfig.temperature
        };

        return { 
          aiConfig: newConfig,
          savedProviderSettings: newSavedSettings
        };
      }),
      setLanguage: (language) => set({ language }),
      updateGlobalIgnore: (type, action, value) => set((state) => {
        const currentList = state.globalIgnore[type];
        let newList = currentList;
        if (action === 'add' && !currentList.includes(value)) {
          newList = [...currentList, value];
        } else if (action === 'remove') {
          newList = currentList.filter(item => item !== value);
        }
        return { globalIgnore: { ...state.globalIgnore, [type]: newList } };
      }),

      // 并发请求多个源，谁快用谁
      syncModels: async () => {
        console.log('[AppStore] Starting model sync...');
        
        // 定义单个请求的逻辑
        const fetchUrl = async (url: string) => {
          console.log(`[Sync] Trying: ${url}`);
          const response = await fetch(url, {
            method: 'GET',
          });

          if (response.ok) {
            // 使用 .json() 获取数据
            const data = await response.json() as AIModelConfig[];
            if (Array.isArray(data) && data.length > 0) {
              return data;
            }
          }
          throw new Error(`Invalid response from ${url}`);
        };

        try {
          // Promise.any 会等待第一个成功的 Promise，如果全部失败则抛出 AggregateError
          // 这实现了“赛跑”机制，CDN 通常会胜出
          const data = await Promise.any(REMOTE_CONFIG_URLS.map(url => fetchUrl(url)));

          set({ 
            models: data, 
            lastUpdated: Date.now() 
          });
          console.log(`[AppStore] Models synced successfully! Count: ${data.length}`);
          
        } catch (err) {
          console.warn('[AppStore] All sync sources failed. Keeping local cache.', err);
        }
      },

      resetModels: () => set({ models: DEFAULT_MODELS }),
    }),
    {
      name: 'app-config',
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        spotlightShortcut: state.spotlightShortcut,
        isSidebarOpen: state.isSidebarOpen,
        isPromptSidebarOpen: state.isPromptSidebarOpen,
        isContextSidebarOpen: state.isContextSidebarOpen,
        contextSidebarWidth: state.contextSidebarWidth,
        currentView: state.currentView,
        globalIgnore: state.globalIgnore,
        models: state.models,
        lastUpdated: state.lastUpdated,
        aiConfig: state.aiConfig,
        savedProviderSettings: state.savedProviderSettings,
        spotlightAppearance: state.spotlightAppearance,
        restReminder: state.restReminder
      }),
    }
  )
);