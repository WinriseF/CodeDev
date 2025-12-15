import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { sendNotification } from '@tauri-apps/plugin-notification'; 

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
  // 解构出 setTheme
  const { currentView, theme, setTheme, syncModels, lastUpdated, spotlightShortcut, restReminder, language } = useAppStore();
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRestTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // 1. 初始化 DOM 类名 (防止刚启动时颜色不对)
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // 2. 监听来自 Spotlight 的主题变化
    // 当 Spotlight 改变主题时，主窗口也需要同步更新，且传入 true 防止死循环广播
    const unlistenPromise = listen<AppTheme>('theme-changed', (event) => {
        setTheme(event.payload, true); 
    });

    // 优雅显示窗口 (防闪白)
    // 延迟 100ms 确保 CSS 渲染完毕，再把原本隐藏(visible: false)的窗口显示出来
    setTimeout(() => {
        appWindow.show();
        appWindow.setFocus();
    }, 100);

    return () => {
        unlistenPromise.then(unlisten => unlisten());
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  useEffect(() => {
    // 只有在 main 窗口才执行此逻辑，避免 spotlight 窗口重复注册
    if (appWindow.label !== 'main') return;
    const setupShortcut = async () => {
      try {
        // 1. 清除所有旧的快捷键，防止冲突
        await unregisterAll();
        if (!spotlightShortcut) return; // 如果用户清空了快捷键，就不注册
        // 2. 注册新的快捷键
        await register(spotlightShortcut, async (event) => {
          if (event.state === 'Pressed') {
            // 查找 spotlight 窗口
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
        console.log(`[Shortcut] Registered: ${spotlightShortcut}`);
      } catch (err) {
        console.error('[Shortcut] Registration failed:', err);
      }
    };

    setupShortcut();
    return () => {
      // unregisterAll(); 
    };
  }, [spotlightShortcut]); // 当快捷键设置改变时重新执行

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
    // 清除旧的定时器
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    // 如果未启用，直接返回
    if (!restReminder.enabled || restReminder.intervalMinutes <= 0) {
      return;
    }

    const intervalMs = restReminder.intervalMinutes * 60 * 1000;

    // 计算下次提醒时间
    const scheduleNextReminder = () => {
      const now = Date.now();
      const timeSinceLastRest = now - lastRestTimeRef.current;
      
      // 如果距离上次提醒已经超过间隔时间，立即提醒
      if (timeSinceLastRest >= intervalMs) {
        showRestNotification();
        lastRestTimeRef.current = now;
      }

      // 设置定时器，每间隔时间提醒一次
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

    // 初始化定时器
    scheduleNextReminder();

    // 清理函数
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