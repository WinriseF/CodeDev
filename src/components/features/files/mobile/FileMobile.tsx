import React, { useState } from 'react';
import { Upload, File, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FileMobile: React.FC = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<{name: string, size: string}[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setHistory(prev => [{name: files[0].name, size: (files[0].size / 1024 / 1024).toFixed(2) + 'MB'}, ...prev]);
      }
    } catch (err) {
      console.error("上传失败", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="px-4 py-3 bg-white border-b flex items-center gap-3">
        <button onClick={() => navigate('/mobile/memo')}><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">文件传输</h1>
      </header>

      <main className="p-6 flex flex-col items-center">
        <label className="w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-all cursor-pointer">
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          {uploading ? (
            <>
              <Loader2 className="animate-spin text-blue-500 mb-2" size={40} />
              <span className="text-slate-500">正在传输到电脑...</span>
            </>
          ) : (
            <>
              <div className="p-4 bg-blue-50 rounded-full text-blue-600 mb-3">
                <Upload size={32} />
              </div>
              <span className="font-medium text-slate-700">点击上传文件到电脑</span>
              <span className="text-xs text-slate-400 mt-1">支持图片、文档、压缩包</span>
            </>
          )}
        </label>

        <div className="w-full mt-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">最近传输</h2>
          <div className="space-y-3">
            {history.map((item, i) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><File size={18} /></div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.size}</p>
                  </div>
                </div>
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FileMobile;
