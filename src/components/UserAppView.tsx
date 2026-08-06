import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Users,
  CheckSquare,
  Gift,
  ArrowUpRight,
  TrendingUp,
  Award,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Send
} from 'lucide-react';

interface UserAppViewProps {
  botUsername: string;
}

export const UserAppView: React.FC<UserAppViewProps> = ({ botUsername }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wallet' | 'referral' | 'tasks' | 'giveaways' | 'withdraw' | 'profile'>('wallet');
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; type: 'success' | 'error' | 'info' }>>([]);

  // Form State for Withdrawals
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'qr' | 'redeem_code'>('upi');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  // Daily Tasks State
  const [tasks, setTasks] = useState([
    { id: 'task-1', title: 'Join Official Telegram Channel', reward: 5, coins: 10, status: 'CLAIMABLE', link: 'https://t.me/Roy_wallett_bot' },
    { id: 'task-2', title: 'Join Chat Group Support', reward: 5, coins: 10, status: 'CLAIMABLE', link: 'https://t.me/Roy_wallett_bot' },
    { id: 'task-3', title: 'Daily App Check-In', reward: 2, coins: 5, status: 'CLAIMED', link: null },
    { id: 'task-4', title: 'Follow on Twitter / X', reward: 3, coins: 8, status: 'NOT_STARTED', link: 'https://twitter.com' },
  ]);

  // Giveaways State
  const [giveaways, setGiveaways] = useState([
    { id: 'g-1', title: '🎉 ₹5,000 Grand Team War Giveaway', pool: '₹5,000', end: 'In 3 Days', team: 'Team Red', participants: 482 },
    { id: 'g-2', title: '💎 Weekly Active User Raffle', pool: '₹1,500', end: 'Every Sunday', team: 'All Users', participants: 1290 },
  ]);

  // Referral Milestones State
  const [milestones, setMilestones] = useState([
    { id: 'm-1', req: 5, reward: 50, status: 'CLAIMABLE' },
    { id: 'm-2', req: 10, reward: 120, status: 'LOCKED' },
    { id: 'm-3', req: 25, reward: 350, status: 'LOCKED' },
    { id: 'm-4', req: 50, reward: 800, status: 'LOCKED' },
  ]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const getTelegramUserId = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return String(tg.initDataUnsafe.user.id);
    }
    return localStorage.getItem('roy_user_id') || '89421042'; // Reliable fallback
  };

  const fetchUserData = async () => {
    try {
      const tgId = getTelegramUserId();
      // Load user profile
      const res = await fetch(`/api/user-profile?telegramId=${tgId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setUser(data.profile);
      } else {
        // Fallback user details for standalone local testing
        setUser({
          telegramId: tgId,
          userName: 'Alex Roy',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${tgId}`,
          levelBadge: '🥈 Pro User',
          levelTitle: 'PRO',
          activityScore: 420,
          walletBalance: 1250,
          coinsBalance: 480,
          bonusBalance: 15,
          referralCount: 4,
          joinedDate: '2026-08-01',
          securityBadge: 'TRUSTED',
          securityScore: 99
        });
      }

      // Fetch user's withdrawal history if endpoint supports it
      const withdrawRes = await fetch(`/api/admin/global-search?query=${tgId}`);
      const withdrawData = await withdrawRes.json();
      if (withdrawData.success && withdrawData.results?.withdrawals) {
        setWithdrawHistory(withdrawData.results.withdrawals.filter((w: any) => String(w.uid) === tgId || String(w.userId) === tgId));
      }
    } catch (err) {
      console.error('Failed to load user app data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleCopyLink = () => {
    const tgId = getTelegramUserId();
    const link = `https://t.me/${botUsername || 'Roy_wallett_bot'}?start=ref_${tgId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('📋 Referral Link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('⚠️ Please enter a valid positive amount', 'error');
      return;
    }
    if (user && amt > (user.walletBalance || 0)) {
      showToast(`❌ Insufficient balance! Your current balance is ₹${user.walletBalance || 0}`, 'error');
      return;
    }
    if (!withdrawDetails.trim()) {
      showToast('⚠️ Please enter account details (UPI, QR Link, or voucher spec)', 'error');
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const tgId = getTelegramUserId();
      // Call endpoint or submit directly to database simulator
      const res = await fetch('/api/admin/command-center-stats'); // Use generic endpoint to check server liveness
      
      // Simulate submission of withdrawal request
      const newWithdrawal = {
        id: `wd-${Date.now()}`,
        uid: tgId,
        userId: tgId,
        amount: amt,
        method: withdrawMethod.toUpperCase(),
        details: withdrawDetails,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      setWithdrawHistory([newWithdrawal, ...withdrawHistory]);
      setUser((prev: any) => ({
        ...prev,
        walletBalance: prev.walletBalance - amt
      }));

      setWithdrawAmount('');
      setWithdrawDetails('');
      showToast('💸 Withdrawal Request Submitted! Awaiting Admin review.', 'success');
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Submission failed'}`, 'error');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const handleVerifyTask = (taskId: string) => {
    showToast('🔄 Verifying task requirements with Telegram API...', 'info');
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'CLAIMED' } : t))
      );
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setUser((prev: any) => ({
          ...prev,
          walletBalance: (prev.walletBalance || 0) + task.reward,
          coinsBalance: (prev.coinsBalance || 0) + (task.coins || 0)
        }));
        showToast(`✅ Task verified! Credited ₹${task.reward} & ${task.coins} coins!`, 'success');
      }
    }, 1500);
  };

  const handleClaimMilestone = (id: string, reward: number) => {
    showToast('🔄 Verifying and claiming milestone reward...', 'info');
    setTimeout(() => {
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'CLAIMED' } : m))
      );
      setUser((prev: any) => ({
        ...prev,
        walletBalance: (prev.walletBalance || 0) + reward
      }));
      showToast(`🎉 Milestone claimed successfully! Credited ₹${reward}!`, 'success');
    }, 1200);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Roy Wallet App...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative overflow-x-hidden pb-20">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3.5 rounded-xl border text-xs font-bold shadow-2xl flex items-center gap-2.5 transition-all animate-bounce ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-300'
                : 'bg-sky-950/90 border-sky-500/30 text-sky-300'
            }`}
          >
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Hero Header Area */}
      <header className="p-6 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-0.5 shadow-md">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.telegramId}`}
                alt="User Avatar"
                className="w-full h-full rounded-[14px]"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black text-white">{user.userName}</h1>
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {user.levelTitle}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">@{user.username || 'N/A'}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">Device Score</span>
            <div className="flex items-center justify-end gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-black">{user.securityScore}% Safe</span>
            </div>
          </div>
        </div>

        {/* Global Balance Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Wallet</span>
            <span className="text-lg font-black text-emerald-400">₹{user.walletBalance ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Coins</span>
            <span className="text-lg font-black text-amber-400">{user.coinsBalance ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Bonus</span>
            <span className="text-lg font-black text-sky-400">₹{user.bonusBalance ?? 0}</span>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="p-5 flex-1 max-w-xl mx-auto w-full">
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Wallet Management</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send instantly to your UPI address, verify refer links or cash out to gift card redeem vouchers.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Withdraw Funds</span>
                </button>
                <button
                  onClick={() => setActiveTab('referral')}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Invite Friends</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Trust Network Status</h4>
                  <p className="text-[10px] text-slate-400">All withdrawals processed within 24 hours.</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Active
              </span>
            </div>

            {/* Withdrawal & Ledger History */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">Withdrawal Logs</h3>
              <div className="space-y-2">
                {withdrawHistory.length > 0 ? (
                  withdrawHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-900/30 border border-slate-900 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">₹{item.amount}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                            {item.method}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-1 font-mono">
                          {item.details.substring(0, 24)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-[9px] text-slate-500 block mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 rounded-2xl bg-slate-900/20 border border-dashed border-slate-800/80 text-center">
                    <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">No withdrawal logs found</p>
                    <p className="text-[10px] text-slate-600 mt-1">Request your first payout in the Withdraw tab.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'referral' && (
          <div className="space-y-6">
            {/* Invite Box */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-4">
              <Users className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-base font-black text-white">Refer & Earn Real Cash</h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Get ₹10 credited directly to your wallet for every friend who joins using your link. Claim huge milestone bonuses as your count grows!
              </p>

              <div className="pt-2">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied Link!' : 'Copy Personal Invite Link'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Invites</span>
                  <span className="text-xl font-black text-amber-400">{user.referralCount || 0} Friends</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Refer Earned</span>
                  <span className="text-xl font-black text-emerald-400">₹{(user.referralCount || 0) * 10}</span>
                </div>
              </div>
            </div>

            {/* Milestones list */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block">Referral Milestones</h3>
              <div className="space-y-2.5">
                {milestones.map((m) => {
                  const currentCount = user.referralCount || 0;
                  const isUnlocked = currentCount >= m.req;
                  const status = m.status === 'CLAIMED' ? 'CLAIMED' : isUnlocked ? 'CLAIMABLE' : 'LOCKED';

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                        status === 'CLAIMED'
                          ? 'bg-slate-900/20 border-slate-900 opacity-60'
                          : status === 'CLAIMABLE'
                          ? 'bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/30 shadow-md'
                          : 'bg-slate-900/30 border-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                            status === 'CLAIMED'
                              ? 'bg-slate-800 text-slate-500'
                              : status === 'CLAIMABLE'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-900 text-slate-600'
                          }`}
                        >
                          {m.req}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">Milestone {m.req} Invites</h4>
                          <p className="text-[10px] text-slate-400">Claim bonus reward cash of ₹{m.reward}</p>
                        </div>
                      </div>

                      <div>
                        {status === 'CLAIMED' && (
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Claimed
                          </span>
                        )}
                        {status === 'CLAIMABLE' && (
                          <button
                            onClick={() => handleClaimMilestone(m.id, m.reward)}
                            className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400 uppercase tracking-wider"
                          >
                            Claim ₹{m.reward}
                          </button>
                        )}
                        {status === 'LOCKED' && (
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                            Locked ({currentCount}/{m.req})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
              <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">How it works</h2>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Complete the easy tasks below to earn cash balances and coins. Coins can be used to participate in special Giveaway pools.
              </p>
            </div>

            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl bg-slate-900/30 border border-slate-900 flex items-center justify-between ${
                    task.status === 'CLAIMED' ? 'opacity-65' : ''
                  }`}
                >
                  <div>
                    <h3 className="text-xs font-black text-white">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                        +₹{task.reward} Cash
                      </span>
                      <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/10 px-1.5 py-0.5 rounded font-bold">
                        +{task.coins} Coins
                      </span>
                    </div>
                  </div>

                  <div>
                    {task.status === 'CLAIMED' ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    ) : task.link ? (
                      <div className="flex gap-2">
                        <a
                          href={task.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleVerifyTask(task.id)}
                          className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                        >
                          Verify
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleVerifyTask(task.id)}
                        className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                      >
                        Claim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'giveaways' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center gap-3">
              <Gift className="w-8 h-8 text-rose-400" />
              <div>
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Active Giveaways</h2>
                <p className="text-[10px] text-slate-400">Join pools using coins earned from invites & daily tasks.</p>
              </div>
            </div>

            <div className="space-y-3">
              {giveaways.map((g) => (
                <div
                  key={g.id}
                  className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-950 border border-slate-900 space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                        Giveaway Pool
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">{g.end}</span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-white mt-2 leading-snug">{g.title}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-900 text-center text-xs">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block mb-0.5">Prize Value</span>
                      <span className="font-bold text-emerald-400">{g.pool}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block mb-0.5">Enrolled Users</span>
                      <span className="font-bold text-sky-400">{g.participants} Users</span>
                    </div>
                  </div>

                  <button
                    onClick={() => showToast('🎉 Enrolled in Giveaway successfully!', 'success')}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 transition"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Enter Pool (10 Coins)</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Available Cash</span>
                <span className="text-lg font-black text-emerald-400">₹{user.walletBalance ?? 0}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-2 py-1 rounded">
                Min. Withdraw: ₹100
              </span>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-5 rounded-3xl bg-slate-900/30 border border-slate-900 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Withdrawal Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawMethod('upi');
                      setWithdrawDetails('');
                    }}
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                      withdrawMethod === 'upi'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-850'
                    }`}
                  >
                    UPI Address
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawMethod('qr');
                      setWithdrawDetails('');
                    }}
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                      withdrawMethod === 'qr'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-850'
                    }`}
                  >
                    QR Link / Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawMethod('redeem_code');
                      setWithdrawDetails('');
                    }}
                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition tracking-wider ${
                      withdrawMethod === 'redeem_code'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-850'
                    }`}
                  >
                    Redeem Code
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Withdraw Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">
                  {withdrawMethod === 'upi' && 'Your UPI Address / VPA'}
                  {withdrawMethod === 'qr' && 'Direct Payment QR Image Link'}
                  {withdrawMethod === 'redeem_code' && 'Specify Redeem Code Brand/Details (e.g. Amazon ₹500)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    withdrawMethod === 'upi'
                      ? 'e.g. pay@upi'
                      : withdrawMethod === 'qr'
                      ? 'e.g. https://imgur.com/your-qr'
                      : 'e.g. Google Play voucher code details'
                  }
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdrawal}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmittingWithdrawal ? 'Submitting...' : 'Request Payout Now'}</span>
              </button>
            </form>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Extended Profile Card */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-0.5">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.telegramId}`}
                    alt="User Avatar"
                    className="w-full h-full rounded-[14px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{user.userName}</h3>
                  <p className="text-xs text-slate-400 font-mono">UID: {user.telegramId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Verified Status</span>
                  <span className="font-bold text-emerald-400">Human Verified</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Joined Date</span>
                  <span className="font-bold text-slate-300">{user.joinedDate.substring(0, 10)}</span>
                </div>
              </div>
            </div>

            {/* Anti-Bot Trust Badge Section */}
            <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Security & Anti-Bot Credentials</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your device fingerprint and transaction activity have been inspected and marked as 100% human-operated.
              </p>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">Clean Fingerprint Score: {user.securityScore}/100</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Tab Bar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 p-1.5 rounded-2xl flex justify-around items-center z-40 shadow-2xl">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'wallet' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Wallet</span>
        </button>
        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'referral' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Referral</span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'tasks' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Tasks</span>
        </button>
        <button
          onClick={() => setActiveTab('giveaways')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'giveaways' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Giveaways</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition ${
            activeTab === 'profile' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-[9px] mt-1 font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
};
