// src/store/useContextStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_IGNORE_CONFIG, FileNode } from '@/types/context';

interface ContextState {
  // --- 设置 (持久化) ---
  ignoreConfig: IgnoreConfig;
  
  // --- 运行时数据 (不持久化) ---
  projectRoot: string | null;
  fileTree: FileNode[]; 
  isScanning: boolean;

  // --- Actions ---
  setProjectRoot: (path: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  setIsScanning: (status: boolean) => void;
  
  // 黑名单管理
  addIgnoreItem: (type: keyof IgnoreConfig, value: string) => void;
  removeIgnoreItem: (type: keyof IgnoreConfig, value: string) => void;
  resetIgnoreConfig: () => void;

  // 树操作 (勾选/展开) - 后面 UI 开发时会用到
  toggleSelect: (nodeId: string, checked: boolean) => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      ignoreConfig: DEFAULT_IGNORE_CONFIG,
      projectRoot: null,
      fileTree: [],
      isScanning: false,

      setProjectRoot: (path) => set({ projectRoot: path }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setIsScanning: (status) => set({ isScanning: status }),

      addIgnoreItem: (type, value) => set((state) => ({
        ignoreConfig: {
          ...state.ignoreConfig,
          [type]: [...state.ignoreConfig[type], value]
        }
      })),

      removeIgnoreItem: (type, value) => set((state) => ({
        ignoreConfig: {
          ...state.ignoreConfig,
          [type]: state.ignoreConfig[type].filter(item => item !== value)
        }
      })),
      
      resetIgnoreConfig: () => set({ ignoreConfig: DEFAULT_IGNORE_CONFIG }),

      // 这里的 toggleSelect 逻辑比较复杂(涉及递归勾选子节点)，
      // 我们在 UI 开发阶段再详细实现，先留个空位
      toggleSelect: (nodeId, checked) => { console.log('Todo: toggle', nodeId, checked) },
    }),
    {
      name: 'context-config',
      storage: createJSONStorage(() => fileStorage),
      // 只持久化黑名单设置，文件树和当前路径重启后重置
      partialize: (state) => ({
        ignoreConfig: state.ignoreConfig
      }),
    }
  )
);