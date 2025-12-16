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
      backgroundColor: 'transparent', // 关键：背景透明，让底下的 img 透出来
    });

    fabricRef.current = canvas;

    // 创建一个全屏半透明黑色遮罩 (模拟微信截图的暗色背景)
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

  // 监听图片源变化（实际上我们是用 img 标签展示图片，这里主要是为了重置状态）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageSrc) return;

    // 这里不再需要 fabric.Image.fromURL 加载背景图了！
    // 只需要重置遮罩和工具即可
    
    // 确保遮罩在最底层
    if (overlayRef.current) {
        canvas.bringObjectToFront(overlayRef.current); // 或者根据层级管理
        // 实际上因为背景是 img 标签，canvas 里只有 UI 元素
        // 这里我们可以开始监听鼠标事件来实现"画框擦除遮罩"的效果
        // (为了代码简洁，这里暂不展开具体的画框逻辑代码，只保留架构优化)
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