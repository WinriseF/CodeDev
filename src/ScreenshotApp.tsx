import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const appWindow = getCurrentWebviewWindow();

export default function ScreenshotApp() {
  useEffect(() => {
    // 1. 禁用默认右键菜单
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. 基础按键监听
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 按 ESC 隐藏窗口，模拟取消截图
        await appWindow.hide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    // 3. 全屏容器，准备放置 Canvas 图层
    <div className="w-screen h-screen bg-transparent relative overflow-hidden select-none">
       {/* 暂时放一个占位符，证明窗口已成功加载 */}
       <div className="absolute top-10 left-10 bg-black/70 text-white px-4 py-2 rounded text-sm pointer-events-none">
          Screenshot Layer Ready (Press ESC to close)
       </div>
    </div>
  );
}