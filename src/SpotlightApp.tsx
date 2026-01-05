import { useEffect, useLayoutEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { message } from '@tauri-apps/plugin-dialog';

import { useAppStore, AppTheme } from '@/store/useAppStore';
import { useContextStore } from '@/store/useContextStore';
import { getText } from '@/lib/i18n';
import { parseVariables } from '@/lib/template';
import { executeCommand } from '@/lib/command_executor';
import { GlobalConfirmDialog } from "@/components/ui/GlobalConfirmDialog";

// Core Architecture
import { SpotlightProvider, useSpotlight } from '@/components/features/spotlight/core/SpotlightContext';
import { SpotlightLayout } from '@/components/features/spotlight/core/SpotlightLayout';
import { SearchBar } from '@/components/features/spotlight/core/SearchBar';

// Modes & Hooks
import { useSpotlightSearch } from '@/components/features/spotlight/hooks/useSpotlightSearch';
import { useSpotlightChat } from '@/components/features/spotlight/hooks/useSpotlightChat';
import { SearchMode } from '@/components/features/spotlight/modes/search/SearchMode';
import { ChatMode } from '@/components/features/spotlight/modes/chat/ChatMode';
import { SpotlightItem } from '@/types/spotlight';

const appWindow = getCurrentWebviewWindow();
const FIXED_HEIGHT = 106;
const MAX_WINDOW_HEIGHT = 460;

function SpotlightContent() {
  const { mode, toggleMode, focusInput } = useSpotlight();
  const { language, spotlightAppearance } = useAppStore();
  const { projectRoot } = useContextStore();

  // 挂载业务逻辑 Hooks
  const search = useSpotlightSearch();
  const chat = useSpotlightChat();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 监听窗口聚焦，自动聚焦输入框
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: isFocused }) => {
      if (isFocused) {
        focusInput();
      }
    });
    return () => { unlisten.then(f => f()); };
  }, [focusInput]);

  // 窗口大小自适应逻辑
  useLayoutEffect(() => {
    let finalHeight = 120;
    const targetWidth = spotlightAppearance.width;

    if (mode === 'search') {
      const resultCount = search.results.length;
      const listHeight = Math.min(resultCount * 60, 400);
      const totalIdealHeight = FIXED_HEIGHT + listHeight;
      finalHeight = Math.min(Math.max(totalIdealHeight, 120), MAX_WINDOW_HEIGHT);
    } else {
      finalHeight = chat.messages.length > 0 ? spotlightAppearance.maxChatHeight : 300;
    }
    appWindow.setSize(new LogicalSize(targetWidth, finalHeight));
  }, [search.results.length, mode, chat.messages.length, spotlightAppearance]);

  const handleItemSelect = async (item: SpotlightItem) => {
    if (!item) return;

    if (item.isExecutable) {
      const content = item.content || '';
      const vars = parseVariables(content);
      if (vars.length > 0) {
        await message(getText('spotlight', 'commandHasVariables', language), {
          title: getText('spotlight', 'actionRequired', language),
          kind: 'info'
        });
        return;
      }
      // @ts-ignore
      await executeCommand(content, item.shellType, projectRoot);
      await appWindow.hide();
    } else {
      try {
        await writeText(item.content || '');
        setCopiedId(item.id);
        setTimeout(async () => {
          await appWindow.hide();
          setCopiedId(null);
        }, 300);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  // 全局键盘事件监听
  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      // 关键修复：如果在输入法组字过程中，直接返回，不触发 Enter 发送
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
        // 聊天发送逻辑
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // 调用最新的 sendMessage，因为它现在直接从 Store 获取 Key，
          // 所以即使这里是旧的闭包，执行时也会去 Store 拿最新的 Key
          chat.sendMessage();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    
    // 关键修复：将 chat.sendMessage 加入依赖数组
    // 这样当输入变化导致 sendMessage 更新时，事件监听器也会更新
  }, [
    mode, 
    search.results, 
    search.selectedIndex, 
    chat.isStreaming, 
    chat.sendMessage, // 👈 必须加这个
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
        // 确保在窗口获得焦点时，强制从磁盘重新加载最新状态
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