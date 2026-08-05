import React, { useState, useEffect } from 'react';
import { Eye, Users, Zap, Trophy, Clock, ShieldCheck, Lock, Radio } from 'lucide-react';

interface SpectatorViewProps {
  eventData: any;
  onExitSpectator?: () => void;
}

export const SpectatorView: React.FC<SpectatorViewProps> = ({ eventData, onExitSpectator }) => {
  const [onlineUsers, setOnlineUsers] = useState(148);
  const [claimProgress, setClaimProgress] = useState(65);
  const [liveClaims, setLiveClaims] = useState<any[]>([]);

  useEffect(() => {
    // Pulse online users counter periodically
    const interval = setInterval(() => {
      setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);

    // Initial claims from event data or fallback
    const claims = eventData?.winners || [
      { userName: 'Alex_Pro', typingSpeedSec: 1.8, time: '10s ago', reward: 50 },
      { userName: 'CryptoSpeed', typingSpeedSec: 2.1, time: '25s ago', reward: 50 },
      { userName: 'Roy_Fanatic', typingSpeedSec: 2.4, time: '40s ago', reward: 50 },
    ];
    setLiveClaims(claims);

    return () => clearInterval(interval);
  }, [eventData]);

  const maskedCode = '••••••••';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-amber-500/30 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
      {/* Live Badge & Exit */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-xs font-bold animate-pulse">
            <Radio className="w-3.5 h-3.5" /> SPECTATOR MODE
          </span>
          <span className="text-xs text-slate-400">Watching event in real-time</span>
        </div>
        {onExitSpectator && (
          <button
            onClick={onExitSpectator}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            Switch to Active Player
          </button>
        )}
      </div>

      {/* Main Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Users className="w-4 h-4 text-cyan-400" /> Online Spectators
          </div>
          <div className="text-2xl font-black text-cyan-400">{onlineUsers}</div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Zap className="w-4 h-4 text-amber-400" /> Event Status
          </div>
          <div className="text-sm font-bold text-amber-400 uppercase">
            {eventData?.eventStatus || 'UNLOCKED'}
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Trophy className="w-4 h-4 text-emerald-400" /> Total Claims
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {eventData?.claimedCount || liveClaims.length} / {eventData?.maxClaims || 100}
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-purple-400" /> Speed Pace
          </div>
          <div className="text-2xl font-black text-purple-400">⚡ 1.9s avg</div>
        </div>
      </div>

      {/* Code Display (Masked in Spectator Mode) */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-dashed border-amber-500/40 text-center mb-6 relative">
        <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
          <Lock className="w-4 h-4" /> Code Masked for Spectators
        </div>
        <div className="text-3xl md:text-4xl font-mono tracking-widest text-slate-500 select-none">
          {maskedCode}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Spectators view live performance feed without direct code access.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-300 font-semibold mb-2">
          <span>⏳ Event Progress</span>
          <span>{claimProgress}% Claimed</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${claimProgress}%` }}
          />
        </div>
      </div>

      {/* Live Claims Stream */}
      <div>
        <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Live Winner Stream
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {liveClaims.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-slate-950/80 rounded-xl border border-slate-800/60 hover:border-slate-700 transition text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                  #{idx + 1}
                </span>
                <div>
                  <span className="font-bold text-slate-100">{item.userName || item.telegramId}</span>
                  <span className="text-slate-400 block text-[10px]">Speed: {item.typingSpeedSec || 2.1}s</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-400 text-sm">+₹{item.reward || 50}</span>
                <span className="text-slate-500 block text-[10px]">{item.time || 'Just now'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
