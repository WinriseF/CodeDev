import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { fileStorage } from '@/lib/storage';
import { Prompt, DEFAULT_GROUP, PackManifest, PackManifestItem } from '@/types/prompt';
import { fetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';

const MANIFEST_URLS = [
    'https://raw.githubusercontent.com/WinriseF/Code-Forge-AI/main/build/dist/manifest.json', 
    'https://gitee.com/winriseF/models/raw/master/build/dist/manifest.json' 
];

const getBaseUrl = (manifestUrl: string) => {
    return manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
};

const PAGE_SIZE = 20;

interface PromptState {
  // --- 数据显示层 ---
  prompts: Prompt[];      // 当前列表显示的指令（混合了本地和官方）
  groups: string[];       // 分组列表
  
  // --- 分页与状态 ---
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  
  // --- 过滤条件 ---
  activeGroup: string;
  searchQuery: string;

  // --- 商店相关 ---
  isStoreLoading: boolean;
  manifest: PackManifest | null;
  activeManifestUrl: string;
  installedPackIds: string[];

  // --- Actions ---
  initStore: () => Promise<void>; // 初始化：加载分组
  
  // 核心加载方法：reset=true 表示重新搜索/切换分组，false 表示加载下一页
  loadPrompts: (reset?: boolean) => Promise<void>;
  
  setSearchQuery: (query: string) => void;
  setActiveGroup: (group: string) => void;

  // 增删改（调用 Rust）
  addPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'source'>) => Promise<void>;
  updatePrompt: (id: string, data: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  // 分组管理
  refreshGroups: () => Promise<void>;
  deleteGroup: (name: string) => Promise<void>; // 数据库模式下，删除分组通常意味着删除该组下所有 Prompts，或者更新它们的组名为 Default

  // 商店
  fetchManifest: () => Promise<void>;
  installPack: (pack: PackManifestItem) => Promise<void>;
  uninstallPack: (packId: string) => Promise<void>;
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      prompts: [],
      groups: [DEFAULT_GROUP],
      page: 1,
      hasMore: true,
      isLoading: false,
      
      activeGroup: 'all',
      searchQuery: '',
      
      isStoreLoading: false,
      manifest: null,
      activeManifestUrl: MANIFEST_URLS[0],
      installedPackIds: [],

      // 初始化：只加载分组列表，数据由 UI 组件挂载时调用 loadPrompts 获取
      initStore: async () => {
        await get().refreshGroups();
      },

      refreshGroups: async () => {
        try {
            const groups = await invoke<string[]>('get_prompt_groups');
            // 确保 Default 始终在列表前列（如果业务需要）
            const uniqueGroups = Array.from(new Set([DEFAULT_GROUP, ...groups]));
            set({ groups: uniqueGroups });
        } catch (e) {
            console.error("Failed to fetch groups:", e);
        }
      },

      loadPrompts: async (reset = false) => {
        const state = get();
        if (state.isLoading) return;

        const currentPage = reset ? 1 : state.page;
        set({ isLoading: true });

        try {
            let newPrompts: Prompt[] = [];
            
            // 根据是否有搜索词，决定调用哪个 Rust 接口
            if (state.searchQuery.trim()) {
                newPrompts = await invoke('search_prompts', {
                    query: state.searchQuery,
                    page: currentPage,
                    pageSize: PAGE_SIZE
                });
            } else {
                newPrompts = await invoke('get_prompts', {
                    page: currentPage,
                    pageSize: PAGE_SIZE,
                    group: state.activeGroup
                });
            }

            set((prev) => ({
                prompts: reset ? newPrompts : [...prev.prompts, ...newPrompts],
                page: currentPage + 1,
                hasMore: newPrompts.length === PAGE_SIZE, // 如果返回数量小于页大小，说明没数据了
                isLoading: false
            }));
        } catch (e) {
            console.error("Failed to load prompts:", e);
            set({ isLoading: false });
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        // 搜索词变化，必须重置列表
        get().loadPrompts(true);
      },

      setActiveGroup: (group) => {
        set({ activeGroup: group });
        // 分组变化，必须重置列表
        get().loadPrompts(true);
      },

      addPrompt: async (data) => {
        const newPrompt: Prompt = {
            id: uuidv4(),
            ...data,
            isFavorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'local'
        };
        // 调用 Rust 保存
        await invoke('save_prompt', { prompt: newPrompt });
        
        // 乐观更新 UI 或重新加载
        // 这里选择重新加载以确保排序正确
        get().loadPrompts(true);
        get().refreshGroups();
      },

      updatePrompt: async (id, data) => {
        const { prompts } = get();
        const existing = prompts.find(p => p.id === id);
        if (!existing) return;

        const updated: Prompt = { ...existing, ...data, updatedAt: Date.now() };
        await invoke('save_prompt', { prompt: updated });
        
        // 乐观更新本地 List，避免刷新闪烁
        set({
            prompts: prompts.map(p => p.id === id ? updated : p)
        });
        
        // 如果修改了分组，可能需要刷新分组列表
        if (data.group) get().refreshGroups();
      },

      deletePrompt: async (id) => {
        await invoke('delete_prompt', { id });
        set(state => ({
            prompts: state.prompts.filter(p => p.id !== id)
        }));
      },

      toggleFavorite: async (id) => {
        await invoke('toggle_prompt_favorite', { id });
        set(state => ({
            prompts: state.prompts.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)
        }));
      },

      // 在数据库模式下，删除分组通常不是一个显式操作，
      // 因为分组是基于 prompts 表中 group 字段聚合的。
      // 这里我们可以实现为：将该组所有 prompt 移动到 'Default'
      deleteGroup: async (name) => {
        // 由于 Rust 端目前没有批量更新的 API，
        // 这里暂时在前端遍历更新（如果量大建议增加 Rust 端 batch_update_group 接口）
        // 为了简化，这里先只从前端状态移除，并重置视图。
        // 实际业务中，可能需要实现 Rust 端的 delete_group_prompts 或 rename_group
        // 暂时简单处理：切换回 all 分组
        if (get().activeGroup === name) {
            get().setActiveGroup('all');
        }
        // 真正的删除需要 Rust 支持，或者用户手动删除该组下所有指令后，组自然消失
      },

      fetchManifest: async () => {
        set({ isStoreLoading: true });
        const fetchOne = async (url: string) => {
             const res = await fetch(url, { method: 'GET' });
             if (res.ok) {
                const data = await res.json() as PackManifest;
                return { data, url };
             }
             throw new Error("Failed");
        };

        try {
            const result = await Promise.any(MANIFEST_URLS.map(url => fetchOne(url)));
            set({ 
                manifest: result.data, 
                activeManifestUrl: result.url 
            });
        } catch (e) {
            console.error("Failed to fetch manifest", e);
        } finally {
            set({ isStoreLoading: false });
        }
      },

      installPack: async (pack) => {
        set({ isStoreLoading: true });
        try {
            const baseUrl = getBaseUrl(get().activeManifestUrl);
            const url = `${baseUrl}${pack.url}`;
            console.log(`Downloading pack from ${url}`);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            
            const data = await response.json() as Prompt[];
            if (!Array.isArray(data)) throw new Error("Invalid pack format");

            // 核心改变：下载后直接存入 SQLite，不写本地文件
            await invoke('import_prompt_pack', { 
                packId: pack.id, 
                prompts: data 
            });

            // 更新已安装列表
            set(state => ({
                installedPackIds: Array.from(new Set([...state.installedPackIds, pack.id]))
            }));
            
            // 刷新数据
            get().loadPrompts(true);
            get().refreshGroups();
            
        } catch (e) {
            console.error("Install failed:", e);
            throw e;
        } finally {
            set({ isStoreLoading: false });
        }
      },

      uninstallPack: async (packId) => {
        set({ isStoreLoading: true });
        try {
            // Rust 的 import_prompt_pack 支持覆盖，但删除需要专用接口
            // 实际上，我们可以在 Rust 端加一个 delete_pack_prompts
            // 这里为了简单，我们假设 import_prompt_pack 传入空数组就是删除？
            // 不，我们在 db.rs 实现了 `import_prompt_pack` 会先 delete 再 insert
            // 所以传入空数组确实可以达到删除效果：
            await invoke('import_prompt_pack', { 
                packId: packId, 
                prompts: [] // 空数组，等于清空该 pack_id 的数据
            });

            set(state => ({
                installedPackIds: state.installedPackIds.filter(id => id !== packId)
            }));
            
            get().loadPrompts(true);
            get().refreshGroups();
        } catch (e) {
            console.error("Uninstall failed:", e);
        } finally {
            set({ isStoreLoading: false });
        }
      }
    }),
    {
      name: 'prompts-data',
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({
        // 只持久化配置类数据，prompts 列表不持久化（每次从 DB 拉取）
        installedPackIds: state.installedPackIds,
        activeGroup: state.activeGroup 
      }),
    }
  )
);