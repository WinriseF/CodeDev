import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';

export type AppView = 'prompts' | 'context' | 'patch';
export type AppTheme = 'dark' | 'light';
export type AppLang = 'en' | 'zh';

interface AppState {
  currentView: AppView;
  isSidebarOpen: boolean; // 主导航栏状态
  isSettingsOpen: boolean; 
  
  // ✨ 新增：灵感库内部侧栏状态
  isPromptSidebarOpen: boolean; 

  theme: AppTheme;
  language: AppLang;

  setView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  
  // ✨ 新增 action
  setPromptSidebarOpen: (open: boolean) => void;

  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLang) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // --- 状态初始值 ---
      currentView: 'prompts',
      isSidebarOpen: true,
      isSettingsOpen: false,
      isPromptSidebarOpen: true, // 默认展开
      theme: 'dark', 
      language: 'zh',

      // --- Actions ---
      setView: (view) => set({ currentView: view }),
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      setPromptSidebarOpen: (open) => set({ isPromptSidebarOpen: open }),
      
      setTheme: (theme) => set(() => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { theme };
      }),

      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'app-config', // 这现在会生成 app-config.json
      storage: createJSONStorage(() => fileStorage),
      
      // 🔥 核心修复：保存哪些字段到 json
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        isSidebarOpen: state.isSidebarOpen,
        isPromptSidebarOpen: state.isPromptSidebarOpen, // ✨ 加入持久化
        currentView: state.currentView
      }),
    }
  )
);