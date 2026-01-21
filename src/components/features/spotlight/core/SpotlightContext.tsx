import { createContext, useContext, useRef, useState, ReactNode, useCallback } from 'react';
import { SpotlightMode, SearchScope } from '@/types/spotlight';
import { Prompt } from '@/types/prompt';

interface SpotlightContextType {
  // 状态
  mode: SpotlightMode;
  query: string;
  chatInput: string;
  searchScope: SearchScope;

  // [New] 当前激活的聊天模板 (例如选中的 "翻译")
  activeTemplate: Prompt | null;

  // 动作
  setMode: (mode: SpotlightMode) => void;
  setQuery: (query: string) => void;
  setChatInput: (input: string) => void;
  setSearchScope: (scope: SearchScope) => void;

  // [New] 设置激活模板
  setActiveTemplate: (prompt: Prompt | null) => void;

  toggleMode: () => void;

  // 引用
  inputRef: React.RefObject<HTMLInputElement>;
  focusInput: () => void;
}

const SpotlightContext = createContext<SpotlightContextType | null>(null);

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SpotlightMode>('search');
  const [query, setQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('global');

  // [New] 初始化状态
  const [activeTemplate, setActiveTemplate] = useState<Prompt | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }, []);

  const setMode = useCallback((newMode: SpotlightMode) => {
    setModeState(newMode);
    // [New] 切换模式时清除模板状态
    setActiveTemplate(null);
    focusInput();
  }, [focusInput]);

  const toggleMode = useCallback(() => {
    setModeState(prev => {
        // [New] 切换模式时清除模板状态
        setActiveTemplate(null);
        return prev === 'search' ? 'chat' : 'search';
    });
    focusInput();
  }, [focusInput]);

  return (
    <SpotlightContext.Provider value={{
      mode,
      query,
      chatInput,
      searchScope,
      activeTemplate, // [New]
      setMode,
      setQuery,
      setChatInput,
      setSearchScope,
      setActiveTemplate, // [New]
      toggleMode,
      inputRef,
      focusInput
    }}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error('useSpotlight must be used within a SpotlightProvider');
  }
  return context;
}
