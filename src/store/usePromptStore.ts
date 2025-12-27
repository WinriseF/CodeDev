import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { fileStorage } from '@/lib/storage';
import { Prompt, DEFAULT_GROUP, PackManifest, PackManifestItem } from '@/types/prompt';
import { fetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';
import { exists, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

const MANIFEST_URLS = [
    'https://raw.githubusercontent.com/WinriseF/Code-Forge-AI/main/build/dist/manifest.json', 
    'https://gitee.com/winriseF/models/raw/master/build/dist/manifest.json' 
];

const getBaseUrl = (manifestUrl: string) => {
    return manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
};

const PAGE_SIZE = 20;
const LEGACY_STORE_FILE = 'prompts-data.json';

interface PromptState {
  // --- 数据显示层 ---
  prompts: Prompt[];
  groups: string[];
  
  // --- 分页与状态 ---
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  
  // --- 过滤条件 ---
  activeGroup: string;
  activeCategory: 'command' | 'prompt'; 
  searchQuery: string;

  // --- 商店相关 ---
  isStoreLoading: boolean;
  manifest: PackManifest | null;
  activeManifestUrl: string;
  installedPackIds: string[];

  // --- 迁移控制 ---
  migrationVersion: number;

  // --- Actions ---
  initStore: () => Promise<void>;
  migrateLegacyData: () => Promise<void>;
  
  loadPrompts: (reset?: boolean) => Promise<void>;
  
  setSearchQuery: (query: string) => void;
  setActiveGroup: (group: string) => void;
  setActiveCategory: (category: 'command' | 'prompt') => void;

  addPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'source'>) => Promise<void>;
  updatePrompt: (id: string, data: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  refreshGroups: () => Promise<void>;
  deleteGroup: (name: string) => Promise<void>; 

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
      activeCategory: 'prompt', 
      searchQuery: '',
      
      isStoreLoading: false,
      manifest: null,
      activeManifestUrl: MANIFEST_URLS[0],
      installedPackIds: [],
      migrationVersion: 0,

      initStore: async () => {
        await get().migrateLegacyData();
        await get().refreshGroups();
      },

      migrateLegacyData: async () => {
        const { migrationVersion } = get();
        if (migrationVersion >= 1) return;

        console.log('[Migration] Checking for legacy data...');
        const baseDir = BaseDirectory.AppLocalData;

        try {
            if (await exists(LEGACY_STORE_FILE, { baseDir })) {
                const content = await readTextFile(LEGACY_STORE_FILE, { baseDir });
                const parsed = JSON.parse(content);
                const legacyState = parsed?.state || {};
                
                const legacyPrompts = legacyState.localPrompts;
                if (Array.isArray(legacyPrompts) && legacyPrompts.length > 0) {
                    console.log(`[Migration] Found ${legacyPrompts.length} legacy prompts. Importing...`);
                    
                    const promptsToImport: Prompt[] = legacyPrompts.map((p: any) => ({
                        id: p.id || uuidv4(),
                        title: p.title || 'Untitled',
                        content: p.content || '',
                        group: p.group || DEFAULT_GROUP,
                        description: p.description || null,
                        tags: Array.isArray(p.tags) ? p.tags : [],
                        isFavorite: !!p.isFavorite,
                        createdAt: p.createdAt || Date.now(),
                        updatedAt: p.updatedAt || Date.now(),
                        source: 'local',
                        
                        // 修复: 将 null 改为 undefined 以通过类型检查
                        packId: undefined, 
                        originalId: undefined,
                        type: p.type || undefined,
                        isExecutable: !!p.isExecutable,
                        shellType: p.shellType || undefined
                    }));

                    await invoke('batch_import_local_prompts', { prompts: promptsToImport });
                }
            }
        } catch (e) {
            console.error('[Migration] Failed:', e);
        } finally {
            set({ migrationVersion: 1 });
            console.log('[Migration] Completed.');
        }
      },

      refreshGroups: async () => {
        try {
            const groups = await invoke<string[]>('get_prompt_groups');
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
            
            if (state.searchQuery.trim()) {
                newPrompts = await invoke('search_prompts', {
                    query: state.searchQuery,
                    page: currentPage,
                    pageSize: PAGE_SIZE,
                    category: state.activeCategory 
                });
            } else {
                newPrompts = await invoke('get_prompts', {
                    page: currentPage,
                    pageSize: PAGE_SIZE,
                    group: state.activeGroup,
                    category: state.activeCategory 
                });
            }

            set((prev) => ({
                prompts: reset ? newPrompts : [...prev.prompts, ...newPrompts],
                page: currentPage + 1,
                hasMore: newPrompts.length === PAGE_SIZE,
                isLoading: false
            }));
        } catch (e) {
            console.error("Failed to load prompts:", e);
            set({ isLoading: false });
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().loadPrompts(true);
      },

      setActiveGroup: (group) => {
        set({ activeGroup: group });
        get().loadPrompts(true);
      },

      setActiveCategory: (category) => {
        set({ activeCategory: category, activeGroup: 'all' }); 
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
        await invoke('save_prompt', { prompt: newPrompt });
        
        get().loadPrompts(true);
        get().refreshGroups();
      },

      updatePrompt: async (id, data) => {
        const { prompts } = get();
        const existing = prompts.find(p => p.id === id);
        if (!existing) return;

        const updated: Prompt = { ...existing, ...data, updatedAt: Date.now() };
        await invoke('save_prompt', { prompt: updated });
        
        set({
            prompts: prompts.map(p => p.id === id ? updated : p)
        });
        
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

      deleteGroup: async (name) => {
        if (get().activeGroup === name) {
            get().setActiveGroup('all');
        }
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
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);

            const rawData = await response.json();
            if (!Array.isArray(rawData)) throw new Error("Invalid pack format");

            const enrichedPrompts: any[] = rawData.map((p: any) => ({
                id: p.id ? `${pack.id}-${p.id}` : uuidv4(),
                title: p.title || "Untitled",
                content: p.content || "",
                group: p.group || DEFAULT_GROUP,
                description: p.description || null,
                tags: p.tags || [],
                isFavorite: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'official',
                packId: pack.id,
                originalId: p.id || null,
                type: p.type || null,
                isExecutable: !!p.isExecutable,
                shellType: p.shellType || null
            }));

            await invoke('import_prompt_pack', {
                packId: pack.id,
                prompts: enrichedPrompts
            });

            set(state => ({
                installedPackIds: Array.from(new Set([...state.installedPackIds, pack.id]))
            }));

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
            await invoke('import_prompt_pack', {
                packId: packId,
                prompts: []
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
        installedPackIds: state.installedPackIds,
        activeGroup: state.activeGroup,
        activeCategory: state.activeCategory,
        migrationVersion: state.migrationVersion
      }),
    }
  )
);