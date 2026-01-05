import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Prompt } from '@/types/prompt';
import { SpotlightItem } from '@/types/spotlight';
import { useSpotlight } from '../core/SpotlightContext';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useSpotlightSearch() {
  const { query, mode } = useSpotlight();
  const debouncedQuery = useDebounce(query, 150);
  
  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 搜索逻辑
  useEffect(() => {
    if (mode !== 'search') return;

    const performSearch = async () => {
      setIsLoading(true);
      try {
        let data: Prompt[] = [];
        const q = debouncedQuery.trim();
        
        if (!q) {
          data = await invoke('get_prompts', { 
            page: 1, 
            pageSize: 20, 
            group: 'all', 
            category: null 
          });
        } else {
          data = await invoke('search_prompts', { 
            query: q, 
            page: 1, 
            pageSize: 20, 
            category: null 
          });
        }

        // 映射为统一的 SpotlightItem 结构
        const items: SpotlightItem[] = data.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          content: p.content,
          type: p.type === 'command' ? 'command' : 'prompt',
          originalData: p,
          isExecutable: p.isExecutable,
          shellType: p.shellType
        }));

        setResults(items);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, mode]);

  // 键盘导航逻辑
  const handleNavigation = useCallback((e: KeyboardEvent) => {
    if (mode !== 'search') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResults(current => {
        setSelectedIndex(prev => (prev + 1) % (current.length || 1));
        return current;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResults(current => {
        setSelectedIndex(prev => (prev - 1 + (current.length || 1)) % (current.length || 1));
        return current;
      });
    }
  }, [mode]);

  return {
    results,
    selectedIndex,
    isLoading,
    handleNavigation,
    setSelectedIndex
  };
}