import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useScreenshotStore } from '@/store/useScreenshotStore';

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
      selection: false, // 暂时关闭多选框，由我们自己接管交互
      renderOnAddRemove: true,
    });

    fabricRef.current = canvas;

    // 窗口大小改变时重置画布 (防止多屏切换问题)
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

  // 2. 监听图片变化，加载背景图
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageSrc) return;

    fabric.FabricImage.fromURL(imageSrc).then((img) => {
      // 适配高分屏 DPI，确保图片清晰
      // 注意：xcap 返回的是物理像素，Web 是逻辑像素，通常不需要手动缩放，
      // 除非我们后续处理 scale_factor。这里先按 1:1 铺满。
      
      // 强制图片铺满窗口
      img.scaleToWidth(window.innerWidth);
      img.scaleToHeight(window.innerHeight);
      
      canvas.backgroundImage = img;
      canvas.requestRenderAll();
      
      console.log('Screenshot loaded to canvas');
      setMode('SELECTING'); // 图片加载完，进入选区模式
    });

  }, [imageSrc, setMode]);

  return (
    <canvas ref={canvasEl} className="absolute inset-0 z-10" />
  );
}