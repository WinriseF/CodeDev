import { useEffect, useLayoutEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { message } from '@tauri-apps/plugin-dialog';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';

import { useAppStore, AppTheme } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore';
import { getText } from '@/lib/i18n';
import { parseVariables } from '@/lib/template';
import { executeCommand } from '@/lib/command_executor';
import { GlobalConfirmDialog } from "@/components/ui/GlobalConfirmDialog";

import { SpotlightProvider, useSpotlight } from '@/components/features/spotlight/core/SpotlightContext';
import { SpotlightLayout } from '@/components/features/spotlight/core/SpotlightLayout';
import { SearchBar } from '@/components/features/spotlight/core/SearchBar';

import { useSpotlightSearch } from '@/components/features/spotlight/hooks/useSpotlightSearch';
import { useSpotlightChat } from '@/components/features/spotlight/hooks/useSpotlightChat';
import { SearchMode } from '@/components/features/spotlight/modes/search/SearchMode';
import { ChatMode } from '@/components/features/spotlight/modes/chat/ChatMode';
import { SpotlightItem } from '@/types/spotlight';
import { ShellType } from '@/types/prompt';

const appWindow = getCurrentWebviewWindow();

function SpotlightContent() {
  const { mode, toggleMode, focusInput, setQuery } = useSpotlight();
  const { language, spotlightAppearance } = useAppStore();
  const { projectRoot } = useContextStore();

  const search = useSpotlightSearch(language);
  const chat = useSpotlightChat();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: isFocused }) => {
      if (isFocused) {
        focusInput();
      }
    });
    return () => { unlisten.then(f => f()); };
  }, [focusInput]);

  useLayoutEffect(() => {
    const { width, defaultHeight, maxChatHeight } = spotlightAppearance;
    const safeMaxChatHeight = Math.max(maxChatHeight, defaultHeight);
    let finalHeight = defaultHeight;
    if (mode === 'search') {
      finalHeight = defaultHeight;
    } else {
      if (chat.messages.length > 0) {
        finalHeight = safeMaxChatHeight;
      } else {
        finalHeight = defaultHeight;
      }
    }
    
    appWindow.setSize(new LogicalSize(width, finalHeight));
  }, [mode, chat.messages.length, spotlightAppearance]);

  const handleItemSelect = async (item: SpotlightItem) => {
    if (!item) return;

    if (item.type === 'app' && item.appPath) {
        try {
            await invoke('open_app', { path: item.appPath });
            await appWindow.hide();
            setQuery('');
        } catch (e) {
            console.error("Failed to launch app:", e);
            await message(`Failed to launch: ${e}`, { kind: 'error' });
        }
        return;
    }

    if (item.type === 'url' && item.url) {
        try {
            await open(item.url);
            invoke('record_url_visit', { url: item.url }).catch(console.error);
            await appWindow.hide();
            setQuery(''); 
        } catch (e) {
            console.error("Failed to open URL:", e);
            await message(`Failed to open URL: ${e}`, { kind: 'error' });
        }
        return;
    }

    if (item.isExecutable || item.type === 'shell') {
      const content = item.content || '';
      const vars = parseVariables(content);
      if (vars.length > 0) {
        await message(getText('spotlight', 'commandHasVariables', language), {
          title: getText('spotlight', 'actionRequired', language),
          kind: 'info'
        });
        return;
      }

      await executeCommand(content, (item.shellType as ShellType) || 'auto', projectRoot);
      await appWindow.hide();
      setQuery('');
    } else {
      try {
        await writeText(item.content || '');
        setCopiedId(item.id);

        setTimeout(async () => {
          await appWindow.hide();
          setCopiedId(null);
          if (item.type === 'math') {
            setQuery('');
          }
        }, 300);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        toggleMode();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        await appWindow.hide();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (mode === 'chat' && !chat.isStreaming) {
          chat.clearChat();
        }
        return;
      }

      if (mode === 'search') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            search.handleNavigation(e);
            return;
        }
        
        if (e.key === 'Enter') {
          e.preventDefault();
          const item = search.results[search.selectedIndex];
          if (item) handleItemSelect(item);
        }
      } else {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chat.sendMessage();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    mode, 
    search.results, 
    search.selectedIndex, 
    chat.isStreaming, 
    chat.sendMessage, 
    toggleMode
  ]);

  return (
    <SpotlightLayout 
      header={<SearchBar />}
      resultCount={search.results.length}
      isStreaming={chat.isStreaming}
    >
      {mode === 'search' ? (
        <SearchMode 
          results={search.results}
          selectedIndex={search.selectedIndex}
          setSelectedIndex={search.setSelectedIndex}
          onSelect={handleItemSelect}
          copiedId={copiedId}
        />
      ) : (
        <ChatMode 
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          chatEndRef={chat.chatEndRef}
        />
      )}
    </SpotlightLayout>
  );
}

export default function SpotlightApp() {
  const { setTheme, theme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    const unlistenPromise = appWindow.onFocusChanged(async ({ payload: isFocused }) => {
      if (isFocused) {
        await useAppStore.persist.rehydrate();
        await useContextStore.persist.rehydrate();
        appWindow.setFocus();
      } 
    });

    const themeUnlisten = listen<AppTheme>('theme-changed', (event) => {
        setTheme(event.payload, true); 
        root.classList.remove('light', 'dark');
        root.classList.add(event.payload);
    });

    return () => { 
        unlistenPromise.then(f => f());
        themeUnlisten.then(f => f());
    };
  }, []);

  return (
    <>
      <SpotlightProvider>
        <SpotlightContent />
      </SpotlightProvider>
      <GlobalConfirmDialog /> 
    </>
  );
}