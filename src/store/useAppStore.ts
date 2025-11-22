import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_GLOBAL_IGNORE } from '@/types/context'; // 引入新常量

export type AppView = 'prompts' | 'context' | 'patch';
export type AppTheme = 'dark' | 'light';
export type AppLang = 'en' | 'zh';

interface AppState {
  currentView: AppView;
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  isPromptSidebarOpen: boolean;
  isContextSidebarOpen: boolean;
  contextSidebarWidth: number;
  theme: AppTheme;
  language: AppLang;

  // ✨ 新增：全局黑名单配置
  globalIgnore: IgnoreConfig;

  setView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setPromptSidebarOpen: (open: boolean) => void;
  setContextSidebarOpen: (open: boolean) => void;
  setContextSidebarWidth: (width: number) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLang) => void;

  // ✨ 新增 Action：修改全局黑名单
  updateGlobalIgnore: (type: keyof IgnoreConfig, action: 'add' | 'remove', value: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'prompts',
      isSidebarOpen: true,
      isSettingsOpen: false,
      isPromptSidebarOpen: true,
      isContextSidebarOpen: true,
      contextSidebarWidth: 300,
      theme: 'dark',
      language: 'zh',

      // ✨ 初始化全局配置
      globalIgnore: DEFAULT_GLOBAL_IGNORE,

      // ... 原有 Setters ...
      setView: (view) => set({ currentView: view }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      setPromptSidebarOpen: (open) => set({ isPromptSidebarOpen: open }),
      setContextSidebarOpen: (open) => set({ isContextSidebarOpen: open }),
      setContextSidebarWidth: (width) => set({ contextSidebarWidth: width }),
      setTheme: (theme) => set(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return { theme };
      }),
      setLanguage: (language) => set({ language }),

      // ✨ 实现全局修改逻辑
      updateGlobalIgnore: (type, action, value) => set((state) => {
        const currentList = state.globalIgnore[type];
        let newList = currentList;
        if (action === 'add' && !currentList.includes(value)) {
          newList = [...currentList, value];
        } else if (action === 'remove') {
          newList = currentList.filter(item => item !== value);
        }
        return {
          globalIgnore: { ...state.globalIgnore, [type]: newList }
        };
      }),
    }),
    {
      name: 'app-config',
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        isSidebarOpen: state.isSidebarOpen,
        isPromptSidebarOpen: state.isPromptSidebarOpen,
        isContextSidebarOpen: state.isContextSidebarOpen,
        contextSidebarWidth: state.contextSidebarWidth,
        currentView: state.currentView,
        // ✨ 持久化全局配置
        globalIgnore: state.globalIgnore
      }),
    }
  )
);