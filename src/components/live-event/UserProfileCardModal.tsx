import React, { useState, useEffect } from 'react';
import { X, Award, ShieldCheck, Zap, Trophy, Flame, Users, Calendar, CheckCircle2 } from 'lucide-react';

interface UserProfileCardModalProps {
  telegramId: string;
  onClose: () => void;
}

export const UserProfileCardModal: React.FC<UserProfileCardModalProps> = ({ telegramId, onClose }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [telegramId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/user-profile?telegramId=${encodeURIComponent(telegramId)}`);
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative text-white">
        {/* Header Background */}
        <div className="h-28 bg-gradient-to-r from-amber-600 via-purple-700 to-indigo-800 p-4 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar & Main Badge */}
        <div className="px-6 relative -mt-12 mb-4 flex items-end justify-between">
          <div className="relative">
            <img
              src={profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${telegramId}`}
              alt="Avatar"
              className="w-20 h-20 rounded-2xl border-4 border-slate-900 bg-slate-800 shadow-xl object-cover"
            />
            <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-slate-900 text-[10px] text-white" title="Verified">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-black text-xs rounded-full shadow-lg inline-flex items-center gap-1">
              {profile?.levelBadge || '👑 Legend'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">
              Score: {profile?.activityScore || 2850} Pts
            </span>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading Profile Telemetry...
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-5">
            {/* User Title & Info */}
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {profile?.userName || `User #${telegramId}`}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Telegram ID: {profile?.telegramId}
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <span className="text-xs text-slate-400 block">Redeem Wins</span>
                <span className="text-lg font-bold text-white">{profile?.redeemWins || 0}</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Zap className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <span className="text-xs text-slate-400 block">Typing Speed</span>
                <span className="text-lg font-bold text-purple-400">{profile?.fastestTypingSpeedSec || 2.1}s</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Flame className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-xs text-slate-400 block">Rewards</span>
                <span className="text-lg font-bold text-emerald-400">₹{profile?.rewardsEarned || 0}</span>
              </div>
            </div>

            {/* Achievements List */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Unlocked Achievements
              </h4>
              <div className="space-y-2">
                {profile?.achievements?.map((ach: any) => (
                  <div
                    key={ach.id}
                    className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 ${ach.unlocked ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <div>
                        <span className="font-bold text-slate-200 block">{ach.title}</span>
                        <span className="text-[10px] text-slate-400">{ach.desc}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ach.unlocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      {ach.unlocked ? 'UNLOCKED' : 'LOCKED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Details Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" /> Referrals: {profile?.referralCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Joined: {profile?.joinedDate || '2026-08-01'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
