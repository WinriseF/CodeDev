import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { useScreenshotStore } from '@/store/useScreenshotStore';
import { CanvasLayer } from '@/components/screenshot/CanvasLayer';

const appWindow = getCurrentWebviewWindow();

// 修改接口定义
interface CaptureResult {
  width: number;
  height: number;
  image_bytes: number[]; // Rust Vec<u8> 在 JS 里是数字数组
  scale_factor: number;
}

export default function ScreenshotApp() {
  const { setImage, reset } = useScreenshotStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.addEventListener('contextmenu', e => e.preventDefault());

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await appWindow.hide();
        reset(); 
        setLoading(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 监听二进制数据推送
    const unlistenPromise = listen<CaptureResult>('capture-taken', (event) => {
        console.log('Binary screenshot received, size:', event.payload.image_bytes.length);
        
        // 1. 将普通数组转换为 Uint8Array
        const uint8Array = new Uint8Array(event.payload.image_bytes);
        
        // 2. 创建 Blob 对象 (指定类型为 jpeg)
        const blob = new Blob([uint8Array], { type: 'image/bmp' });
        
        // 3. 生成内存 URL (速度极快，无需 Base64 解码)
        const url = URL.createObjectURL(blob);
        
        setImage(url);
        setLoading(false);
    });

    return () => {
      unlistenPromise.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div 
        className="w-screen h-screen relative overflow-hidden select-none"
        style={{ background: 'transparent' }}
    >
       <CanvasLayer />
       {loading && <div className="absolute inset-0 bg-transparent" />}
    </div>
  );
}