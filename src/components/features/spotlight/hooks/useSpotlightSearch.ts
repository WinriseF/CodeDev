import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Prompt } from '@/types/prompt';
import { SpotlightItem } from '@/types/spotlight';
import { useSpotlight } from '../core/SpotlightContext';

const URL_REGEX = /^(https?:\/\/)?(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/;

function isValidUrl(str: string): boolean {
  if (str.includes(' ')) return false;
  if (str.length < 3) return false;
  return URL_REGEX.test(str);
}

function normalizeUrl(str: string): string {
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }
  return `https://${str}`;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// 对应 Rust 端的 UrlHistoryItem 结构
interface UrlHistoryRecord {
  url: string;
  title?: string;
  visit_count: number;
  last_visit: number;
}

export function useSpotlightSearch() {
  const { query, mode } = useSpotlight();
  const debouncedQuery = useDebounce(query, 100); 
  
  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'search') return;

    const performSearch = async () => {
      setIsLoading(true);
      try {
        const q = debouncedQuery.trim();
        
        let dynamicUrlItem: SpotlightItem | null = null;
        if (isValidUrl(q)) {
            const url = normalizeUrl(q);
            dynamicUrlItem = {
                id: `dynamic-url-${q}`,
                title: `Open ${q}`,
                description: "Open in default browser",
                content: url,
                type: 'url',
                url: url
            };
        }
        const [promptsData, urlHistoryData] = await Promise.all([
            // 查询 Prompts
            q ? invoke<Prompt[]>('search_prompts', { 
                query: q, 
                page: 1, 
                pageSize: 10, 
                category: null 
            }) : invoke<Prompt[]>('get_prompts', { 
                page: 1, 
                pageSize: 10, 
                group: 'all', 
                category: null 
            }),

            // 查询 URL 历史 (Rust 端已实现 FTS5 和 Title 搜索)
            invoke<UrlHistoryRecord[]>('search_url_history', { query: q })
        ]);

        const historyItems: SpotlightItem[] = urlHistoryData.map(h => {
            if (dynamicUrlItem && normalizeUrl(h.url) === dynamicUrlItem.url) {
                dynamicUrlItem = null;
            }

            return {
                id: `history-${h.url}`,
                title: h.title && h.title.length > 0 ? h.title : h.url,
                description: h.title ? h.url : `Visited ${h.visit_count} times`,
                content: h.url,
                type: 'url',
                url: h.url
            };
        });

        const promptItems: SpotlightItem[] = promptsData.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          content: p.content,
          type: p.type === 'command' ? 'command' : 'prompt',
          originalData: p,
          isExecutable: p.isExecutable,
          shellType: p.shellType
        }));

        let finalResults: SpotlightItem[] = [];
        if (dynamicUrlItem) finalResults.push(dynamicUrlItem);
        finalResults = [...finalResults, ...historyItems, ...promptItems];

        setResults(finalResults);
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

  const handleNavigation = useCallback((e: KeyboardEvent) => {
    if (mode !== 'search') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const len = results.length || 1;
        return (prev + 1) % len;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => {
        const len = results.length || 1;
        return (prev - 1 + len) % len;
      });
    }
  }, [mode, results]);

  return {
    results,
    selectedIndex,
    isLoading,
    handleNavigation,
    setSelectedIndex
  };
}