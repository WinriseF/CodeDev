import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useScreenshotStore } from '@/store/useScreenshotStore';

export function CanvasLayer() {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const { imageSrc, setMode } = useScreenshotStore();
  
  // 这是一个用来做全屏遮罩的矩形
  const overlayRef = useRef<fabric.Rect | null>(null);

  useEffect(() => {
    if (!canvasEl.current) return;

    // 初始化 Fabric Canvas
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: false, // 初始不启用框选，等逻辑处理好
      renderOnAddRemove: true,
      enableRetinaScaling: true,
      backgroundColor: 'transparent', // 背景透明，让底下的 img 透出来
    });

    fabricRef.current = canvas;

    // 创建一个全屏半透明黑色遮罩
    const overlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        fill: 'rgba(0, 0, 0, 0.3)', // 30% 黑色遮罩
        selectable: false,
        evented: false, // 让事件穿透到 canvas 本身
    });
    canvas.add(overlay);
    overlayRef.current = overlay;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.setDimensions({ width: w, height: h });
      overlay.set({ width: w, height: h });
      canvas.requestRenderAll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // 监听图片源变化
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageSrc) return;

    // 确保遮罩在最底层
    if (overlayRef.current) {
        canvas.bringObjectToFront(overlayRef.current);
    }

    setMode('SELECTING');
    canvas.requestRenderAll();

  }, [imageSrc, setMode]);

  if (!imageSrc) return null;

  return (
    <>
      {/* 层级 1: 原生图片层 (性能最高) */}
      <img 
        src={imageSrc} 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        alt="screenshot-bg"
        draggable={false}
      />
      
      {/* 层级 2: Fabric 交互层 (背景透明) */}
      <div className="absolute inset-0 z-10">
          <canvas ref={canvasEl} />
      </div>
    </>
  );
}