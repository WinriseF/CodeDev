import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Prompt } from '@/types/prompt';
import { SpotlightItem } from '@/types/spotlight';
import { useSpotlight } from '../core/SpotlightContext';
import { getText } from '@/lib/i18n';
import { evaluateMath } from '@/lib/calculator';

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

// 对应 Rust 端的 UrlHistoryItem 结构
interface UrlHistoryRecord {
  url: string;
  title?: string;
  visit_count: number;
  last_visit: number;
}

// 新增接口定义，对应 Rust 的结构体
interface ShellHistoryEntry {
  id: number;
  command: string;
  timestamp: number;
  execution_count: number;
}

export function useSpotlightSearch(language: 'zh' | 'en' = 'en') {
  const { query, mode, searchScope } = useSpotlight();
  const debouncedQuery = useDebounce(query, 100);

  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'search') return;

    const performSearch = async () => {
      const q = debouncedQuery.trim();

      // 1. 处理特殊模式 (仅在 Global 模式下生效)
      if (searchScope === 'global') {
        // --- 计算器模式 ---
        if (q.startsWith('=')) {
            const mathResult = evaluateMath(q);
            if (mathResult) {
                setResults([{
                    id: 'math-result',
                    title: mathResult,
                    description: `${getText('spotlight', 'mathResult', language) || 'Result'} (${q.substring(1)})`,
                    content: mathResult,
                    type: 'math',
                    mathResult: mathResult
                }]);
                setSelectedIndex(0);
                setIsLoading(false); // 短路：确保 loading 关闭
                return;
            }
        }

        // --- Shell 命令模式 ---
        if (q.startsWith('>') || q.startsWith('》')) {
          const cmd = q.substring(1).trim(); // 去掉前缀

          let shellResults: SpotlightItem[] = [];

          // 1. 第一项永远是：直接执行当前输入
          // 只有当用户输入了内容时才显示"执行"，否则显示提示
          const currentShellItem: SpotlightItem = {
            id: 'shell-exec-current',
            title: cmd
              ? `${getText('spotlight', 'executeCommand', language) || 'Execute'}: ${cmd}`
              : getText('spotlight', 'shellPlaceholder', language) || 'Type a command to run...',
            description: getText('spotlight', 'runInTerminal', language) || 'Run in Terminal',
            content: cmd,
            type: 'shell',
            shellCmd: cmd,
            isExecutable: true,
            shellType: 'auto'
          };
          shellResults.push(currentShellItem);

          // 2. 后续项：从数据库加载历史记录
          try {
            console.log('[Spotlight] Loading shell history, cmd:', cmd);
            let historyEntries: ShellHistoryEntry[] = [];
            if (cmd === '') {
              // 输入为空时，显示最近的历史记录
              historyEntries = await invoke<ShellHistoryEntry[]>('get_recent_shell_history', { limit: 10 });
            } else {
              // 有输入时，进行模糊搜索
              historyEntries = await invoke<ShellHistoryEntry[]>('search_shell_history', { query: cmd, limit: 10 });
            }

            console.log('[Spotlight] Loaded history entries:', historyEntries);

            const historyItems: SpotlightItem[] = historyEntries.map(entry => ({
              id: `shell-history-${entry.id}`,
              title: entry.command,
              description: `History • Used ${entry.execution_count} times`,
              content: entry.command,
              type: 'shell_history',
              historyCommand: entry.command, // 关键字段用于补全
              isExecutable: false, // 历史记录本身不直接执行，而是补全
            }));

            shellResults = [...shellResults, ...historyItems];
          } catch (err) {
            console.error("Failed to load shell history:", err);
          }

          setResults(shellResults);
          setSelectedIndex(0); // 重置选中项到第一项
          setIsLoading(false);
          return; // 结束，不再执行后续的常规搜索
        }
      }

      // 2. 常规搜索逻辑
      setIsLoading(true);
      try {
        let finalResults: SpotlightItem[] = [];

        // 并行请求数据，根据 Scope 过滤请求
        const promises = [];

        // A. Prompts (Command/Prompt)
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

        // B. URL History & Dynamic URL (仅 Global)
        if (searchScope === 'global') {
            promises.push(invoke<UrlHistoryRecord[]>('search_url_history', { query: q }));
        } else {
            promises.push(Promise.resolve([]));
        }

        // C. Apps (Global 或 App 模式)
        if (searchScope === 'global' || searchScope === 'app') {
            promises.push(q ? invoke<AppEntry[]>('search_apps_in_db', { query: q }) : Promise.resolve([]));
        } else {
            promises.push(Promise.resolve([]));
        }

        const [promptsData, urlHistoryData, appsData] = await Promise.all(promises);

        // --- 处理结果 ---

        // 1. Dynamic URL (Global Only)
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

        // 2. Apps
        const appItems: SpotlightItem[] = (appsData as AppEntry[]).map(app => ({
            id: `app-${app.path}`,
            title: app.name,
            description: getText('spotlight', 'application', language),
            content: app.path,
            type: 'app',
            appPath: app.path
        }));

        // 3. History
        const historyItems: SpotlightItem[] = (urlHistoryData as UrlHistoryRecord[]).map(h => ({
            id: `history-${h.url}`,
            title: h.title && h.title.length > 0 ? h.title : h.url,
            description: h.title ? h.url : getText('spotlight', 'visitedTimes', language, { count: String(h.visit_count) }),
            content: h.url,
            type: 'url',
            url: h.url
        }));

        // 4. Prompts
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

        // --- 聚合 ---
        if (searchScope === 'app') {
            finalResults = [...appItems];
        } else if (searchScope === 'command' || searchScope === 'prompt') {
            finalResults = [...promptItems];
        } else {
            // Global: 混合排序
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
  }, [debouncedQuery, mode, searchScope, language]);

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
