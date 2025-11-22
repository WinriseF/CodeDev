import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fileStorage } from '@/lib/storage';
import { IgnoreConfig, DEFAULT_PROJECT_IGNORE, FileNode } from '@/types/context';

// --- 辅助函数：递归处理勾选逻辑 ---

/**
 * 将指定节点及其所有子孙节点的 isSelected 状态强制设为目标值
 */
const setAllChildren = (node: FileNode, isSelected: boolean): FileNode => {
  // 创建节点副本
  const newNode = { ...node, isSelected };
  
  // 如果有子节点，递归处理
  if (newNode.children) {
    newNode.children = newNode.children.map(child => setAllChildren(child, isSelected));
  }
  return newNode;
};

/**
 * 在树中查找目标 ID，并更新其状态（向下级联）
 */
const updateNodeState = (nodes: FileNode[], targetId: string, isSelected: boolean): FileNode[] => {
  return nodes.map(node => {
    // 1. 找到目标节点：应用级联更新
    if (node.id === targetId) {
      return setAllChildren(node, isSelected);
    }
    
    // 2. 未找到目标，但当前节点有子节点：递归向下查找
    if (node.children) {
      return {
        ...node,
        children: updateNodeState(node.children, targetId, isSelected)
      };
    }
    
    // 3. 无关节点：保持原样
    return node;
  });
};

// --- Store 定义 ---

interface ContextState {
  // --- 持久化设置 ---
  // ✨ 改名：这里只存项目特有的配置，不再包含默认值
  projectIgnore: IgnoreConfig;
  
  // --- 运行时状态 (不持久化) ---
  projectRoot: string | null;
  fileTree: FileNode[]; 
  isScanning: boolean;

  // --- Actions ---
  setProjectRoot: (path: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  setIsScanning: (status: boolean) => void;
  
  // ✨ 新增：修改项目配置
  updateProjectIgnore: (type: keyof IgnoreConfig, action: 'add' | 'remove', value: string) => void;
  resetProjectIgnore: () => void;

  // 树操作
  toggleSelect: (nodeId: string, checked: boolean) => void;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      // 初始状态
      projectIgnore: DEFAULT_PROJECT_IGNORE,
      projectRoot: null,
      fileTree: [],
      isScanning: false,

      // 基础 Setters
      setProjectRoot: (path) => set({ projectRoot: path }),
      setFileTree: (tree) => set({ fileTree: tree }),
      setIsScanning: (status) => set({ isScanning: status }),

      // ✨ 黑名单操作 (项目级)
      updateProjectIgnore: (type, action, value) => set((state) => {
        const currentList = state.projectIgnore[type];
        let newList = currentList;
        
        if (action === 'add' && !currentList.includes(value)) {
          newList = [...currentList, value];
        } else if (action === 'remove') {
          newList = currentList.filter(item => item !== value);
        }
        
        return {
          projectIgnore: { ...state.projectIgnore, [type]: newList }
        };
      }),
      
      resetProjectIgnore: () => set({ projectIgnore: DEFAULT_PROJECT_IGNORE }),

      // 核心：递归勾选
      toggleSelect: (nodeId, checked) => set((state) => ({
        fileTree: updateNodeState(state.fileTree, nodeId, checked)
      })),
    }),
    {
      name: 'context-config', // 对应 context-config.json
      storage: createJSONStorage(() => fileStorage),
      // 过滤：只持久化 projectIgnore
      partialize: (state) => ({
        projectIgnore: state.projectIgnore
      }),
    }
  )
);