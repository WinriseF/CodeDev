import { createContext, useContext, useRef, useState, ReactNode, useCallback } from 'react';
import { SpotlightMode, SearchScope } from '@/types/spotlight';

interface SpotlightContextType {
  // 状态
  mode: SpotlightMode;
  query: string;
  chatInput: string;

  // 新增：搜索范围状态
  searchScope: SearchScope;

  // 动作
  setMode: (mode: SpotlightMode) => void;
  setQuery: (query: string) => void;
  setChatInput: (input: string) => void;

  // 新增：设置搜索范围的方法
  setSearchScope: (scope: SearchScope) => void;
  toggleMode: () => void;

  // 引用 (用于跨组件聚焦)
  inputRef: React.RefObject<HTMLInputElement>;
  focusInput: () => void;
}

const SpotlightContext = createContext<SpotlightContextType | null>(null);

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SpotlightMode>('search');
  const [query, setQuery] = useState('');
  const [chatInput, setChatInput] = useState('');

  // 新增：初始化搜索范围状态
  const [searchScope, setSearchScope] = useState<SearchScope>('global');

  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }, []);

  const setMode = useCallback((newMode: SpotlightMode) => {
    setModeState(newMode);
    focusInput();
  }, [focusInput]);

  const toggleMode = useCallback(() => {
    setModeState(prev => (prev === 'search' ? 'chat' : 'search'));
    focusInput();
  }, [focusInput]);

  return (
    <SpotlightContext.Provider value={{
      mode,
      query,
      chatInput,
      searchScope,
      setMode,
      setQuery,
      setChatInput,
      setSearchScope,
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