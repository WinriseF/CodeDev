import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_GLOBAL_IGNORE } from '@/types/context';
import { fetch } from '@tauri-apps/plugin-http';
import { emit } from '@tauri-apps/api/event'; 
import { AIModelConfig, AIProviderConfig, AIProviderSetting, DEFAULT_AI_CONFIG, DEFAULT_PROVIDER_SETTINGS } from '@/types/model';

export type AppView = 'prompts' | 'context' | 'patch';
export type AppTheme = 'dark' | 'light';
export type AppLang = 'en' | 'zh';

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

const REMOTE_CONFIG_URLS = [
  'https://gitee.com/winriseF/models/raw/master/models/models.json',
  'https://cdn.jsdelivr.net/gh/WinriseF/CtxRun@main/models/models.json',
  'https://raw.githubusercontent.com/WinriseF/CtxRun/main/models/models.json'
];

export interface SpotlightAppearance {
  width: number;
  defaultHeight: number;
  maxChatHeight: number;
}

export interface RestReminderConfig {
  enabled: boolean;
  intervalMinutes: number;
}

interface AppState {
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
  spotlightShortcut: string;
  globalIgnore: IgnoreConfig;
  restReminder: RestReminderConfig;

  models: AIModelConfig[];
  lastUpdated: number;

  aiConfig: AIProviderConfig;
  savedProviderSettings: Record<string, AIProviderSetting>;

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
  syncModels: () => Promise<void>;
  resetModels: () => void;
  setSpotlightAppearance: (config: Partial<SpotlightAppearance>) => void;
  renameAIProvider: (oldName: string, newName: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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

      models: DEFAULT_MODELS,
      lastUpdated: 0,

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

        // 切换了 Provider
        if (config.providerId && config.providerId !== state.aiConfig.providerId) {
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

        // 修改了当前 Provider 的具体配置，自动保存
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

      syncModels: async () => {
        const fetchUrl = async (url: string) => {
          const response = await fetch(url, {
            method: 'GET',
          });

          if (response.ok) {
            const data = await response.json() as AIModelConfig[];
            if (Array.isArray(data) && data.length > 0) {
              return data;
            }
          }
          throw new Error(`Invalid response from ${url}`);
        };

        try {
          const data = await Promise.any(REMOTE_CONFIG_URLS.map(url => fetchUrl(url)));

          set({
            models: data,
            lastUpdated: Date.now()
          });

        } catch (err) {
          console.warn('[AppStore] All sync sources failed. Keeping local cache.', err);
        }
      },

      resetModels: () => set({ models: DEFAULT_MODELS }),

      // --- 新增重命名逻辑 ---
      renameAIProvider: (oldName, newName) => set((state) => {
        // 1. 简单校验：新名字不能为空，且不能与现有的其他名字重复
        if (!newName.trim() || newName === oldName || state.savedProviderSettings[newName]) {
            return state;
        }

        // 2. 复制旧配置到新键名
        const currentSettings = { ...state.savedProviderSettings };
        const settingData = currentSettings[oldName];

        if (!settingData) return state;

        // 3. 删除旧键名，添加新键名
        delete currentSettings[oldName];
        currentSettings[newName] = settingData;

        // 4. 如果当前选中的正是被改名的这个，更新当前选中的 providerId
        let newActiveId = state.aiConfig.providerId;
        if (newActiveId === oldName) {
            newActiveId = newName;
        }

        return {
            savedProviderSettings: currentSettings,
            aiConfig: {
                ...state.aiConfig,
                providerId: newActiveId
            }
        };
      }),
      // --- 结束新增逻辑 ---
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