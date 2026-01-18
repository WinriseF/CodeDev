import { useEffect, useRef, Suspense, lazy } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { Loader2 } from 'lucide-react';
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useAppStore, AppTheme } from "@/store/useAppStore";
import { GlobalConfirmDialog } from "@/components/ui/GlobalConfirmDialog";
import { getText } from '@/lib/i18n';
const PromptView = lazy(() => import('@/components/features/prompts/PromptView').then(module => ({ default: module.PromptView })));
const ContextView = lazy(() => import('@/components/features/context/ContextView').then(module => ({ default: module.ContextView })));
const PatchView = lazy(() => import('@/components/features/patch/PatchView').then(module => ({ default: module.PatchView })));
const SystemMonitorModal = lazy(() => import('@/components/features/monitor/SystemMonitorModal').then(module => ({ default: module.SystemMonitorModal })));

const appWindow = getCurrentWebviewWindow()

function App() {
  const { currentView, theme, setTheme, syncModels, lastUpdated, spotlightShortcut, restReminder, language } = useAppStore();
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRestTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    const unlistenPromise = listen<AppTheme>('theme-changed', (event) => {
        setTheme(event.payload, true);
    });

    appWindow.show();
    appWindow.setFocus();

    return () => {
        unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      document.body.classList.add('reduce-performance');
    };
    const handleFocus = () => {
      document.body.classList.remove('reduce-performance');
    };

    const unlistenBlur = listen('tauri://blur', handleBlur);
    const unlistenFocus = listen('tauri://focus', handleFocus);

    return () => {
      unlistenBlur.then(unlisten => unlisten());
      unlistenFocus.then(unlisten => unlisten());
    };
  }, []);

  useEffect(() => {
    if (appWindow.label !== 'main') return;
    const setupShortcut = async () => {
      try {
        await unregisterAll();
        if (!spotlightShortcut) return;
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
        console.log(`[Shortcut] Registered: ${spotlightShortcut}`);
      } catch (err) {
        console.error('[Shortcut] Registration failed:', err);
      }
    };

    setupShortcut();
  }, [spotlightShortcut]);

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

  useEffect(() => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - lastUpdated > ONE_DAY) {
        syncModels();
    } else {
        syncModels();
    }
  }, []);

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
        const title = getText('spotlight', 'restReminder', language);
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
    <>
      <style>{`
        body.reduce-performance * {
          animation-play-state: paused !important;
        }
      `}</style>
      <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col rounded-xl border border-border transition-colors duration-300 relative shadow-2xl">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 relative transition-colors duration-300">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 animate-in fade-in">
                <Loader2 className="animate-spin text-primary" size={32} />
                <span className="text-sm">Loading module...</span>
            </div>
          }>
            {currentView === 'prompts' && <PromptView />}
            {currentView === 'context' && <ContextView />}
            {currentView === 'patch' && <PatchView />}
          </Suspense>
        </main>
      </div>
      <SettingsModal />
      <Suspense fallback={null}>
        <SystemMonitorModal />
      </Suspense>
      <GlobalConfirmDialog />
    </div>
    </>
  );
}

export default App;
