import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useScreenshotStore } from '@/store/useScreenshotStore';
import { CanvasLayer } from '@/components/screenshot/CanvasLayer';

const appWindow = getCurrentWebviewWindow();

export default function ScreenshotApp() {
  const { imageSrc, setImage, reset } = useScreenshotStore();
  const [loading, setLoading] = useState(true);

  // ADDED: Effect to clean up Blob URLs to prevent memory leaks
  useEffect(() => {
    // This function will be called when the component unmounts or when imageSrc changes.
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
        console.log('🧹 Cleaned up blob URL:', imageSrc);
      }
    };
  }, [imageSrc]);

  useEffect(() => {
    document.addEventListener('contextmenu', e => e.preventDefault());

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await appWindow.hide();
        reset(); // This will also trigger the cleanup effect above
        setLoading(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // MODIFIED: The core logic is now based on the window's focus event
    const unlistenPromise = appWindow.onFocusChanged(async ({ payload: isFocused }) => {
        // Only trigger capture if the window becomes focused AND there's no image yet
        if (isFocused && !imageSrc) {
            setLoading(true);
            try {
                console.log('[Frontend] Invoking "capture_screen" to get PNG data...');
                
                // 1. Invoke the Rust command. It returns a number array (JS representation of Vec<u8>).
                const imageDataArray = await invoke<number[]>('capture_screen');
                
                if (imageDataArray && imageDataArray.length > 0) {
                    // 2. Convert the number array into a Uint8Array.
                    const uint8Array = new Uint8Array(imageDataArray);

                    // 3. Create a Blob from the Uint8Array with the correct MIME type.
                    const blob = new Blob([uint8Array], { type: 'image/png' });

                    // 4. Create a temporary, local URL for the Blob.
                    const objectUrl = URL.createObjectURL(blob);

                    console.log('🖼️ PNG Blob URL created successfully:', objectUrl);
                    setImage(objectUrl);
                } else {
                   console.error("[Frontend] Received empty or invalid image data from backend.");
                }
            } catch (err) {
                console.error('[Frontend] Failed to invoke "capture_screen" or process data:', err);
            } finally {
                setLoading(false);
            }
        }
    });

    return () => {
      unlistenPromise.then(fn => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageSrc, setImage, reset]); // Dependencies for the main effect

  return (
    <div className="w-screen h-screen relative overflow-hidden select-none bg-transparent">
       {!loading && <CanvasLayer />}
    </div>
  );
}