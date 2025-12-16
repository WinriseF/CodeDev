import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { invoke } from '@tauri-apps/api/core';

import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useAppStore, AppTheme } from "@/store/useAppStore";
import { PromptView } from '@/components/features/prompts/PromptView';
import { ContextView } from '@/components/features/context/ContextView';
import { PatchView } from '@/components/features/patch/PatchView';
import { GlobalConfirmDialog } from "@/components/ui/GlobalConfirmDialog";

const appWindow = getCurrentWebviewWindow()

function App() {
  const { 
    currentView, theme, setTheme, syncModels, lastUpdated, 
    spotlightShortcut, screenshotShortcut,
    restReminder, language 
  } = useAppStore();
  
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRestTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    const unlistenPromise = listen<AppTheme>('theme-changed', (event) => {
        setTheme(event.payload, true); 
    });

    setTimeout(() => {
        appWindow.show();
        appWindow.setFocus();
    }, 100);

    return () => {
        unlistenPromise.then(unlisten => unlisten());
    };
  }, []); 

  useEffect(() => {
    if (appWindow.label !== 'main') return;
    
    const setupShortcut = async () => {
      try {
        await unregisterAll();

        if (spotlightShortcut) { 
          await register(spotlightShortcut, async (event) => {
            if (event.state === 'Pressed') {
              const windows = await getAllWebviewWindows();
              const spotlight = windows.find(w => w.label === 'spotlight');
              if (spotlight) {
                const isVisible = await spotlight.isVisible();
                if (isVisible) {
                  await spotlight.hide();
                } else {
                  await spotlight.show();
                  await spotlight.setFocus();
                }
              }
            }
          });
        }

        if (screenshotShortcut) {
          await register(screenshotShortcut, async (event) => {
            if (event.state === 'Pressed') {
              console.log('[Shortcut] Screenshot triggered');
              try {
                // 调用 Rust 后端插件命令：plugin:screenshot|capture_screen
                await invoke('capture_screen');
              } catch (err) {
                console.error('Failed to trigger screenshot:', err);
              }
            }
          });
        }

        console.log(`[Shortcut] Registered: Spotlight(${spotlightShortcut}), Screenshot(${screenshotShortcut})`);
      } catch (err) {
        console.error('[Shortcut] Registration failed:', err);
      }
    };

    setupShortcut();
    return () => {
      // unregisterAll(); 
    };
  }, [spotlightShortcut, screenshotShortcut]); 

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (import.meta.env.PROD || !e.ctrlKey) {
        e.preventDefault();
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
        }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 启动时任务
  useEffect(() => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - lastUpdated > ONE_DAY) {
        syncModels();
    } else {
        syncModels();
    }
  }, []);

  // 休息提醒定时器
  useEffect(() => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    if (!restReminder.enabled || restReminder.intervalMinutes <= 0) {
      return;
    }

    const intervalMs = restReminder.intervalMinutes * 60 * 1000;

    const scheduleNextReminder = () => {
      const now = Date.now();
      const timeSinceLastRest = now - lastRestTimeRef.current;
      
      if (timeSinceLastRest >= intervalMs) {
        showRestNotification();
        lastRestTimeRef.current = now;
      }

      restTimerRef.current = setInterval(() => {
        showRestNotification();
        lastRestTimeRef.current = Date.now();
      }, intervalMs);
    };

    const showRestNotification = async () => {
      try {
        const title = language === 'zh' ? '休息提醒' : 'Rest Reminder';
        const body = language === 'zh' 
          ? `您已经工作了 ${restReminder.intervalMinutes} 分钟，建议休息一下！`
          : `You've been working for ${restReminder.intervalMinutes} minutes. Time to take a break!`;
        
        await sendNotification({
          title,
          body,
          sound: 'default'
        });
      } catch (err) {
        console.error('Failed to send rest reminder notification:', err);
      }
    };

    scheduleNextReminder();

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [restReminder.enabled, restReminder.intervalMinutes, language]);

  return (
    <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col rounded-xl border border-border transition-colors duration-300 relative shadow-2xl">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 relative transition-colors duration-300">
          {currentView === 'prompts' && <PromptView />}
          {currentView === 'context' && <ContextView />}
          {currentView === 'patch' && <PatchView />}
        </main>
      </div>
      <SettingsModal />
      <GlobalConfirmDialog /> 
    </div>
  );
}

export default App;