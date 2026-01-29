import { useEffect, Suspense, lazy } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useAppStore, AppTheme } from "@/store/useAppStore";
import { GlobalConfirmDialog } from "@/components/ui/GlobalConfirmDialog";
import { getText } from '@/lib/i18n';
import { PreviewModal } from "@/components/features/hyperview";
const PromptView = lazy(() => import('@/components/features/prompts/PromptView').then(module => ({ default: module.PromptView })));
const ContextView = lazy(() => import('@/components/features/context/ContextView').then(module => ({ default: module.ContextView })));
const PatchView = lazy(() => import('@/components/features/patch/PatchView').then(module => ({ default: module.PatchView })));
const SystemMonitorModal = lazy(() => import('@/components/features/monitor/SystemMonitorModal').then(module => ({ default: module.SystemMonitorModal })));

const appWindow = getCurrentWebviewWindow()

function App() {
  const { currentView, theme, setTheme, syncModels, lastUpdated, restReminder, language } = useAppStore();

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

  // [新增] 将休息提醒配置同步到 Rust 后端
  // 当配置在 SettingsModal 中被修改，或应用启动时，此 Effect 会自动触发
  useEffect(() => {
    invoke('update_reminder_config', {
      enabled: restReminder.enabled,
      intervalMinutes: restReminder.intervalMinutes // Tauri 会自动映射为 Rust 的 interval_minutes
    }).catch(err => {
      console.error("Failed to sync reminder config to backend:", err);
    });
  }, [restReminder.enabled, restReminder.intervalMinutes]);

  return (
    <>
      <style>{`
        body.reduce-performance * {
          animation-play-state: paused !important;
        }
      `}</style>
      <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col rounded-lg border border-border transition-colors duration-300 relative shadow-2xl">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 relative transition-colors duration-300">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 animate-in fade-in">
                <Loader2 className="animate-spin text-primary" size={32} />
                <span className="text-sm">{getText('common', 'loadingModule', language)}</span>
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
      <PreviewModal />
      <GlobalConfirmDialog />
    </div>
    </>
  );
}

export default App;
