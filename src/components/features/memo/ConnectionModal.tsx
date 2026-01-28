import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { QRCodeSVG } from 'qrcode.react';
import { Monitor, Smartphone, Link, Copy, Check } from 'lucide-react';

interface ConnectionInfo {
  url: string;
  ip: string;
  port: number;
}

const ConnectionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    invoke<ConnectionInfo>('get_connection_info').then(setInfo);
  }, []);

  const copyToClipboard = () => {
    if (info) {
      navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-[400px] shadow-2xl border border-slate-200">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">连接移动端</h2>
          <p className="text-slate-500 text-sm mt-1">手机扫码，随时随地记录灵感</p>
        </div>

        {info ? (
          <div className="flex flex-col items-center">
            <div className="p-4 bg-white border-2 border-slate-100 rounded-xl mb-6">
              <QRCodeSVG value={info.url} size={200} />
            </div>

            <div className="w-full bg-slate-50 rounded-lg p-3 flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-2 overflow-hidden">
                <Link size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 truncate">{info.url}</span>
              </div>
              <button onClick={copyToClipboard} className="text-blue-600 hover:text-blue-700 p-1">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-20 flex justify-center text-slate-400">正在生成连接...</div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-8 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
};

export default ConnectionModal;
