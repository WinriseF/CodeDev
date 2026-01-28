import React, { useState } from 'react';
import { FolderOpen, UploadCloud, Clock, FileText, CheckCircle } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

interface TransferItem {
  id: number;
  name: string;
  status: 'completed' | 'pending' | 'failed';
  size: string;
  time: string;
}

const FileTransferView: React.FC = () => {
  const [history] = useState<TransferItem[]>([
    { id: 1, name: 'meeting_notes.docx', status: 'completed', size: '1.2 MB', time: '10:45' },
    { id: 2, name: 'screenshot.png', status: 'completed', size: '2.4 MB', time: '09:30' },
    { id: 3, name: 'project.zip', status: 'completed', size: '15.8 MB', time: '昨天' },
  ]);

  const openFolder = async () => {
    try {
      const { downloadDir } = await import('@tauri-apps/api/path');
      const path = await downloadDir();
      await open(path);
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold">文件互传中心</h2>
        <button
          onClick={openFolder}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
        >
          <FolderOpen size={16} /> 打开保存目录
        </button>
      </header>

      <div className="flex-1 p-8 flex gap-8 max-w-6xl mx-auto w-full overflow-hidden">
        <div className="w-1/3 space-y-6 shrink-0">
           <div className="aspect-square border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
              <div className="p-5 bg-white rounded-full shadow-sm text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud size={40} />
              </div>
              <p className="font-semibold text-slate-700">拖拽文件到这里</p>
              <p className="text-xs text-slate-400 mt-2">文件将实时发送到手机端</p>
           </div>

           <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
              <UploadCloud className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <p className="text-xs text-blue-800 leading-relaxed">
                <strong>提示：</strong> 手机浏览器访问 <code className="bg-white px-1 rounded text-blue-600">电脑IP:1420/mobile</code> 即可连接传输文件
              </p>
           </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
           <div className="flex items-center gap-2 mb-6 text-slate-500">
              <Clock size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">最近传输历史</h3>
           </div>

           <div className="flex-1 border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
              {history.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b text-slate-400 font-medium text-[11px] uppercase">
                    <tr>
                      <th className="px-6 py-3">文件名</th>
                      <th className="px-6 py-3">状态</th>
                      <th className="px-6 py-3">大小</th>
                      <th className="px-6 py-3 text-right">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {history.map((item) => (
                       <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-6 py-4 flex items-center gap-3 font-medium text-slate-700">
                            <FileText size={18} className="text-slate-400" />
                            {item.name}
                         </td>
                         <td className="px-6 py-4">
                            <span className="flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full w-fit">
                               <CheckCircle size={12} /> 已接收
                            </span>
                         </td>
                         <td className="px-4 py-4 text-slate-400">{item.size}</td>
                         <td className="px-6 py-4 text-right text-slate-400">{item.time}</td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                  <FileText size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">暂无传输记录</p>
                  <p className="text-xs mt-1">从手机端上传文件后将显示在这里</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default FileTransferView;
