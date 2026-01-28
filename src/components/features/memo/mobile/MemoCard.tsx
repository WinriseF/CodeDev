import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Calendar, Tag as TagIcon } from 'lucide-react';

interface Props {
  memo: {
    id: number;
    content: string;
    created_at: number;
    tags: string[];
  };
  onTagClick: (tag: string) => void;
}

const MemoCard: React.FC<Props> = ({ memo, onTagClick }) => {
  const dateStr = new Date(memo.created_at * 1000).toLocaleString();

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 animate-in fade-in slide-in-from-bottom-2">
      <article className="prose prose-sm prose-slate max-w-none mb-3">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            text: ({value}) => {
               return <span>{value}</span>;
            }
          }}
        >
          {memo.content}
        </ReactMarkdown>
      </article>

      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {memo.tags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md flex items-center gap-1 font-medium"
            >
              <TagIcon size={10} /> {tag.replace('#','')}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Calendar size={12} />
          {dateStr}
        </div>
      </div>
    </div>
  );
};

export default MemoCard;
