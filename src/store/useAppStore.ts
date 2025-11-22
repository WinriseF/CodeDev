import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';

export type AppView = 'prompts' | 'context' | 'patch';
export type AppTheme = 'dark' | 'light';
export type AppLang = 'en' | 'zh';

interface AppState {
  currentView: AppView;
  isSidebarOpen: boolean;
  isSettingsOpen: boolean; // 这个状态只存在内存里
  theme: AppTheme;
  language: AppLang;

  setView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLang) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // --- 状态初始值 ---
      currentView: 'prompts',
      isSidebarOpen: true,
      isSettingsOpen: false, // 默认关闭
      theme: 'dark', 
      language: 'zh',

      // --- Actions ---
      setView: (view) => set({ currentView: view }),
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      
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
      name: 'app-config',
      storage: createJSONStorage(() => fileStorage),
      
      // 🔥 核心修复：使用 partialize 过滤不需要保存的字段
      // 只有这里return的字段，才会被写入 config.json
      partialize: (state) => ({
        theme: state.theme,           // 要保存
        language: state.language,     // 要保存
        isSidebarOpen: state.isSidebarOpen, // 要保存 (用户习惯)
        currentView: state.currentView // 要保存 (回到上次的工作台)
        // 注意：isSettingsOpen 没有被包含在这里，所以它不会被保存！
      }),
    }
  )
);