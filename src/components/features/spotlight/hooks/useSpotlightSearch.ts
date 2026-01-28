import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Prompt } from '@/types/prompt';
import { SpotlightItem } from '@/types/spotlight';
import { useSpotlight } from '../core/SpotlightContext';
import { getText } from '@/lib/i18n';
import { evaluateMath } from '@/lib/calculator';
import { useAppStore } from '@/store/useAppStore';

interface AppEntry {
  name: string;
  path: string;
  icon: string | null;
  usage_count: number;
}

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

interface UrlHistoryRecord {
  url: string;
  title?: string;
  visit_count: number;
  last_visit: number;
}

interface ShellHistoryEntry {
  id: number;
  command: string;
  timestamp: number;
  execution_count: number;
}

const SEARCH_TEMPLATES: Record<string, { name: string; url: string; color: string }> = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s', color: 'bg-blue-600' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s', color: 'bg-cyan-600' },
  baidu: { name: 'Baidu', url: 'https://www.baidu.com/s?wd=%s', color: 'bg-blue-700' },
  custom: { name: 'Custom', url: '', color: 'bg-purple-600' },
};

export function useSpotlightSearch(language: 'zh' | 'en' = 'en') {
  const { query, mode, searchScope } = useSpotlight();
  const { searchSettings } = useAppStore();
  const debouncedQuery = useDebounce(query, 100);

  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      const q = debouncedQuery.trim();

      if (searchScope === 'math') {
          if (!q) {
              setResults([]);
              return;
          }
          const mathResult = evaluateMath(q);
          if (mathResult) {
              setResults([{
                  id: 'math-result',
                  title: mathResult,
                  description: `${getText('spotlight', 'mathResult', language) || 'Result'} (${q})`,
                  content: mathResult,
                  type: 'math',
                  mathResult: mathResult
              }]);
              setSelectedIndex(0);
          } else {
              setResults([]);
          }
          setIsLoading(false);
          return;
      }

      if (searchScope === 'shell') {
          const currentShellItem: SpotlightItem = {
            id: 'shell-exec-current',
            title: q
              ? `${getText('spotlight', 'executeCommand', language) || 'Execute'}: ${q}`
              : getText('spotlight', 'shellPlaceholder', language) || 'Type a command to run...',
            description: getText('spotlight', 'runInTerminal', language) || 'Run in Terminal',
            content: q,
            type: 'shell',
            shellCmd: q,
            isExecutable: true,
            shellType: 'auto'
          };

          let shellResults: SpotlightItem[] = [currentShellItem];

          try {
            let historyEntries: ShellHistoryEntry[] = [];
            if (q === '') {
              historyEntries = await invoke<ShellHistoryEntry[]>('get_recent_shell_history', { limit: 10 });
            } else {
              historyEntries = await invoke<ShellHistoryEntry[]>('search_shell_history', { query: q, limit: 10 });
            }

            const historyItems: SpotlightItem[] = historyEntries.map(entry => ({
              id: `shell-history-${entry.id}`,
              title: entry.command,
              description: `History • Used ${entry.execution_count} times`,
              content: entry.command,
              type: 'shell_history',
              historyCommand: entry.command,
              isExecutable: false,
            }));

            shellResults = [...shellResults, ...historyItems];
          } catch (err) {
            console.error("Failed to load shell history:", err);
          }

          setResults(shellResults);
          setSelectedIndex(0);
          setIsLoading(false);
          return;
      }

      if (searchScope === 'web') {
          if (!q) {
              setResults([]);
              return;
          }

          const { defaultEngine, customUrl } = searchSettings;

          const baseOrder: ('google' | 'bing' | 'custom' | 'baidu')[] = ['google', 'bing', 'custom', 'baidu'];

          const sortedEngines = [
              defaultEngine,
              ...baseOrder.filter(e => e !== defaultEngine)
          ];

          const webItems: SpotlightItem[] = sortedEngines.map(key => {
              const config = SEARCH_TEMPLATES[key];
              const template = key === 'custom' ? customUrl : config.url;

              const finalUrl = template.includes('%s')
                ? template.replace('%s', encodeURIComponent(q))
                : `${template}${encodeURIComponent(q)}`;

              return {
                  id: `web-search-${key}`,
                  title: `Search ${config.name}: ${q}`,
                  description: key === 'custom' ? `Custom: ${template.substring(0, 30)}...` : `Open in default browser`,
                  content: q,
                  type: 'web_search',
                  url: finalUrl,
                  // 存储引擎类型字符串，让渲染层去决定如何使用组件
                  icon: key
              };
          });

          setResults(webItems);
          setSelectedIndex(0);
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      try {
        let finalResults: SpotlightItem[] = [];
        const promises = [];

        if (searchScope === 'global' || searchScope === 'command' || searchScope === 'prompt') {
            const categoryFilter = searchScope === 'global' ? null : searchScope;
            promises.push(
                q ? invoke<Prompt[]>('search_prompts', {
                    query: q,
                    page: 1,
                    pageSize: 10,
                    category: categoryFilter
                }) : invoke<Prompt[]>('get_prompts', {
                    page: 1,
                    pageSize: 10,
                    group: 'all',
                    category: categoryFilter
                })
            );
        } else {
            promises.push(Promise.resolve([]));
        }

        if (searchScope === 'global') {
            promises.push(invoke<UrlHistoryRecord[]>('search_url_history', { query: q }));
        } else {
            promises.push(Promise.resolve([]));
        }

        if (searchScope === 'global' || searchScope === 'app') {
            promises.push(q ? invoke<AppEntry[]>('search_apps_in_db', { query: q }) : Promise.resolve([]));
        } else {
            promises.push(Promise.resolve([]));
        }

        const [promptsData, urlHistoryData, appsData] = await Promise.all(promises);

        let dynamicUrlItem: SpotlightItem | null = null;
        if (searchScope === 'global' && isValidUrl(q)) {
            const url = normalizeUrl(q);
            const existsInHistory = (urlHistoryData as UrlHistoryRecord[]).some(h => normalizeUrl(h.url) === url);
            if (!existsInHistory) {
                dynamicUrlItem = {
                    id: `dynamic-url-${q}`,
                    title: `${getText('spotlight', 'openLink', language)} ${q}`,
                    description: "Open in default browser",
                    content: url,
                    type: 'url',
                    url: url
                };
            }
        }

        const appItems: SpotlightItem[] = (appsData as AppEntry[]).map(app => ({
            id: `app-${app.path}`,
            title: app.name,
            description: getText('spotlight', 'application', language),
            content: app.path,
            type: 'app',
            appPath: app.path
        }));

        const historyItems: SpotlightItem[] = (urlHistoryData as UrlHistoryRecord[]).map(h => ({
            id: `history-${h.url}`,
            title: h.title && h.title.length > 0 ? h.title : h.url,
            description: h.title ? h.url : getText('spotlight', 'visitedTimes', language, { count: String(h.visit_count) }),
            content: h.url,
            type: 'url',
            url: h.url
        }));

        const promptItems: SpotlightItem[] = (promptsData as Prompt[]).map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          content: p.content,
          type: p.type === 'command' ? 'command' : 'prompt',
          originalData: p,
          isExecutable: p.isExecutable,
          shellType: p.shellType
        }));

        if (searchScope === 'app') {
            finalResults = [...appItems];
        } else if (searchScope === 'command' || searchScope === 'prompt') {
            finalResults = [...promptItems];
        } else {
            if (dynamicUrlItem) finalResults.push(dynamicUrlItem);
            finalResults = [...finalResults, ...appItems, ...historyItems, ...promptItems];
        }

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
  }, [debouncedQuery, mode, searchScope, searchSettings, language]);

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
