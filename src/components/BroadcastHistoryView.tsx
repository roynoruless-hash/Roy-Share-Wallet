import React, { useState } from 'react';
import { Clock, Radio, RotateCcw, Copy, Trash2, Eye, CheckCircle2, Archive, AlertCircle } from 'lucide-react';

interface BroadcastHistoryRecord {
  id: string;
  code: string;
  sentAt: string;
  claimsCount: number;
  totalLimit: number;
  status: 'Completed' | 'Expired' | 'Failed';
  channels: string[];
}

export const BroadcastHistoryView: React.FC = () => {
  const [history, setHistory] = useState<BroadcastHistoryRecord[]>([
    {
      id: 'b-1',
      code: 'ROY500',
      sentAt: '2026-08-05 14:30',
      claimsCount: 56,
      totalLimit: 100,
      status: 'Completed',
      channels: ['@RoyShareChannel', '@RoyShareGroup'],
    },
    {
      id: 'b-2',
      code: 'FREE100',
      sentAt: '2026-08-04 18:00',
      claimsCount: 50,
      totalLimit: 50,
      status: 'Completed',
      channels: ['@RoyShareChannel'],
    },
    {
      id: 'b-3',
      code: 'FLASH200',
      sentAt: '2026-08-03 12:15',
      claimsCount: 12,
      totalLimit: 200,
      status: 'Expired',
      channels: ['@RoyShareChannel', '@RoyShareGroup'],
    },
  ]);

  const handleRetry = (code: string) => {
    alert(`Retrying broadcast for ${code}...`);
  };

  const handleDelete = (id: string) => {
    setHistory(history.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans">
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Broadcast History</h1>
            <p className="text-xs text-slate-400">Card-based history of all sent Telegram channel events & broadcasts.</p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
          {history.length} Broadcast Records
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.map((record) => (
          <div key={record.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono font-black text-lg text-amber-400 block">{record.code}</span>
                <span className="text-[11px] text-slate-400">{record.sentAt}</span>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  record.status === 'Completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {record.status}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Claims:</span>
                <span className="font-bold text-white">{record.claimsCount} / {record.totalLimit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Channels:</span>
                <span className="font-semibold text-sky-400">{record.channels.join(', ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <button
                onClick={() => handleRetry(record.code)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Broadcast</span>
              </button>
              <button
                onClick={() => handleDelete(record.id)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
