import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Search, Smartphone, Tag as TagIcon,
  Trash2, Archive, Calendar, Filter, Send, Hash
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConnectionModal from './ConnectionModal';

interface Memo {
  id: number;
  content: string;
  tags: string[];
  created_at: number;
}

const MemoView: React.FC = () => {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const data = await invoke<Memo[]>('get_all_memos');
    setMemos(data || []);
  };

  useEffect(() => { loadData(); }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, resources: [] })
      });
      setContent('');
      loadData();
    } catch (err) {
      console.error('发布失败', err);
    }
  };

  const filteredMemos = searchQuery
    ? memos.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : memos;

  const allTags = Array.from(new Set(memos.flatMap(m => m.tags)));

  return (
    <div className="flex h-full bg-white overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100">
        <header className="h-14 px-6 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Hash size={20} className="text-slate-400" />
            <h2 className="text-lg font-bold text-slate-800">所有备忘</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="搜索备忘录..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             <button onClick={() => setShowQR(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="连接手机">
                <Smartphone size={20} />
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm focus-within:border-blue-400 transition-all">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none min-h-[100px]"
                placeholder="记录此刻的想法..."
              />
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                <div className="flex gap-3 text-slate-400">
                  <TagIcon size={18} className="cursor-pointer hover:text-blue-500" />
                  <span className="text-xs self-center">支持 Markdown 语法</span>
                </div>
                <button
                  onClick={handlePost}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 flex items-center gap-2"
                >
                  <Send size={14} /> 发布
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredMemos.map(memo => (
                <div key={memo.id} className="group bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all relative">
                  <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.content}</ReactMarkdown>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>{new Date(memo.created_at * 1000).toLocaleString()}</span>
                      {memo.tags?.map((t: string) => (
                        <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-medium">{t}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-slate-100 rounded text-slate-500"><Archive size={14} /></button>
                      <button className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <div className="w-80 bg-slate-50/50 p-6 flex flex-col gap-8">
         <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">活跃热力图</h3>
            <div className="p-3 bg-white rounded-xl border border-slate-100">
               <div className="grid grid-cols-7 gap-1">
                  {Array.from({length: 35}).map((_, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-sm ${i % 7 === 2 ? 'bg-blue-500' : 'bg-slate-200'}`} />
                  ))}
               </div>
            </div>
         </section>

         <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">热门标签</h3>
            <div className="flex flex-wrap gap-2">
               {allTags.map(tag => (
                 <button key={tag} className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-xs text-slate-600 hover:border-blue-400 hover:text-blue-500 transition-all">
                   {tag}
                 </button>
               ))}
               {allTags.length === 0 && <span className="text-xs text-slate-400">暂无标签</span>}
            </div>
         </section>
      </div>

      {showQR && <ConnectionModal onClose={() => setShowQR(false)} />}
    </div>
  );
};

export default MemoView;
