import React, { useState, useEffect } from 'react';
import { History, Award, Zap, ShieldCheck, Gift, Clock, CheckCircle2, AlertTriangle, Sparkles, UserCheck } from 'lucide-react';

interface AchievementBadge {
  id: string;
  title: string;
  desc: string;
  unlocked?: boolean;
}

interface UserHistoryData {
  telegramId: string;
  eventsJoined: number;
  codesSuccessfullyClaimed: number;
  rewardsEarned: number;
  failedAttempts: number;
  fastestTypingSec: number;
  avgTypingSpeedSec: number;
  securityScore: number;
  securityBadge: 'TRUSTED' | 'SUSPICIOUS' | 'HIGH_RISK';
  achievementBadges: AchievementBadge[];
  claimsHistory: Array<{
    eventId: string;
    code: string;
    reward: number;
    claimedAt: number;
    typingSpeedSec: number;
  }>;
}

interface UserRedeemHistoryProps {
  telegramId: string;
}

export const UserRedeemHistory: React.FC<UserRedeemHistoryProps> = ({ telegramId }) => {
  const [history, setHistory] = useState<UserHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!telegramId) return;
    setLoading(true);
    fetch(`/api/live-event/user-history?telegramId=${encodeURIComponent(telegramId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.userHistory) {
          setHistory(data.userHistory);
        }
      })
      .catch((err) => console.error('Failed to load user history:', err))
      .finally(() => setLoading(false));
  }, [telegramId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
        <p className="mt-3 text-sm">Fetching Personal Redeem Vault & Badges...</p>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-400">
        <History className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-2 text-sm">No redeem history found for Telegram ID {telegramId}.</p>
      </div>
    );
  }

  const allBadgeCatalog: AchievementBadge[] = [
    { id: 'speed_demon', title: '⚡ Speed Demon', desc: 'Typing speed under 2.0s' },
    { id: 'first_blood', title: '🏆 First Blood', desc: 'Claimed at least 1 live event code' },
    { id: 'golden_hunter', title: '🎁 Golden Hunter', desc: 'Earned ₹50+ in rewards' },
    { id: 'verified_human', title: '🛡️ Verified Human', desc: 'High security score & no bot flags' },
    { id: 'streak_master', title: '🔥 Streak Master', desc: 'Joined 3+ live events' },
    { id: 'accuracy_master', title: '🎯 Accuracy Master', desc: '100% submission accuracy' },
  ];

  const unlockedIds = new Set(history.achievementBadges.map((b) => b.id));

  return (
    <div className="space-y-6 text-white">
      {/* Header Profile Summary */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-gray-900 via-amber-950/20 to-gray-900 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-xl shadow-lg">
              {telegramId.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-amber-300">Telegram #{telegramId}</h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> VERIFIED PARTICIPANT
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Personal Live Event History & Achievement Vault</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-800 bg-black/50 px-4 py-2 text-right">
              <span className="text-[11px] text-gray-400 block">Security Rating</span>
              <span className="text-sm font-bold text-emerald-400 flex items-center justify-end gap-1">
                <ShieldCheck className="h-4 w-4" /> {history.securityScore}% ({history.securityBadge})
              </span>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-800/80 bg-black/40 p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <History className="h-3.5 w-3.5 text-amber-400" /> Events Joined
            </span>
            <span className="mt-1 text-xl font-bold text-amber-300 block">{history.eventsJoined}</span>
          </div>

          <div className="rounded-xl border border-gray-800/80 bg-black/40 p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 text-emerald-400" /> Codes Claimed
            </span>
            <span className="mt-1 text-xl font-bold text-emerald-300 block">{history.codesSuccessfullyClaimed}</span>
          </div>

          <div className="rounded-xl border border-gray-800/80 bg-black/40 p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-cyan-400" /> Fastest Speed
            </span>
            <span className="mt-1 text-xl font-bold text-cyan-300 block">{history.fastestTypingSec}s</span>
          </div>

          <div className="rounded-xl border border-gray-800/80 bg-black/40 p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-purple-400" /> Total Rewards
            </span>
            <span className="mt-1 text-xl font-bold text-purple-300 block">₹{history.rewardsEarned}</span>
          </div>
        </div>
      </div>

      {/* Achievement Badges Section */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
        <h3 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-400" />
          <span>Unlocked Achievements & Badges ({unlockedIds.size} / {allBadgeCatalog.length})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {allBadgeCatalog.map((badge) => {
            const isUnlocked = unlockedIds.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-3.5 transition flex items-start gap-3 ${
                  isUnlocked
                    ? 'border-amber-500/40 bg-amber-500/10 text-white'
                    : 'border-gray-800 bg-gray-950/40 text-gray-500 opacity-60'
                }`}
              >
                <div className={`mt-0.5 text-2xl ${isUnlocked ? 'filter-none' : 'grayscale'}`}>
                  {badge.title.split(' ')[0]}
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isUnlocked ? 'text-amber-300' : 'text-gray-400'}`}>
                    {badge.title}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-gray-400">{badge.desc}</p>
                  <span className="mt-1.5 inline-block text-[10px] font-mono font-bold">
                    {isUnlocked ? '✅ UNLOCKED' : '🔒 LOCKED'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Claims Log */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
        <h3 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-400" />
          <span>Claim History Log</span>
        </h3>

        {history.claimsHistory.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            No live redeem claims recorded yet. Join the next active event!
          </p>
        ) : (
          <div className="space-y-2">
            {history.claimsHistory.map((claim, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/40 p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="font-mono font-bold text-amber-300 text-sm">{claim.code}</span>
                    <p className="text-gray-400 text-[11px]">
                      Claimed at {new Date(claim.claimedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-emerald-400 text-sm">+₹{claim.reward}</span>
                  <span className="block text-[11px] text-gray-400 font-mono">{claim.typingSpeedSec}s speed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
