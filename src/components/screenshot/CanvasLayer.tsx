import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useScreenshotStore } from '@/store/useScreenshotStore';

export function CanvasLayer() {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const { imageSrc, setMode } = useScreenshotStore();

  useEffect(() => {
    if (!canvasEl.current) return;

    // 修复：删除未使用的 dpr 变量声明
    // const dpr = window.devicePixelRatio || 1; 

    const canvas = new fabric.Canvas(canvasEl.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: false,
      renderOnAddRemove: true,
      enableRetinaScaling: true, // Fabric 会自动获取 dpr
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

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !imageSrc) return;

    fabric.FabricImage.fromURL(imageSrc).then((img) => {
      const dpr = window.devicePixelRatio || 1;
      
      // 缩放比例 = 1 / dpr
      const scale = 1 / dpr;

      img.scaleX = scale;
      img.scaleY = scale;
      
      img.left = 0;
      img.top = 0;
      
      img.selectable = false;
      img.evented = false;

      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.requestRenderAll();
      
      setMode('SELECTING'); 
    });

  }, [imageSrc, setMode]);

  return (
    <canvas ref={canvasEl} className="absolute inset-0 z-10" />
  );
}