import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { useScreenshotStore } from '@/store/useScreenshotStore';
import { CanvasLayer } from '@/components/screenshot/CanvasLayer';

const appWindow = getCurrentWebviewWindow();

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

    const unlistenPromise = listen('capture-taken', (_event) => {
        console.log('✅ [Event] Capture received');
        
        const memoryUrl = `https://upload.localhost/screenshot?t=${Date.now()}`;
        
        console.log('🔗 [Url] Loading:', memoryUrl);
        
        // 预加载一下，确保图片有效再显示
        const img = new Image();
        img.onload = () => {
            console.log("🖼️ Image preloaded success");
            setImage(memoryUrl);
            setLoading(false);
        };
        img.onerror = (err) => {
            console.error("❌ Image load failed:", err);
            setImage(`upload://screenshot?t=${Date.now()}`);
            setLoading(false);
        };
        img.src = memoryUrl;
    });

    return () => {
      unlistenPromise.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="w-screen h-screen relative overflow-hidden select-none bg-transparent">
       {!loading && <CanvasLayer />}
    </div>
  );
}