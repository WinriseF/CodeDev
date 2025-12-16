import { create } from 'zustand';

// 定义截图窗口的状态机
export type ScreenshotMode = 
  | 'IDLE'          // 空闲（等待图片加载）
  | 'SELECTING'     // 正在拖拽选区
  | 'SELECTED'      // 选区已确定（显示工具栏）
  | 'EDITING'       // 正在绘图
  | 'PROCESSING';   // OCR 或保存中

interface ScreenshotState {
  imageSrc: string | null;
  mode: ScreenshotMode;
  
  // 选区坐标 (物理像素)
  selection: { x: number; y: number; w: number; h: number } | null;
  
  // Actions
  setImage: (src: string) => void;
  setMode: (mode: ScreenshotMode) => void;
  setSelection: (rect: { x: number; y: number; w: number; h: number } | null) => void;
  reset: () => void;
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  imageSrc: null,
  mode: 'IDLE',
  selection: null,

  setImage: (src) => set({ imageSrc: src, mode: 'SELECTING' }), // 图片加载后默认进入选区模式
  setMode: (mode) => set({ mode }),
  setSelection: (selection) => set({ selection }),
  
  reset: () => set({ 
    imageSrc: null, 
    mode: 'IDLE', 
    selection: null 
  }),
}));