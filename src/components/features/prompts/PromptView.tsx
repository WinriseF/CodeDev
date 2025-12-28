import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePromptStore } from '@/store/usePromptStore';
import { useAppStore } from '@/store/useAppStore';
import { Search, Plus, Folder, Star, Hash, Trash2, Layers, PanelLeft, AlertTriangle, Terminal, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Prompt, DEFAULT_GROUP } from '@/types/prompt';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { parseVariables } from '@/lib/template';
import { getText } from '@/lib/i18n';
import { Toast, ToastType } from '@/components/ui/Toast';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

import { PromptCard } from './PromptCard';
import { PromptEditorDialog } from './dialogs/PromptEditorDialog';
import { VariableFillerDialog } from './dialogs/VariableFillerDialog';
import { PromptDetailTooltip } from './PromptDetailTooltip';

import { executeCommand } from '@/lib/command_executor';
import { useContextStore } from '@/store/useContextStore';

// Constants
const CARD_HEIGHT = 196; // 180px card + 16px gap
const CARD_GAP = 16;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function PromptView() {
  const {
    prompts,
    groups,
    activeGroup, setActiveGroup,
    activeCategory, setActiveCategory,
    searchQuery: storeSearchQuery, setSearchQuery,
    initStore, loadPrompts, isLoading, hasMore,
    deleteGroup, deletePrompt,
  } = usePromptStore();

  const { isPromptSidebarOpen, setPromptSidebarOpen, language } = useAppStore();
  const { projectRoot } = useContextStore();

  const [localSearchInput, setLocalSearchInput] = useState('');
  const debouncedSearchTerm = useDebounce(localSearchInput, 500);

  const [toastState, setToastState] = useState<{ show: boolean; msg: string; type: ToastType }>({
    show: false, msg: '', type: 'success'
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isFillerOpen, setIsFillerOpen] = useState(false);
  const [fillPrompt, setFillPrompt] = useState<Prompt | null>(null);
  const [fillVars, setFillVars] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);

  // Tooltip state (single instance)
  const [hoveredPrompt, setHoveredPrompt] = useState<Prompt | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize store
  useEffect(() => {
    const init = async () => {
      await initStore();
      if (prompts.length === 0) {
        loadPrompts(true);
      }
    };
    init();
  }, []);

  // Sync search query
  useEffect(() => {
    if (debouncedSearchTerm !== storeSearchQuery) {
      setSearchQuery(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  // Tooltip handlers with debounce
  const handleHoverEnter = useCallback((prompt: Prompt, rect: DOMRect) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredPrompt(prompt);
      setTooltipAnchor(rect);
    }, 100);
  }, []);

  const handleHoverLeave = useCallback((_prompt: Prompt) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredPrompt(null);
      setTooltipAnchor(null);
    }, 150);
  }, []);

  // Trigger toast
  const triggerToast = (msg?: string, type: ToastType = 'success') => {
    setToastState({ show: true, msg: msg || getText('prompts', 'copySuccess', language), type });
  };

  // CRUD handlers
  const handleCreate = useCallback(() => { setEditingPrompt(null); setIsEditorOpen(true); }, []);
  const handleEdit = useCallback((prompt: Prompt) => { setEditingPrompt(prompt); setIsEditorOpen(true); }, []);
  const handleDeleteClick = useCallback((prompt: Prompt) => { setPromptToDelete(prompt); setIsDeleteConfirmOpen(true); }, []);

  const confirmDelete = async () => {
    if (promptToDelete) {
      await deletePrompt(promptToDelete.id);
      setIsDeleteConfirmOpen(false);
      setPromptToDelete(null);
    }
  };

  const handleTrigger = useCallback(async (prompt: Prompt) => {
    const vars = parseVariables(prompt.content);
    if (prompt.isExecutable) {
      if (vars.length > 0) {
        setFillPrompt(prompt);
        setFillVars(vars);
        setIsFillerOpen(true);
      } else {
        await executeCommand(prompt.content, prompt.shellType, projectRoot);
      }
    } else {
      if (vars.length > 0) {
        setFillPrompt(prompt);
        setFillVars(vars);
        setIsFillerOpen(true);
      } else {
        await writeText(prompt.content);
        triggerToast();
      }
    }
  }, [language, projectRoot]);

  // Calculate responsive column count
  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width >= 1600) return 5;
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 768) return 2;
    return 1;
  }, []);

  // Calculate rows for virtual list
  const rowCount = Math.ceil(prompts.length / columnCount);

  // Get prompts for a specific row
  const getRowPrompts = useCallback((rowIndex: number) => {
    const start = rowIndex * columnCount;
    return prompts.slice(start, start + columnCount);
  }, [prompts, columnCount]);

  // Render row for virtual list
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const rowPrompts = getRowPrompts(index);
    return (
      <div style={{ ...style, padding: CARD_GAP / 2 }}>
        <div className="grid gap-4 h-full" style={{ gridTemplateColumns: `repeat(${rowPrompts.length}, 1fr)` }}>
          {rowPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onTrigger={handleTrigger}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
            />
          ))}
        </div>
      </div>
    );
  }, [getRowPrompts, handleEdit, handleDeleteClick, handleTrigger, handleHoverEnter, handleHoverLeave]);

  return (
    <div className="h-full flex flex-row overflow-hidden bg-background">
      <aside className={cn("flex flex-col bg-secondary/5 select-none transition-all duration-300 ease-in-out overflow-hidden", isPromptSidebarOpen ? "w-56 border-r border-border opacity-100" : "w-0 border-none opacity-0")}>
        <div className="p-3 pb-0 flex gap-1 shrink-0">
          <button
            onClick={() => setActiveCategory('prompt')}
            className={cn("flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-colors", activeCategory === 'prompt' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}
          >
            <Sparkles size={14} /> Prompts
          </button>
          <button
            onClick={() => setActiveCategory('command')}
            className={cn("flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-colors", activeCategory === 'command' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}
          >
            <Terminal size={14} /> Commands
          </button>
        </div>

        <div className="p-4 pb-2 min-w-[13rem]">
          <div className="space-y-1">
            <CategoryItem
              icon={<Layers size={16} />}
              label={getText('sidebar', 'all', language)}
              isActive={activeGroup === 'all'}
              onClick={() => setActiveGroup('all')}
            />
            <CategoryItem
              icon={<Star size={16} />}
              label={getText('sidebar', 'favorites', language)}
              isActive={activeGroup === 'favorite'}
              onClick={() => setActiveGroup('favorite')}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-0 scrollbar-hide min-w-[13rem]">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 mt-4 flex justify-between items-center px-2">
            {getText('sidebar', 'groups', language)}
            <button className="hover:text-primary transition-colors p-1 rounded hover:bg-secondary" onClick={handleCreate}>
              <Plus size={14} />
            </button>
          </h2>
          <div className="space-y-1">
            {groups.map(group => {
              if (group === DEFAULT_GROUP) return null;
              return (
                <CategoryItem
                  key={group}
                  icon={group === 'Git' ? <Hash size={16} /> : <Folder size={16} />}
                  label={group}
                  isActive={activeGroup === group}
                  onClick={() => setActiveGroup(group)}
                  onDelete={() => deleteGroup(group)}
                />
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-background/80 backdrop-blur z-10">
          <button onClick={() => setPromptSidebarOpen(!isPromptSidebarOpen)} className={cn("p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors", !isPromptSidebarOpen && "text-primary bg-primary/10")}>
            <PanelLeft size={18} />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder={getText('prompts', 'searchPlaceholder', language)}
              className="w-full bg-secondary/40 border border-transparent focus:border-primary/30 rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={localSearchInput}
              onChange={(e) => setLocalSearchInput(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <button onClick={handleCreate} className="h-9 w-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95">
            <Plus size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden p-4 md:p-6">
          {prompts.length > 0 ? (
            <AutoSizer
              Child={({ height, width }: { height?: number; width?: number }) => {
                if (!height || !width) return null;
                return (
                  <List
                    height={height}
                    width={width}
                    itemCount={rowCount}
                    itemSize={CARD_HEIGHT}
                  >
                    {/* @ts-expect-error - react-window children type mismatch */}
                    {renderRow}
                  </List>
                );
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4"><Search size={32} /></div>
              <p>{getText('prompts', 'noResults', language)}</p>
            </div>
          )}

          {/* Loading indicator */}
          {(isLoading || !hasMore) && prompts.length > 0 && (
            <div className="text-center py-4 text-xs text-muted-foreground/50">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={14} />
                  Loading...
                </span>
              ) : (
                '- End of Results -'
              )}
            </div>
          )}
        </div>

        {/* Single instance Tooltip */}
        {hoveredPrompt && tooltipAnchor ? (
          <PromptDetailTooltip
            prompt={hoveredPrompt}
            anchorRect={tooltipAnchor}
            isOpen={true}
            onMouseEnter={() => {
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
            }}
            onMouseLeave={() => {
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
              tooltipTimeoutRef.current = setTimeout(() => {
                setHoveredPrompt(null);
                setTooltipAnchor(null);
              }, 300);
            }}
          />
        ) : null}

        <PromptEditorDialog isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} initialData={editingPrompt} />

        <VariableFillerDialog
          isOpen={isFillerOpen}
          onClose={() => setIsFillerOpen(false)}
          prompt={fillPrompt}
          variables={fillVars}
          confirmText={fillPrompt?.isExecutable ? "Run Command" : "Copy Result"}
          onConfirm={async (filledContent) => {
            if (fillPrompt?.isExecutable) {
              await executeCommand(filledContent, fillPrompt.shellType, projectRoot);
            } else {
              await writeText(filledContent);
              triggerToast();
            }
            setIsFillerOpen(false);
          }}
        />

        {isDeleteConfirmOpen && promptToDelete && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-[400px] bg-background border border-border rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 text-destructive">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{getText('prompts', 'deleteTitle', language)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getText('prompts', 'deleteMessage', language, { name: promptToDelete.title })}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  {getText('prompts', 'cancel', language)}
                </button>
                <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm">
                  {getText('prompts', 'confirmDelete', language)}
                </button>
              </div>
            </div>
          </div>
        )}

        <Toast
          message={toastState.msg}
          type={toastState.type}
          show={toastState.show}
          onDismiss={() => setToastState(prev => ({ ...prev, show: false }))}
        />
      </main>
    </div>
  );
}

interface CategoryItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

function CategoryItem({ icon, label, isActive, onClick, onDelete }: CategoryItemProps) {
  return (
    <div onClick={onClick} className={cn("group flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-all select-none", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="shrink-0">{icon}</div>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center">
        {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="mr-2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1 rounded hover:bg-background"><Trash2 size={12} /></button>}
      </div>
    </div>
  );
}
