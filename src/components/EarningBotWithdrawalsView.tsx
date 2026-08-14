import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Search,
  RefreshCw,
  Coins,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Bot,
  Filter,
  Check,
  X,
  CreditCard
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { apiFetch } from '../utils/api';

interface EarningBot {
  id: string;
  botName: string;
  botUsername: string;
  botId: string;
}

interface EarningBotWithdrawalsViewProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const EarningBotWithdrawalsView: React.FC<EarningBotWithdrawalsViewProps> = ({ showToast }) => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [bots, setBots] = useState<EarningBot[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBotId, setSelectedBotId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [methodFilter, setMethodFilter] = useState<'all' | 'UPI' | 'REDEEM_CODE' | 'ULTRA_PAY'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection reason handling
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Details verification failed');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Fetch Bots list for selection
  const fetchBots = async () => {
    try {
      const res = await apiFetch('/api/admin/earning-bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.bots || []);
      }
    } catch (err) {
      console.error('Error fetching bots in withdrawals page:', err);
    }
  };

  useEffect(() => {
    fetchBots();

    // Set up real-time subscription to global withdrawals collection
    setLoading(true);
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const recordBotId = data.botId || (data.earningBotId ? data.earningBotId : 'roy-share-wallet');
          // ONLY include withdrawals that belong to an Earning Bot
          // EXCLUDE withdrawals that are for the global Roy Share Wallet
          if (recordBotId && recordBotId !== 'roy-share-wallet') {
            records.push({
              id: doc.id,
              ...data,
            });
          }
        });
        setWithdrawals(records);
        setLoading(false);
      },
      (error) => {
        console.error('Error in real-time withdrawals snapshot:', error);
        showToast('Error listening to withdrawal updates', 'error');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (wdId: string, botId: string) => {
    if (!confirm('Are you sure you want to approve and payout this withdrawal request?')) return;
    setIsProcessing(wdId);
    try {
      const res = await apiFetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wdId, botId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Withdrawal marked APPROVED & payment started successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to approve withdrawal', 'error');
      }
    } catch (err) {
      showToast('Network error during approval', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (wdId: string, botId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please enter a rejection reason.', 'error');
      return;
    }
    setIsProcessing(wdId);
    try {
      const res = await apiFetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: wdId, reason: rejectReason, botId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Withdrawal rejected and balance fully refunded.', 'success');
        setRejectingId(null);
      } else {
        showToast(data.error || 'Failed to reject withdrawal', 'error');
      }
    } catch (err) {
      showToast('Network error during rejection', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // Filter & Search Logic
  const filteredWithdrawals = withdrawals.filter((w) => {
    // 1. Bot Filter
    if (selectedBotId !== 'all') {
      const recordBotId = w.botId || (w.earningBotId ? w.earningBotId : 'roy-share-wallet');
      if (recordBotId !== selectedBotId) return false;
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      const currentStatus = String(w.status).toUpperCase();
      if (statusFilter === 'APPROVED') {
        if (currentStatus !== 'APPROVED' && currentStatus !== 'PAID') return false;
      } else if (currentStatus !== statusFilter) {
        return false;
      }
    }

    // 3. Method Filter
    if (methodFilter !== 'all' && String(w.method).toUpperCase() !== methodFilter.toUpperCase()) return false;

    // 4. Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = String(w.fullName || '').toLowerCase().includes(query);
      const matchTg = String(w.telegramId || '').toLowerCase().includes(query);
      const matchId = String(w.withdrawalId || '').toLowerCase().includes(query);
      const matchUpi = String(w.upiId || '').toLowerCase().includes(query);
      const matchPayto = String(w.paytoNumber || '').toLowerCase().includes(query);
      if (!matchName && !matchTg && !matchId && !matchUpi && !matchPayto) return false;
    }

    return true;
  });

  // Calculate high-fidelity stats for filtered list or globally
  const stats = {
    pendingCount: withdrawals.filter(w => w.status === 'PENDING').length,
    pendingTotal: withdrawals.filter(w => w.status === 'PENDING').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    approvedCount: withdrawals.filter(w => w.status === 'APPROVED' || w.status === 'PAID').length,
    approvedTotal: withdrawals.filter(w => w.status === 'APPROVED' || w.status === 'PAID').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    rejectedCount: withdrawals.filter(w => w.status === 'REJECTED').length,
    rejectedTotal: withdrawals.filter(w => w.status === 'REJECTED').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Coins className="text-orange-500 w-6 h-6" />
            <span>GLOBAL EARNING BOT WITHDRAWALS</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5 font-bold">
            Isolated withdrawal accounting pipeline.
          </p>
        </div>
      </div>

      {/* Stats Summary Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 shadow-lg shadow-orange-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Coins className="w-12 h-12 text-amber-500" />
          </div>
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending Verification</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">₹{stats.pendingTotal}</span>
            <span className="text-xs text-slate-500 font-bold">({stats.pendingCount} requests)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 shadow-lg shadow-emerald-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Settled (Paid)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">₹{stats.approvedTotal}</span>
            <span className="text-xs text-slate-500 font-bold">({stats.approvedCount} settled)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 shadow-lg shadow-rose-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <XCircle className="w-12 h-12 text-rose-500" />
          </div>
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Rejected & Refunded</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono">₹{stats.rejectedTotal}</span>
            <span className="text-xs text-slate-500 font-bold">({stats.rejectedCount} requests)</span>
          </div>
        </div>
      </div>

      {/* Control Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* 1. Bot Filter */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Earning Bot</label>
            <div className="relative">
              <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none appearance-none"
              >
                <option value="all">All Earning Bots</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.botName} (@{b.botUsername})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Method Filter */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Payment Method</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none appearance-none"
              >
                <option value="all">All Methods</option>
                <option value="UPI">UPI Payment</option>
                <option value="REDEEM_CODE">Redeem Code</option>
                <option value="ULTRA_PAY">Ultra Pay</option>
              </select>
            </div>
          </div>

          {/* 3. Search Query */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by ID, Username, Telegram ID, UPI ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/50">
          {(['ALL', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-slate-950 font-black shadow-md shadow-orange-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List Rendering */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-bold uppercase text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
          <span>Syncing withdrawals ledger...</span>
        </div>
      ) : filteredWithdrawals.length === 0 ? (
        <div className="py-16 text-center text-slate-500 font-bold uppercase text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
          No matching earning bot withdrawal records found.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredWithdrawals.map((w) => {
            const isRejectedActive = rejectingId === w.id;
            const targetBot = bots.find(b => b.id === w.earningBotId);

            return (
              <div
                key={w.id}
                className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-800 transition-all duration-300 space-y-4 shadow-lg"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-sm">{w.fullName || 'Earning Bot User'}</span>
                      <span className="text-xs text-slate-400 font-mono">({w.telegramId})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>ID: {w.withdrawalId}</span>
                      <span>•</span>
                      <span>Time: {new Date(w.createdAt).toLocaleString()}</span>
                      {targetBot && (
                        <>
                          <span>•</span>
                          <span className="text-orange-400 font-bold">Bot: {targetBot.botName} (@{targetBot.botUsername})</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                      w.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      w.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      (w.status === 'APPROVED' || w.status === 'PAID') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {w.status}
                    </span>
                    <span className="text-base font-black text-orange-400 font-mono">₹{w.amount}</span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-900">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Payment Method</span>
                    <span className="text-xs font-bold text-slate-300 font-mono mt-0.5">{w.method}</span>
                  </div>
                  <div className="flex flex-col sm:col-span-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Account Information</span>
                    <span className="text-xs font-bold text-white font-mono break-all mt-0.5">
                      {w.method === 'UPI' ? w.upiId : w.paytoNumber || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Action forms/buttons */}
                {isRejectedActive && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-rose-500/30 space-y-2.5">
                    <label className="block text-[10px] font-black text-rose-400 uppercase tracking-wider">Rejection Reason</label>
                    <input
                      type="text"
                      placeholder="Please specify why this request is being rejected..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('Details verification failed');
                        }}
                        className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={isProcessing === w.id}
                        onClick={() => handleReject(w.id, w.botId || w.earningBotId)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-slate-950 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isProcessing === w.id ? 'Rejecting...' : 'Reject & Refund'}
                      </button>
                    </div>
                  </div>
                )}

                {w.status === 'PENDING' && !isRejectedActive && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      disabled={isProcessing === w.id}
                      onClick={() => handleApprove(w.id, w.botId || w.earningBotId)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isProcessing === w.id ? 'Processing...' : 'Approve & Payout'}</span>
                    </button>
                    <button
                      disabled={isProcessing === w.id}
                      onClick={() => {
                        setRejectingId(w.id);
                        setRejectReason('Details verification failed');
                      }}
                      className="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
