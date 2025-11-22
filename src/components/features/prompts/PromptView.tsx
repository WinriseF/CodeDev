import { useState } from 'react';
import { usePromptStore } from '@/store/usePromptStore';
import { Search, Plus, Folder, Star, Hash, Trash2, Layers, CheckCircle2, PanelLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Prompt } from '@/types/prompt';
import { writeText } from '@tauri-apps/api/clipboard';
import { parseVariables } from '@/lib/template';

import { PromptCard } from './PromptCard';
import { PromptEditorDialog } from './dialogs/PromptEditorDialog';
import { VariableFillerDialog } from './dialogs/VariableFillerDialog';

export function PromptView() {
  const { 
    groups, activeGroup, setActiveGroup, 
    prompts, searchQuery, setSearchQuery, 
    deleteGroup, deletePrompt // 引入 deletePrompt
  } = usePromptStore();

  const [showToast, setShowToast] = useState(false);
  const [isInnerSidebarOpen, setIsInnerSidebarOpen] = useState(true);

  // CRUD States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  
  // Filler States
  const [isFillerOpen, setIsFillerOpen] = useState(false);
  const [fillPrompt, setFillPrompt] = useState<Prompt | null>(null);
  const [fillVars, setFillVars] = useState<string[]>([]);

  // ✨ Delete Confirmation States (新增)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCreate = () => {
    setEditingPrompt(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setIsEditorOpen(true);
  };

  // ✨ 新增：点击删除按钮，只打开弹窗，不删数据
  const handleDeleteClick = (prompt: Prompt) => {
    setPromptToDelete(prompt);
    setIsDeleteConfirmOpen(true);
  };

  // ✨ 新增：确认删除逻辑
  const confirmDelete = () => {
    if (promptToDelete) {
      deletePrompt(promptToDelete.id);
      setIsDeleteConfirmOpen(false);
      setPromptToDelete(null);
    }
  };

  const handleTrigger = async (prompt: Prompt) => {
    const vars = parseVariables(prompt.content);
    if (vars.length > 0) {
      setFillPrompt(prompt);
      setFillVars(vars);
      setIsFillerOpen(true);
    } else {
      await writeText(prompt.content);
      triggerToast();
    }
  };

  const filteredPrompts = prompts.filter(p => {
    const matchGroup = activeGroup === 'all' ? true : 
                       activeGroup === 'favorite' ? p.isFavorite :
                       p.group === activeGroup;
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchGroup && matchSearch;
  });

  return (
    <div className="h-full flex flex-row overflow-hidden bg-background">
      
      {/* --- 左侧 Sidebar --- */}
      <aside 
        className={cn(
          "flex flex-col bg-secondary/5 select-none transition-all duration-300 ease-in-out overflow-hidden",
          isInnerSidebarOpen ? "w-52 border-r border-border opacity-100" : "w-0 border-none opacity-0"
        )}
      >
        <div className="p-4 pb-2 min-w-[13rem]">
           <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Library</h2>
           <div className="space-y-1">
            <CategoryItem 
              icon={<Layers size={16} />} 
              label="全部指令" 
              count={prompts.length}
              isActive={activeGroup === 'all'} 
              onClick={() => setActiveGroup('all')} 
            />
            <CategoryItem 
              icon={<Star size={16} />} 
              label="我的收藏" 
              count={prompts.filter(p => p.isFavorite).length}
              isActive={activeGroup === 'favorite'} 
              onClick={() => setActiveGroup('favorite')} 
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 pt-0 scrollbar-hide min-w-[13rem]">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 mt-4 flex justify-between items-center px-2">
                Groups
                <button 
                    className="hover:text-primary transition-colors p-1 rounded hover:bg-secondary" 
                    title="新建指令 (可创建新分类)"
                    onClick={handleCreate} 
                >
                    <Plus size={14} />
                </button>
            </h2>
            <div className="space-y-1">
                {groups.map(group => (
                  group !== 'Default' && (
                    <CategoryItem 
                        key={group}
                        icon={group === 'Git' ? <Hash size={16} /> : <Folder size={16} />} 
                        label={group} 
                        count={prompts.filter(p => p.group === group).length}
                        isActive={activeGroup === group} 
                        onClick={() => setActiveGroup(group)}
                        onDelete={() => deleteGroup(group)}
                    />
                  )
                ))}
            </div>
        </div>
      </aside>

      {/* --- 右侧 Main Content --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        
        <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-background/80 backdrop-blur z-10">
          <button 
            onClick={() => setIsInnerSidebarOpen(!isInnerSidebarOpen)}
            className={cn(
              "p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
              !isInnerSidebarOpen && "text-primary bg-primary/10"
            )}
            title={isInnerSidebarOpen ? "收起侧栏" : "展开侧栏"}
          >
            <PanelLeft size={18} />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text"
              placeholder="搜索指令..."
              className="w-full bg-secondary/40 border border-transparent focus:border-primary/30 rounded-md pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex-1" /> 

          <button 
            onClick={handleCreate}
            className="h-9 w-9 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95"
            title="新建指令"
          >
            <Plus size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-[1600px] mx-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                {filteredPrompts.map(prompt => (
                    <PromptCard 
                        key={prompt.id} 
                        prompt={prompt} 
                        onEdit={handleEdit} 
                        // ✨ 这里传入删除处理函数
                        onDelete={handleDeleteClick}
                        onTrigger={handleTrigger} 
                    />
                ))}
                
                {filteredPrompts.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                        <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-4">
                            <Search size={32} />
                        </div>
                        <p>没有找到相关指令</p>
                    </div>
                )}
             </div>
          </div>
        </div>

        {/* --- Modals --- */}
        
        <PromptEditorDialog 
            isOpen={isEditorOpen} 
            onClose={() => setIsEditorOpen(false)} 
            initialData={editingPrompt} 
        />
        
        <VariableFillerDialog 
            isOpen={isFillerOpen}
            onClose={() => setIsFillerOpen(false)}
            prompt={fillPrompt}
            variables={fillVars}
            onSuccess={triggerToast}
        />

        {/* ✨ 新增：删除确认弹窗 */}
        {isDeleteConfirmOpen && promptToDelete && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-[400px] bg-background border border-border rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 text-destructive">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">确认删除?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    您确定要删除指令 <span className="font-bold text-foreground">"{promptToDelete.title}"</span> 吗？此操作无法撤销。
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out transform pointer-events-none",
          showToast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}>
          <div className="bg-foreground/90 text-background px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm">
            <CheckCircle2 size={16} className="text-green-400" />
            <span>已复制到剪贴板</span>
          </div>
        </div>
        
      </main>
    </div>
  );
}

function CategoryItem({ icon, label, count, isActive, onClick, onDelete }: any) {
    return (
      <div 
        onClick={onClick}
        className={cn(
          "group flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-all select-none",
          isActive 
            ? "bg-primary/10 text-primary" 
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0">{icon}</div>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center">
          {onDelete && (
             <button 
               onClick={(e) => { e.stopPropagation(); onDelete(); }}
               className="mr-2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1 rounded hover:bg-background"
             >
               <Trash2 size={12} />
             </button>
          )}
          {count > 0 && <span className="text-xs opacity-60 min-w-[1.5em] text-center">{count}</span>}
        </div>
      </div>
    );
}