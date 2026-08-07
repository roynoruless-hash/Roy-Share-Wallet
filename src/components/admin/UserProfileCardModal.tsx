import React, { useState, useEffect } from 'react';
import { X, User, Wallet, Shield, Clock, Phone, AlertCircle, CheckCircle, Ban } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface UserProfileCardModalProps {
  telegramId: string;
  onClose: () => void;
}

export const UserProfileCardModal: React.FC<UserProfileCardModalProps> = ({ telegramId, onClose }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const usersRef = collection(db, 'users');
        // Try searching by telegramId
        const qByTg = query(usersRef, where('telegramId', '==', telegramId), limit(1));
        const snapByTg = await getDocs(qByTg);
        
        let foundUser: any = null;
        if (!snapByTg.empty) {
          foundUser = snapByTg.docs[0].data();
          foundUser.id = snapByTg.docs[0].id;
        } else {
          // Fallback search by doc ID / uid
          const qByUid = query(usersRef, where('uid', '==', telegramId), limit(1));
          const snapByUid = await getDocs(qByUid);
          if (!snapByUid.empty) {
            foundUser = snapByUid.docs[0].data();
            foundUser.id = snapByUid.docs[0].id;
          }
        }

        if (foundUser) {
          setUser(foundUser);
        } else {
          setError('User profile not found in database.');
        }
      } catch (err: any) {
        console.error('Error fetching user profile modal:', err);
        setError(err.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [telegramId]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative text-white">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">User Details</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading profile...
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-red-400 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {!loading && !error && user && (
            <div className="space-y-5 text-xs">
              {/* Profile Card Intro */}
              <div className="flex items-center gap-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                  {(user.firstName || user.username || 'U')[0].toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-100">{user.firstName || 'User'}</h4>
                  <p className="text-slate-400 font-mono">@{user.username || 'no_username'}</p>
                </div>
              </div>

              {/* Stats & Key Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Balance</span>
                    <span className="font-bold text-cyan-400">₹{user.walletBalance || 0}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Status</span>
                    <span className={`font-semibold ${user.banned ? 'text-red-400' : 'text-emerald-400'}`}>
                      {user.banned ? 'Banned' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Info */}
              <div className="space-y-2.5 bg-slate-950/20 p-4 rounded-2xl border border-slate-800/60 font-mono text-[11px]">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-500">App UID</span>
                  <span className="text-sky-400 font-bold select-all">{user.appUid || user.uid || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-500">Telegram ID</span>
                  <span className="text-slate-300 select-all">{user.telegramId || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-500">Contact No.</span>
                  <span className="text-slate-300">{user.mobile || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-500">Total Referrals</span>
                  <span className="text-slate-300 font-bold">{user.totalReferrals || 0}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-500">Channel Verified</span>
                  <span className="text-slate-300 flex items-center gap-1">
                    {user.channelVerified ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Joined Date</span>
                  <span className="text-slate-300">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {user.banned && user.banReason && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 flex items-start gap-2 text-[11px]">
                  <Ban className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Ban Reason:</span>
                    <p className="leading-relaxed">{user.banReason}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
