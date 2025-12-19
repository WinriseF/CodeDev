import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_PROJECT_IGNORE, FileNode } from '@/types/context';

// --- 递归设置选中状态 ---
const setSelectionByPaths = (nodes: FileNode[], paths: Set<string>, mode: 'add' | 'replace'): FileNode[] => {
  return nodes.map(node => {
    let newSelected = node.isSelected;
    
    if (node.kind === 'file') {
        if (paths.has(node.path)) {
            // 如果在目标列表中，强制选中
            newSelected = true;
        } else if (mode === 'replace') {
            // 如果是替换模式，且不在列表中，强制取消选中
            newSelected = false;
        }
    }

    let newChildren = node.children;
    if (node.children) {
        newChildren = setSelectionByPaths(node.children, paths, mode);
    }

    // 这里稍微简化：我们只控制文件的选中状态，文件夹的选中状态在 UI 渲染时通常由子节点决定，
    // 或者如果你的逻辑是文件夹也有独立的 isSelected，这里可能需要根据子节点反推，
    // 但为了 RAG 的目的，主要是为了选中文件。
    return { ...node, isSelected: newSelected, children: newChildren };
  });
};

const setAllChildren = (node: FileNode, isSelected: boolean): FileNode => {
  const newNode = { ...node, isSelected };
  if (newNode.children) {
    newNode.children = newNode.children.map(child => setAllChildren(child, isSelected));
  }
  return newNode;
};

const updateNodeState = (nodes: FileNode[], targetId: string, isSelected: boolean): FileNode[] => {
  return nodes.map(node => {
    if (node.id === targetId) {
      return setAllChildren(node, isSelected);
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeState(node.children, targetId, isSelected)
      };
    }
    return node;
  });
};

const applyLockState = (nodes: FileNode[], fullConfig: IgnoreConfig): FileNode[] => {
  return nodes.map(node => {
    let shouldLock = false;
    if (node.kind === 'dir' && fullConfig.dirs.includes(node.name)) shouldLock = true;
    if (node.kind === 'file' && fullConfig.files.includes(node.name)) shouldLock = true;
    if (node.kind === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase();
      if (ext && fullConfig.extensions.includes(ext)) shouldLock = true;
    }

    const newNode: FileNode = {
      ...node,
      isSelected: shouldLock ? false : node.isSelected,
      isLocked: shouldLock
    };

    if (newNode.children) {
      newNode.children = applyLockState(newNode.children, fullConfig);
    }

    return newNode;
  });
};

interface ContextState {
  projectIgnore: IgnoreConfig;
  removeComments: boolean;
  projectRoot: string | null;
  fileTree: FileNode[]; 
  isScanning: boolean;

  setProjectRoot: (path: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  setIsScanning: (status: boolean) => void;
  updateProjectIgnore: (type: keyof IgnoreConfig, action: 'add' | 'remove', value: string) => void;
  resetProjectIgnore: () => void;
  refreshTreeStatus: (globalConfig: IgnoreConfig) => void;
  toggleSelect: (nodeId: string, checked: boolean) => void;
  setRemoveComments: (enable: boolean) => void;

  // --- Action ---
  smartSelectFiles: (paths: string[], mode?: 'add' | 'replace') => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      projectIgnore: DEFAULT_PROJECT_IGNORE,
      removeComments: false,
      projectRoot: null,
      fileTree: [],
      isScanning: false,

      setProjectRoot: (path) => set({ projectRoot: path }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setIsScanning: (status) => set({ isScanning: status }),

      updateProjectIgnore: (type, action, value) => {
        set((state) => {
          const currentList = state.projectIgnore[type];
          let newList = currentList;
          if (action === 'add' && !currentList.includes(value)) {
            newList = [...currentList, value];
          } else if (action === 'remove') {
            newList = currentList.filter(item => item !== value);
          }
          const newProjectIgnore = { ...state.projectIgnore, [type]: newList };
          return { projectIgnore: newProjectIgnore };
        });
      },
      
      resetProjectIgnore: () => set({ projectIgnore: DEFAULT_PROJECT_IGNORE }),

      refreshTreeStatus: (globalConfig) => set((state) => {
        const effectiveConfig = {
          dirs: [...globalConfig.dirs, ...state.projectIgnore.dirs],
          files: [...globalConfig.files, ...state.projectIgnore.files],
          extensions: [...globalConfig.extensions, ...state.projectIgnore.extensions],
        };
        const newTree = applyLockState(state.fileTree, effectiveConfig);
        return { fileTree: newTree };
      }),

      toggleSelect: (nodeId, checked) => set((state) => ({
        fileTree: updateNodeState(state.fileTree, nodeId, checked)
      })),

      setRemoveComments: (enable) => set({ removeComments: enable }),

      smartSelectFiles: (paths, mode = 'add') => {
        const pathSet = new Set(paths);
        set((state) => ({
            fileTree: setSelectionByPaths(state.fileTree, pathSet, mode)
        }));
      }
    }),
    {
      name: 'context-config',
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({
        projectIgnore: state.projectIgnore,
        removeComments: state.removeComments
      }),
    }
  )
);