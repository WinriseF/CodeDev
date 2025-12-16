import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useScreenshotStore } from '@/store/useScreenshotStore';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const appWindow = getCurrentWebviewWindow();

export function CanvasLayer() {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const { imageSrc, setMode } = useScreenshotStore();

  // 1. 初始化 Fabric Canvas
  useEffect(() => {
    if (!canvasEl.current) return;

    const canvas = new fabric.Canvas(canvasEl.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: false,
      renderOnAddRemove: true,
      enableRetinaScaling: true, // 自动处理 DPI
    });

    fabricRef.current = canvas;

    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // 2. 监听图片变化，加载并显示窗口
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageSrc) return;

    // 清除旧内容，防止叠加
    canvas.clear();

    fabric.FabricImage.fromURL(imageSrc).then((img) => {
      const dpr = window.devicePixelRatio || 1;
      
      // 反向缩放以适配逻辑像素
      const scale = 1 / dpr;

      img.scaleX = scale;
      img.scaleY = scale;
      img.left = 0;
      img.top = 0;
      
      // 设置为背景图的属性：不可选、不触发事件
      img.selectable = false;
      img.evented = false;

      canvas.add(img);
      canvas.sendObjectToBack(img);
      
      // 强制立即渲染
      canvas.requestRenderAll();
      
      setMode('SELECTING'); 

      // --- 关键：渲染完成后，显示窗口 ---
      setTimeout(async () => {
          await appWindow.show();
          await appWindow.setFocus();
          console.log("Window shown after render");
      }, 0);
    });

  }, [imageSrc, setMode]);

  return (
    <canvas ref={canvasEl} className="absolute inset-0 z-10" />
  );
}