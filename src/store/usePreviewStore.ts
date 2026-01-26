import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { FileMeta } from '@/types/hyperview';

interface PreviewState {
  isOpen: boolean;
  isLoading: boolean;
  activeFile: FileMeta | null;
  error: string | null;

  openPreview: (path: string) => Promise<void>;
  closePreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  isOpen: false,
  isLoading: false,
  activeFile: null,
  error: null,

  openPreview: async (path: string) => {
    set({ isOpen: true, isLoading: true, error: null, activeFile: null });

    try {
      // 调用我们在 Rust 后端写的 hyperview::get_file_meta
      const meta = await invoke<FileMeta>('get_file_meta', { path });
      set({ activeFile: meta, isLoading: false });
    } catch (err: any) {
      console.error("Preview failed:", err);
      set({ error: String(err), isLoading: false });
    }
  },

  closePreview: () => {
    set({ isOpen: false, activeFile: null });
  }
}));
