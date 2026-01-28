import React, { useEffect, useState } from 'react';
import { Plus, Hash, Image as ImageIcon, Send, X } from 'lucide-react';
import MemoCard from './MemoCard';

interface Memo {
  id: number;
  content: string;
  tags: string[];
  resources: string[];
  created_at: number;
  updated_at: number;
}

const MemoMobile: React.FC = () => {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [content, setContent] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const fetchMemos = async () => {
    try {
      const res = await fetch('/api/memos');
      const data = await res.json();
      setMemos(data);
    } catch (err) {
      console.error('获取备忘录失败', err);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, resources: [] })
      });
      setContent('');
      fetchMemos();
    } catch (err) {
      console.error('提交失败', err);
    }
  };

  useEffect(() => {
    fetchMemos();
  }, []);

  const filteredMemos = selectedTag
    ? memos.filter(m => m.tags.includes(selectedTag))
    : memos;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="px-4 py-3 bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-800">Memos</h1>
        {selectedTag && (
          <button
            onClick={() => setSelectedTag(null)}
            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1"
          >
            #{selectedTag.replace('#','')} <X size={12} />
          </button>
        )}
        <div className="flex gap-3">
           <Hash size={20} className="text-slate-500" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMemos.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p>{selectedTag ? `没有标签 #${selectedTag} 的备忘录` : '还没有备忘录，开始记录吧'}</p>
          </div>
        ) : (
          filteredMemos.map(memo => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onTagClick={(tag) => setSelectedTag(tag)}
            />
          ))
        )}
      </main>

      <div className="p-4 bg-white border-t">
        <div className="flex items-end gap-2 bg-slate-100 rounded-2xl p-2">
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm max-h-32 p-2 resize-none"
            placeholder="记点什么... (#标签)"
            rows={1}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            onClick={handleSubmit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="flex mt-2 gap-4 px-2">
          <button className="text-slate-500 flex items-center gap-1 text-xs">
            <ImageIcon size={14} /> 图片
          </button>
          <button className="text-slate-500 flex items-center gap-1 text-xs">
            <Hash size={14} /> 标签
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoMobile;
