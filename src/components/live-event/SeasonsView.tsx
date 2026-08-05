import React, { useState, useEffect } from 'react';
import { Award, Trophy, Crown, Medal, Flame, Calendar, Sparkles } from 'lucide-react';

export const SeasonsView: React.FC = () => {
  const [activeSeason, setActiveSeason] = useState<any>(null);
  const [hallOfFame, setHallOfFame] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/seasons');
      const data = await res.json();
      if (data.success) {
        setActiveSeason(data.activeSeason);
        setHallOfFame(data.activeSeason?.hallOfFame || []);
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-400 animate-bounce" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-slate-400 font-bold">#{rank}</span>;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading Season Leaderboards...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Season Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 bg-black/30 backdrop-blur-md rounded-full text-xs font-bold tracking-widest text-amber-300 flex items-center gap-1.5 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" /> CURRENT SEASON
          </span>
          <span className="text-xs font-mono bg-black/30 px-3 py-1 rounded-full text-slate-200 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-300" /> {activeSeason?.startDate || '2026-08-01'} — {activeSeason?.endDate || '2026-08-31'}
          </span>
        </div>

        <h2 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">
          {activeSeason?.name || 'Season 1: Apex Surge'}
        </h2>
        <p className="text-amber-100 text-sm max-w-xl">
          Compete in live redeem events, voting contests, and giveaway wars to accumulate season points. Top leaders enter the Hall of Fame & unlock exclusive prize pools!
        </p>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-black/30 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <span className="text-xs text-amber-200 block">Season Prize Pool</span>
            <span className="text-xl font-bold text-amber-300">₹{activeSeason?.totalPrizePool || 5000}</span>
          </div>
          <div className="bg-black/30 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <span className="text-xs text-amber-200 block">Season Champion</span>
            <span className="text-base font-bold text-white flex items-center gap-1">
              👑 {activeSeason?.champion?.name || 'ApexTypist'}
            </span>
          </div>
          <div className="bg-black/30 backdrop-blur-md p-3 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-xs text-amber-200 block">Active Competitors</span>
            <span className="text-xl font-bold text-emerald-300">1,420 Users</span>
          </div>
        </div>
      </div>

      {/* Hall of Fame Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Season Hall of Fame
          </h3>
          <span className="text-xs text-slate-400 font-mono">Updated Real-Time</span>
        </div>

        <div className="space-y-3">
          {hallOfFame.map((player) => (
            <div
              key={player.rank}
              className={`flex items-center justify-between p-4 rounded-xl border transition ${
                player.rank === 1
                  ? 'bg-gradient-to-r from-amber-500/10 via-amber-900/20 to-slate-900 border-amber-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center">
                  {getRankBadge(player.rank)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{player.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {player.level || '👑 Legend'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Telegram ID: {player.telegramId}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-black text-amber-400 text-base block">
                  {player.score} Pts
                </span>
                <span className="text-xs text-emerald-400 font-semibold">
                  +₹{player.rewardsEarned || 500} Earned
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
