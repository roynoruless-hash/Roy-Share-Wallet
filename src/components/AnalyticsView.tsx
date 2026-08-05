import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, ShieldAlert, Zap, Radio, RefreshCw } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans">
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">System & Traffic Analytics</h1>
            <p className="text-xs text-slate-400">Real-time throughput metrics, claim speeds, and security analytics.</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeRange === r ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Avg Claim Speed</span>
          <span className="text-2xl font-black text-amber-400">14.2 seconds</span>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Peak Requests</span>
          <span className="text-2xl font-black text-sky-400">184 req/sec</span>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Conversion Rate</span>
          <span className="text-2xl font-black text-emerald-400">92.4%</span>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Anti-Cheat Flags</span>
          <span className="text-2xl font-black text-rose-400">0 High Risk</span>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Hourly Traffic & Claim Distribution
        </h3>
        <div className="h-44 flex items-end justify-between gap-2 pt-6 px-4 bg-slate-950 rounded-2xl border border-slate-800/80">
          {[40, 65, 30, 85, 95, 120, 75, 90, 140, 110, 80, 160].map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div
                style={{ height: `${(val / 160) * 100}%` }}
                className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t-lg transition-all hover:brightness-125"
              />
              <span className="text-[9px] text-slate-500 font-mono">{idx * 2}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
