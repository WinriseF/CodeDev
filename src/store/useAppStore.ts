import { create } from 'zustand';

export type AppView = 'prompts' | 'context' | 'patch';

interface AppState {
  currentView: AppView;
  sidebarWidth: number; // 新增：侧边栏宽度
  isSidebarOpen: boolean; // 新增：是否展开
  setView: (view: AppView) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'prompts',
  sidebarWidth: 260, // 默认宽度
  isSidebarOpen: true,
  setView: (view) => set({ currentView: view }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));