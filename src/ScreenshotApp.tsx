import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useScreenshotStore } from '@/store/useScreenshotStore';
import { CanvasLayer } from '@/components/screenshot/CanvasLayer';
import { Loader2 } from 'lucide-react';

const appWindow = getCurrentWebviewWindow();

// 定义 Rust 返回的数据结构
interface CaptureResult {
  width: number;
  height: number;
  base64: string;
  scale_factor: number;
}

export default function ScreenshotApp() {
  const { setImage, reset } = useScreenshotStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. 禁用右键
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. 监听 ESC 退出
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await appWindow.hide();
        reset(); // 清理状态
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 3. 监听窗口获得焦点（意味着截图快捷键被按下了）
    // 注意：Tauri 的 onFocusChanged 返回的是 UnlistenFn
    const unlistenPromise = appWindow.onFocusChanged(async ({ payload: isFocused }) => {
      if (isFocused) {
        setLoading(true);
        setError('');
        try {
          // 主动拉取截图数据
          const result = await invoke<CaptureResult>('get_current_screenshot');
          setImage(result.base64);
          setLoading(false);
        } catch (err) {
          console.error('Failed to get screenshot:', err);
          setError(String(err));
          // 如果获取失败（比如还没截图），可以尝试直接 hide，或者显示错误
          // await appWindow.hide(); 
        }
      }
    });

    return () => {
      unlistenPromise.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent relative overflow-hidden select-none">
       {/* Canvas 层 */}
       <CanvasLayer />

       {/* 加载/错误 提示层 */}
       {(loading || error) && (
         <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm text-white">
            {error ? (
              <div className="bg-red-500/80 px-4 py-2 rounded text-sm font-medium">
                Screenshot Error: {error}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                 <Loader2 className="animate-spin" size={32} />
                 <span className="text-xs font-mono opacity-80">Capturing...</span>
              </div>
            )}
         </div>
       )}
    </div>
  );
}