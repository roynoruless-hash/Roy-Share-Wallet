import React, { useState, useEffect } from 'react';
import {
  ArrowDownRight,
  QrCode,
  CreditCard,
  Gift,
  Clock,
  ToggleLeft,
  ToggleRight,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  AlertCircle,
  DollarSign,
  Percent,
  User,
  ShieldAlert,
  MessageSquare,
  Eye,
  Send,
  ExternalLink,
  Download,
  CheckSquare,
  Square,
  Trash2,
  Lock,
  Sparkles,
  Activity
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AdminConfig, WithdrawalRecord } from '../types';
import { authenticatedFetch } from '../utils/api';

interface WithdrawalSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const WithdrawalSettingsView: React.FC<WithdrawalSettingsViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
}) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'qr' | 'redeem_code' | 'ultra_pay'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Bulk action states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Modal states
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('Details verification failed');

  const [messagingUser, setMessagingUser] = useState<{ telegramId: string; userName?: string } | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRecord | null>(null);
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);

  // Stats
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    } catch (e) {
      return false;
    }
  };

  const pendingCountForStats = withdrawals.filter((w) => {
    return String(w.status).toLowerCase() === 'pending';
  }).length;

  const approvedTodayCount = withdrawals.filter((w) => {
    const s = String(w.status).toLowerCase();
    return (s === 'completed' || s === 'approved') && isToday(w.processedAt || w.createdAt);
  }).length;

  const rejectedTodayCount = withdrawals.filter((w) => {
    return String(w.status).toLowerCase() === 'rejected' && isToday(w.processedAt || w.createdAt);
  }).length;

  const totalApprovedAmount = withdrawals
    .filter((w) => {
      const s = String(w.status).toLowerCase();
      return s === 'completed' || s === 'approved';
    })
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  // Real-time Firestore Listener for withdrawals
  useEffect(() => {
    setLoading(true);

    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WithdrawalRecord[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          // Filter to show only Roy Share Wallet withdrawals (not associate with Earning Bots)
          const recordBotId = data.botId || (data.earningBotId ? data.earningBotId : 'roy-share-wallet');
          if (recordBotId === 'roy-share-wallet') {
            list.push({ id: doc.id, ...(data as Omit<WithdrawalRecord, 'id'>) });
          }
        });

        const sorted = list.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        const pendingList = sorted.filter(w => String(w.status).toLowerCase() === 'pending');
        console.log(`[Firestore Query] Admin Panel loaded ${sorted.length} total withdrawal records (${pendingList.length} PENDING) from 'withdrawals' collection.`);

        setWithdrawals(sorted);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching withdrawals collection:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter((w) => {
    const statusLower = String(w.status).toLowerCase();
    const filterLower = statusFilter.toLowerCase();
    const matchesStatus =
      statusFilter === 'all' ||
      statusLower === filterLower ||
      (statusLower === 'completed' && filterLower === 'approved') ||
      (statusLower === 'approved' && filterLower === 'approved');

    const itemMethod = String(w.method || 'upi').toLowerCase();
    const matchesMethod = methodFilter === 'all' || itemMethod === methodFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      w.withdrawalId?.toLowerCase().includes(q) ||
      w.requestId?.toLowerCase().includes(q) ||
      w.uid?.toLowerCase().includes(q) ||
      w.telegramId?.toLowerCase().includes(q) ||
      w.upiId?.toLowerCase().includes(q) ||
      w.redeemCodeDetails?.toLowerCase().includes(q) ||
      w.userName?.toLowerCase().includes(q) ||
      w.username?.toLowerCase().includes(q);

    return matchesStatus && matchesMethod && matchesSearch;
  });

  const pendingCount = withdrawals.filter((w) => {
    return String(w.status).toLowerCase() === 'pending';
  }).length;
  const completedCount = withdrawals.filter((w) => {
    const s = String(w.status).toLowerCase();
    return s === 'completed' || s === 'approved';
  }).length;
  const rejectedCount = withdrawals.filter((w) => {
    return String(w.status).toLowerCase() === 'rejected';
  }).length;

  // Selection handlers
  const handleSelectAll = () => {
    const pendingFiltered = filteredWithdrawals.filter(w => String(w.status).toLowerCase() === 'pending');
    if (selectedIds.length === pendingFiltered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingFiltered.map(w => w.id!));
    }
  };

  const handleSelectId = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to BULK APPROVE ${selectedIds.length} pending withdrawals?`)) return;

    setIsBulkProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    let successCount = 0;
    let failCount = 0;

    for (const docId of selectedIds) {
      try {
        const res = await authenticatedFetch('/api/admin/withdrawals/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: config.botToken,
            withdrawalId: docId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setActionSuccess(`Bulk approval complete. Successfully approved: ${successCount}. Failed: ${failCount}.`);
    setSelectedIds([]);
    setIsBulkProcessing(false);
  };

  // Bulk Reject
  const handleBulkRejectSubmit = async () => {
    if (selectedIds.length === 0) return;

    setIsBulkProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    let successCount = 0;
    let failCount = 0;

    for (const docId of selectedIds) {
      try {
        const res = await authenticatedFetch('/api/admin/withdrawals/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: config.botToken,
            withdrawalId: docId,
            reason: rejectReason,
          }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setActionSuccess(`Bulk rejection complete. Successfully rejected and refunded: ${successCount}. Failed: ${failCount}.`);
    setSelectedIds([]);
    setIsBulkRejecting(false);
    setIsBulkProcessing(false);
  };

  // Approve Handler
  const handleApprove = async (docId: string, withdrawalId: string) => {
    if (!docId) return;
    if (!confirm(`Are you sure you want to APPROVE withdrawal request #${withdrawalId}?`)) return;

    setProcessingId(docId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await authenticatedFetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          withdrawalId: docId,
          botId: 'roy-share-wallet',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Withdrawal #${withdrawalId} approved and processed successfully! User notified.`);
      } else {
        setActionError(data.error || 'Failed to approve withdrawal.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Server connection error.');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Submit Handler
  const handleRejectSubmit = async () => {
    if (!rejectingDocId) return;

    setProcessingId(rejectingDocId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await authenticatedFetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          withdrawalId: rejectingDocId,
          reason: rejectReason,
          botId: 'roy-share-wallet',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Withdrawal rejected successfully and funds automatically refunded to user wallet!`);
        setRejectingDocId(null);
      } else {
        setActionError(data.error || 'Failed to reject withdrawal.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Server connection error.');
    } finally {
      setProcessingId(null);
    }
  };

  // Send Direct Telegram Message Handler
  const handleSendMessageSubmit = async () => {
    if (!messagingUser || !directMessageText.trim()) return;

    setIsSendingMsg(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await authenticatedFetch('/api/admin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          telegramId: messagingUser.telegramId,
          message: directMessageText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Direct message sent to user ${messagingUser.userName || messagingUser.telegramId}!`);
        setMessagingUser(null);
        setDirectMessageText('');
      } else {
        setActionError(data.error || 'Failed to send direct message.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Server connection error.');
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Export Filtered to CSV Handler
  const handleExportCSV = () => {
    if (filteredWithdrawals.length === 0) return;

    // Build headers
    const headers = ['Withdrawal ID', 'UID', 'Telegram ID', 'Username', 'Name', 'Amount', 'Fee', 'Final Payout', 'Method', 'Payout Destination', 'Status', 'Requested Time'];
    
    const rows = filteredWithdrawals.map(w => {
      const m = String(w.method || 'upi').toLowerCase();
      const payoutDest = m === 'upi' ? (w.upiId || '') : (m === 'redeem_code' ? (w.redeemCodeDetails || '') : ((m === 'ultra_pay' || m === 'ultrapay') ? (w.paytoNumber || w.paymentDetails?.paytoNumber || '') : 'QR Code Image Upload'));
      return [
        w.withdrawalId || w.requestId || '',
        w.uid || '',
        w.telegramId || '',
        w.username || '',
        w.userName || 'User',
        w.requestedAmount !== undefined ? w.requestedAmount : w.amount,
        w.platformFee || 0,
        w.payoutAmount !== undefined ? w.payoutAmount : w.amount,
        w.method || 'upi',
        `"${String(payoutDest).replace(/"/g, '""')}"`,
        w.status || 'pending',
        w.createdAt || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `withdrawals_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* V3 Glass Header */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 p-[1.5px] shadow-lg shadow-orange-500/10 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-orange-400">
              <ArrowDownRight className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-wider uppercase">Withdrawal & Payout Management</h2>
            <p className="text-xs text-slate-400 font-semibold tracking-wide mt-0.5">
              Secure multi-channel payouts with automated ledger deductions & real-time Telegram confirmations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs font-black text-orange-400 flex items-center gap-1.5 tracking-wider uppercase">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>{pendingCount} Pending</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-black text-blue-400 flex items-center gap-1.5 tracking-wider uppercase">
            <CheckCircle2 className="w-4 h-4" />
            <span>{completedCount} Completed</span>
          </span>
        </div>
      </div>

      {/* Real-time analytical stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pending Requests</span>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-orange-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white font-mono">{pendingCountForStats}</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Requires manual confirmation</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Approved Today</span>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white font-mono">{approvedTodayCount}</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Disbursed to UPI endpoints</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Rejected Today</span>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white font-mono">{rejectedTodayCount}</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Automatically refunded back to wallet</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Approved Pool</span>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white font-mono">₹{totalApprovedAmount.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Accumulated cleared ledger volume</p>
          </div>
        </div>
      </div>

      {/* 1. CONFIGURATION SETTINGS */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <h3 className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            Withdrawal Master Controls & Method Configurations
          </h3>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300">Global Withdrawals</span>
            <button
              type="button"
              id="enable-all-withdrawals-toggle"
              onClick={() => {
                const currentVal = config.globalWithdrawalsEnabled !== undefined
                  ? config.globalWithdrawalsEnabled
                  : (config.allWithdrawalsEnabled !== false && config.enableWithdraw !== false);
                const newVal = !currentVal;
                updateConfig({
                  globalWithdrawalsEnabled: newVal,
                  allWithdrawalsEnabled: newVal,
                  enableWithdraw: newVal,
                });
              }}
              className={`p-1 rounded-lg transition flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-xl border ${
                (config.globalWithdrawalsEnabled !== false && config.allWithdrawalsEnabled !== false && config.enableWithdraw !== false)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {(config.globalWithdrawalsEnabled !== false && config.allWithdrawalsEnabled !== false && config.enableWithdraw !== false) ? (
                <>
                  <ToggleRight className="w-5 h-5" />
                  <span>ENABLED</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5" />
                  <span>DISABLED</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Calculation Model Selector */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-200 tracking-wide uppercase flex items-center gap-2">
            <Percent className="w-4 h-4 text-orange-400" />
            <span>Fee & Tax Deduction Calculation Model</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateConfig({ calculationModel: 'OPTION_A' })}
              className={`p-3.5 rounded-xl border text-left transition ${
                (config.calculationModel !== 'OPTION_B')
                  ? 'bg-orange-500/10 border-orange-500/40 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs">
                <span>Option A (Deduct From Amount)</span>
                {(config.calculationModel !== 'OPTION_B') && <CheckCircle2 className="w-4 h-4 text-orange-400" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                User enters <b>₹100</b>. Fee (e.g. 2%) + Tax = <b>₹2</b>. Wallet deducted: <b>₹100</b>. Final payout sent: <b>₹98</b>.
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateConfig({ calculationModel: 'OPTION_B' })}
              className={`p-3.5 rounded-xl border text-left transition ${
                (config.calculationModel === 'OPTION_B')
                  ? 'bg-orange-500/10 border-orange-500/40 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs">
                <span>Option B (Fee Added to Deduction)</span>
                {(config.calculationModel === 'OPTION_B') && <CheckCircle2 className="w-4 h-4 text-orange-400" />}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                User wants <b>₹100</b> payout. Fee (2%) + Tax = <b>₹2</b>. Wallet deducted: <b>₹102</b>. Final payout sent: <b>₹100</b>.
              </p>
            </button>
          </div>
        </div>

        {/* Individual Method Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* UPI Method */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">UPI ID Method</span>
              </div>
              <button
                type="button"
                onClick={() => updateConfig({ upiEnabled: !config.upiEnabled, enableUpi: !config.upiEnabled })}
                className={`p-1 transition ${config.upiEnabled !== false ? 'text-blue-400' : 'text-slate-600'}`}
              >
                {config.upiEnabled !== false ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Min Amount (₹)</label>
                <input
                  type="number"
                  value={config.upiMin || config.minWithdrawal || 50}
                  onChange={(e) => updateConfig({ upiMin: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Value</label>
                <input
                  type="number"
                  value={config.upiFee !== undefined ? config.upiFee : 2}
                  onChange={(e) => updateConfig({ upiFee: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Type</label>
                <select
                  value={config.upiFeeType || 'PERCENTAGE'}
                  onChange={(e) => updateConfig({ upiFeeType: e.target.value as any })}
                  className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                >
                  <option value="PERCENTAGE">% Percent</option>
                  <option value="FIXED">₹ Fixed</option>
                </select>
              </div>
            </div>
          </div>

          {/* QR Code Method */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">QR Code Method</span>
              </div>
              <button
                type="button"
                onClick={() => updateConfig({ qrEnabled: !config.qrEnabled, enableQr: !config.qrEnabled })}
                className={`p-1 transition ${config.qrEnabled !== false ? 'text-purple-400' : 'text-slate-600'}`}
              >
                {config.qrEnabled !== false ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Min Amount (₹)</label>
                <input
                  type="number"
                  value={config.qrMin || 100}
                  onChange={(e) => updateConfig({ qrMin: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Value</label>
                <input
                  type="number"
                  value={config.qrFee !== undefined ? config.qrFee : 2}
                  onChange={(e) => updateConfig({ qrFee: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Type</label>
                <select
                  value={config.qrFeeType || 'FIXED'}
                  onChange={(e) => updateConfig({ qrFeeType: e.target.value as any })}
                  className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                >
                  <option value="FIXED">₹ Fixed</option>
                  <option value="PERCENTAGE">% Percent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Redeem Code Method */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-bold text-white">Redeem Code Method</span>
              </div>
              <button
                type="button"
                onClick={() => updateConfig({ redeemEnabled: !config.redeemEnabled, enableRedeemCode: !config.redeemEnabled })}
                className={`p-1 transition ${config.redeemEnabled !== false ? 'text-pink-400' : 'text-slate-600'}`}
              >
                {config.redeemEnabled !== false ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Min Amount (₹)</label>
                <input
                  type="number"
                  value={config.redeemMin || 20}
                  onChange={(e) => updateConfig({ redeemMin: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Value</label>
                <input
                  type="number"
                  value={config.redeemFee !== undefined ? config.redeemFee : 1}
                  onChange={(e) => updateConfig({ redeemFee: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Expiry (Days)</label>
                <input
                  type="number"
                  value={config.redeemExpiryDays || 30}
                  onChange={(e) => updateConfig({ redeemExpiryDays: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Ultra Pay Automated API Method */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Ultra Pay API (Automated)</span>
              </div>
              <button
                type="button"
                onClick={() => updateConfig({ ultraPayEnabled: !config.ultraPayEnabled })}
                className={`p-1 transition ${config.ultraPayEnabled ? 'text-amber-400' : 'text-slate-600'}`}
              >
                {config.ultraPayEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Min Amount (₹)</label>
                <input
                  type="number"
                  value={config.ultraPayMin || 10}
                  onChange={(e) => updateConfig({ ultraPayMin: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Value</label>
                <input
                  type="number"
                  value={config.ultraPayFee !== undefined ? config.ultraPayFee : 2}
                  onChange={(e) => updateConfig({ ultraPayFee: Number(e.target.value) })}
                  className="w-full mt-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Fee Type</label>
                <select
                  value={config.ultraPayFeeType || 'PERCENTAGE'}
                  onChange={(e) => updateConfig({ ultraPayFeeType: e.target.value as any })}
                  className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                >
                  <option value="PERCENTAGE">% Percent</option>
                  <option value="FIXED">₹ Fixed</option>
                </select>
              </div>
            </div>

            {/* Ultra Pay Credentials */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-amber-400">Ultra Pay API Token</label>
                  <input
                    type="password"
                    placeholder="Enter Ultra Pay Token"
                    value={config.ultraPayApiToken || ''}
                    onChange={(e) => updateConfig({ ultraPayApiToken: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-400">Ultra Pay API Key</label>
                  <input
                    type="password"
                    placeholder="Enter Ultra Pay Secret Key"
                    value={config.ultraPayApiKey || ''}
                    onChange={(e) => updateConfig({ ultraPayApiKey: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Ultra Pay API Endpoint URL</label>
                <input
                  type="text"
                  value={config.ultraPayEndpoint || 'https://www.ultra-pay.store/APIs/api'}
                  onChange={(e) => updateConfig({ ultraPayEndpoint: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300"
                />
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const saveRes = await authenticatedFetch('/api/admin/withdrawals/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ settings: config }),
                      });
                      const saveD = await saveRes.json();
                      if (!saveD.success) {
                        alert(`Failed to save config before test: ${saveD.error || 'Unknown error'}`);
                        return;
                      }

                      const testRes = await authenticatedFetch('/api/admin/withdrawals/test-ultrapay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ultraPayApiToken: config.ultraPayApiToken,
                          ultraPayApiKey: config.ultraPayApiKey,
                        }),
                      });
                      const testD = await testRes.json();
                      if (testD.success) {
                        alert(testD.message || 'Ultra Pay API Connected Successfully!');
                      } else {
                        alert(`Ultra Pay API Test Failed: ${testD.error || 'Unknown error'}`);
                      }
                    } catch (e: any) {
                      alert(`Error during test: ${e.message}`);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/10"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Save & Test API Connection</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Limits & Safeguards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Max Single Payout (₹)</label>
            <input
              type="number"
              value={config.maxSingleWithdrawal || config.maxWithdrawal || 10000}
              onChange={(e) => updateConfig({ maxSingleWithdrawal: Number(e.target.value), maxWithdrawal: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Daily Payout Limit (₹)</label>
            <input
              type="number"
              value={config.dailyWithdrawalLimit || 50000}
              onChange={(e) => updateConfig({ dailyWithdrawalLimit: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Weekly Payout Limit (₹)</label>
            <input
              type="number"
              value={config.weeklyWithdrawalLimit || 250000}
              onChange={(e) => updateConfig({ weeklyWithdrawalLimit: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Max Pending Requests/User</label>
            <input
              type="number"
              value={config.maxPendingWithdrawals !== undefined ? config.maxPendingWithdrawals : 1}
              onChange={(e) => updateConfig({ maxPendingWithdrawals: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="withdrawal-save-btn"
            onClick={async () => {
              try {
                const res = await authenticatedFetch('/api/admin/withdrawals/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: config }),
                });
                const d = await res.json();
                if (d.success) {
                  onSave();
                } else {
                  alert(d.error || 'Failed to save settings.');
                }
              } catch (e: any) {
                onSave();
              }
            }}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/10 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4.5 h-4.5" />
            <span>{isSaving ? 'Saving...' : 'Sync All Withdrawal Settings'}</span>
          </button>
        </div>
      </div>

      {/* ADMIN DIAGNOSTIC SECTION */}
      <div className="p-6 rounded-3xl bg-slate-950/40 border border-slate-800/80 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-slate-300">
          <Activity className="w-4 h-4 text-amber-500" />
          <h4 className="text-xs font-black tracking-wider uppercase text-amber-400">Current Withdrawal Config (Admin Diagnostic)</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Global Withdrawals</span>
            <span className={`text-xs font-black mt-1 uppercase ${
              (config.globalWithdrawalsEnabled !== false && config.allWithdrawalsEnabled !== false && config.enableWithdraw !== false)
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}>
              {(config.globalWithdrawalsEnabled !== false && config.allWithdrawalsEnabled !== false && config.enableWithdraw !== false) ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">UPI Method</span>
            <span className={`text-xs font-black mt-1 uppercase ${config.upiEnabled !== false && config.enableUpi !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
              {config.upiEnabled !== false && config.enableUpi !== false ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">QR Code Method</span>
            <span className={`text-xs font-black mt-1 uppercase ${config.qrEnabled !== false && config.enableQr !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
              {config.qrEnabled !== false && config.enableQr !== false ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Redeem Method</span>
            <span className={`text-xs font-black mt-1 uppercase ${config.redeemEnabled !== false && config.enableRedeemCode !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
              {config.redeemEnabled !== false && config.enableRedeemCode !== false ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Ultra Pay Method</span>
            <span className={`text-xs font-black mt-1 uppercase ${config.ultraPayEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
              {config.ultraPayEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-900 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Config Source: <strong className="text-slate-300">DATABASE (Firestore settings/config)</strong></span>
          </div>
          <div>
            <span>Last Updated: <strong className="text-slate-300 font-mono">{config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Never'}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. WITHDRAWAL QUEUE TABLE */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
              <span>Payout Requests & Auditing Queue</span>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 tracking-wider">
                  {pendingCount} IN QUEUE
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Verify UPI codes, analyze user balances, and complete manual payouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter('Pending')}
                className={`px-3 py-1 rounded-lg font-black tracking-wide text-[11px] transition ${
                  statusFilter === 'Pending'
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('Approved')}
                className={`px-3 py-1 rounded-lg font-black tracking-wide text-[11px] transition ${
                  statusFilter === 'Approved'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Approved ({completedCount})
              </button>
              <button
                onClick={() => setStatusFilter('Rejected')}
                className={`px-3 py-1 rounded-lg font-black tracking-wide text-[11px] transition ${
                  statusFilter === 'Rejected'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected ({rejectedCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-black tracking-wide text-[11px] transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-slate-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
            </div>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-bold focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Methods</option>
              <option value="upi">💳 UPI ID</option>
              <option value="qr">🖼 QR Code</option>
              <option value="redeem_code">🎁 Redeem Code</option>
              <option value="ultra_pay">⚡ Ultra Pay</option>
            </select>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              disabled={filteredWithdrawals.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/20 text-xs font-bold text-slate-300 hover:text-orange-400 flex items-center gap-1.5 transition disabled:opacity-50"
              title="Export filtered records to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2 font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2 font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Search & Bulk Action Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by Withdrawal ID, UID, Telegram ID, UPI ID, or Redeem details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Bulk actions menu */}
          {statusFilter === 'Pending' && selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 animate-fade-in shrink-0">
              <span className="text-[10px] font-black tracking-wider text-slate-400 px-3 uppercase">
                {selectedIds.length} Selected
              </span>
              <button
                disabled={isBulkProcessing}
                onClick={handleBulkApprove}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Approve</span>
              </button>
              <button
                disabled={isBulkProcessing}
                onClick={() => {
                  setRejectReason('Details verification failed - bulk rejected');
                  setIsBulkRejecting(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Bulk Reject</span>
              </button>
            </div>
          )}
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
            <span>Loading database payout ledger...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-slate-850 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-400">No Withdrawal Requests Found</p>
            <p className="text-xs text-slate-500">
              {statusFilter !== 'all' || methodFilter !== 'all'
                ? `No requests match active filters.`
                : 'No withdrawal requests recorded in Firestore yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-850">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-850">
                  {statusFilter === 'Pending' && (
                    <th className="p-4 w-10">
                      <button
                        onClick={handleSelectAll}
                        className="text-slate-500 hover:text-white transition"
                      >
                        {selectedIds.length === filteredWithdrawals.filter(w => String(w.status).toLowerCase() === 'pending').length ? (
                          <CheckSquare className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="p-4">UID</th>
                  <th className="p-4">Telegram ID</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Payout Details</th>
                  <th className="p-4 text-emerald-400 font-bold">Payout Value</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Requested Time</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs">
                {filteredWithdrawals.map((w) => {
                  const isProcessing = processingId === w.id;
                  const isSelected = selectedIds.includes(w.id!);
                  const isPending = String(w.status).toLowerCase() === 'pending';
                  const method = String(w.method || 'upi').toLowerCase();

                  const gross = Number(w.grossAmount ?? w.amountRequested ?? w.amount ?? 0);
                  const tax = Number(w.taxAmount ?? ((w.processingFee || 0) + (w.platformFee || 0)));
                  const net = Number(w.netAmount ?? w.finalPayout ?? w.payoutAmount ?? (gross - tax));

                  return (
                    <tr
                      key={w.id || w.withdrawalId}
                      className={`hover:bg-slate-900/30 transition ${
                        isSelected ? 'bg-orange-500/5' : ''
                      }`}
                    >
                      {statusFilter === 'Pending' && (
                        <td className="p-4">
                          {isPending ? (
                            <button
                              onClick={() => handleSelectId(w.id!)}
                              className="text-slate-500 hover:text-orange-400 transition"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-orange-500" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 block"></span>
                          )}
                        </td>
                      )}

                      {/* App Generated UID */}
                      <td className="p-4 font-mono font-black text-white select-all">
                        {w.uid || 'Missing'}
                      </td>

                      {/* Telegram ID - Hidden from ordinary users, visible to admin */}
                      <td className="p-4 font-mono text-slate-400 select-all">
                        {w.telegramId || 'N/A'}
                      </td>

                      {/* Username */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-200 block">{w.userName || 'User'}</span>
                            {w.username && (
                              <span className="text-[10px] text-orange-400 font-mono">
                                @{w.username.replace('@', '')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Payout Destination */}
                      <td className="p-4 font-mono">
                        {method === 'upi' && (() => {
                          const value = w.accountInformation || w.upiId || w.paymentDetails?.upiId;
                          if (!value) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-rose-400 border border-rose-500/20 font-bold block max-w-[200px]">
                                ⚠️ Account details unavailable for this request
                              </span>
                            );
                          }
                          return (
                            <div className="bg-slate-950 p-2.5 rounded-xl border border-blue-500/20 text-[11px] space-y-1 select-all">
                              <span className="text-[9px] font-black text-blue-400 block uppercase tracking-wider">UPI METHOD</span>
                              <span className="text-white font-bold block">{value}</span>
                            </div>
                          );
                        })()}
                        {method === 'qr' && (() => {
                          const qrUrl = w.qrImageUrl || w.accountInformation || w.qrData || w.paymentDetails?.qrData || w.paymentDetails?.qrUrl;
                          if (!qrUrl) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-rose-400 border border-rose-500/20 font-bold block max-w-[200px]">
                                ⚠️ Account details unavailable for this request
                              </span>
                            );
                          }
                          return (
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-purple-400 block uppercase tracking-wider">QR CODE METHOD</span>
                              <button
                                onClick={() => setPreviewQrUrl(qrUrl)}
                                className="group relative rounded-lg border border-purple-500/30 overflow-hidden bg-slate-950 px-2 py-1 flex items-center gap-1.5 text-purple-300 hover:text-white hover:border-purple-400 transition"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] font-bold">Open QR Code</span>
                              </button>
                            </div>
                          );
                        })()}
                        {method === 'redeem_code' && (() => {
                          const details = w.accountInformation || w.redeemCodeDetails || w.paymentDetails?.redeemCodeDetails;
                          if (!details) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-rose-400 border border-rose-500/20 font-bold block max-w-[200px]">
                                ⚠️ Account details unavailable for this request
                              </span>
                            );
                          }
                          return (
                            <div className="bg-slate-950 p-2.5 rounded-xl border border-pink-500/20 text-[11px] space-y-1 select-all">
                              <span className="text-[9px] font-black text-pink-400 block uppercase tracking-wider">REDEEM CODE BRAND</span>
                              <span className="text-white font-bold block truncate max-w-[200px]">{details}</span>
                            </div>
                          );
                        })()}
                        {(method.includes('ultra') || method === 'ultra_pay' || method === 'ultrapay') && (() => {
                          const payNumber = w.accountInformation || w.paytoNumber || w.paymentDetails?.paytoNumber;
                          if (!payNumber) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-rose-400 border border-rose-500/20 font-bold block max-w-[200px]">
                                ⚠️ Account details unavailable for this request
                              </span>
                            );
                          }
                          const amountVal = w.payoutAmount !== undefined ? w.payoutAmount : (w.finalPayout !== undefined ? w.finalPayout : w.amount);
                          return (
                            <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/20 text-[10.5px] text-slate-300 space-y-1.5 max-w-[250px] leading-relaxed select-all">
                              <div className="flex justify-between border-b border-slate-850 pb-1.5 mb-1">
                                <span className="text-amber-400 font-black tracking-wider uppercase text-[9.5px]">Method</span>
                                <span className="font-extrabold text-white text-[11px]">ULTRA PAY</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Pay Number</span>
                                <span className="font-black text-slate-200 select-all">{payNumber}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Amount</span>
                                <span className="font-black text-emerald-400">₹{amountVal}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Gateway Status</span>
                                <span className="font-black text-orange-400 uppercase tracking-wide">
                                  {w.status === 'PENDING' ? 'PENDING' : w.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Withdrawal ID</span>
                                <span className="font-mono text-slate-400">{w.id || w.withdrawalId || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Gateway Ref</span>
                                <span className="font-mono text-slate-400 truncate max-w-[120px]" title={w.providerReference || 'Not yet assigned'}>
                                  {w.providerReference || 'Not yet assigned'}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-slate-850 text-[9px] text-slate-500 mt-1">
                                <span className="font-medium">Requested At</span>
                                <span>{w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A'}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Requested Amount -> Platform Fee -> Payout Value */}
                      <td className="p-4 font-mono">
                        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 min-w-[130px]">
                          <div className="flex justify-between gap-2 text-[10px]">
                            <span className="text-slate-500 font-bold">💸 Gross:</span>
                            <span className="text-slate-300 font-black">₹{gross}</span>
                          </div>
                          <div className="flex justify-between gap-2 text-[10px]">
                            <span className="text-slate-500 font-bold">🧾 Tax/Fee:</span>
                            <span className="text-rose-400 font-black">₹{tax}</span>
                          </div>
                          <div className="flex justify-between gap-2 text-[11px] pt-1 border-t border-slate-800">
                            <span className="text-emerald-400 font-black">✅ Net:</span>
                            <span className="text-emerald-400 font-extrabold">₹{net}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {['pending', 'pending'].includes(String(w.status).toLowerCase()) && (
                          <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                        {['completed', 'approved', 'paid'].includes(String(w.status).toLowerCase()) && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                            Approved
                          </span>
                        )}
                        {['rejected', 'rejected'].includes(String(w.status).toLowerCase()) && (
                          <div>
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider">
                              Rejected
                            </span>
                            {w.rejectReason && (
                              <p className="text-[9px] text-slate-500 mt-1 max-w-[150px] truncate leading-none">
                                {w.rejectReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Requested Time */}
                      <td className="p-4 text-slate-500 font-mono text-[10px]">
                        {w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Info */}
                          <button
                            onClick={() => setSelectedWithdrawal(w)}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-850 transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-orange-400" />
                          </button>

                          {/* Message */}
                          <button
                            onClick={() =>
                              setMessagingUser({
                                telegramId: w.telegramId,
                                userName: w.userName,
                              })
                            }
                            title="Direct Telegram Message"
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-850 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {isPending ? (
                            <>
                              <button
                                disabled={isProcessing}
                                onClick={() => handleApprove(w.id!, w.withdrawalId || w.requestId || '')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-wide transition disabled:opacity-50"
                              >
                                ✓ Approve & Payout ₹{net}
                              </button>
                              <button
                                disabled={isProcessing}
                                onClick={() => setRejectingDocId(w.id!)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wide transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-semibold italic">Processed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECT REASON MODAL */}
      {rejectingDocId && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
                <span>Reject & Refund</span>
              </h3>
              <button onClick={() => setRejectingDocId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Rejection automatically refunds this transaction's amount back to the user's wallet ledger and notifies them via Bot.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Invalid UPI ID / Account mismatch"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingDocId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={processingId === rejectingDocId}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REJECT MODAL */}
      {isBulkRejecting && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
                <span>Bulk Reject Selection ({selectedIds.length})</span>
              </h3>
              <button onClick={() => setIsBulkRejecting(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              All {selectedIds.length} chosen requests will be rejected and fully refunded.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Common Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Bulk cancellation / Details verification failed"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBulkRejecting(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkRejectSubmit}
                disabled={isBulkProcessing}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                Confirm Bulk Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT TELEGRAM MESSAGE MODAL */}
      {messagingUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-blue-400" />
                <span>Message TG: {messagingUser.userName || messagingUser.telegramId}</span>
              </h3>
              <button onClick={() => setMessagingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <textarea
              value={directMessageText}
              onChange={(e) => setDirectMessageText(e.target.value)}
              rows={4}
              placeholder="e.g. Please re-check your UPI address and register again."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 font-sans resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMessagingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessageSubmit}
                disabled={isSendingMsg || !directMessageText.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR PREVIEW MODAL */}
      {previewQrUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4.5 h-4.5 text-purple-400" />
                <span>QR Destination</span>
              </h3>
              <button onClick={() => setPreviewQrUrl(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-center border border-slate-800 shadow-inner">
              <img src={previewQrUrl} alt="User Payout QR" className="max-h-[300px] max-w-full object-contain rounded-lg" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewQrUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 underline font-black uppercase tracking-wider"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Original Link</span>
              </a>
              <button
                onClick={() => setPreviewQrUrl(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4.5 h-4.5 text-orange-400" />
                <span>Request Verification Details</span>
              </h3>
              <button onClick={() => setSelectedWithdrawal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div>
                  <p className="text-[9px] text-slate-500 font-black uppercase">Payout ID</p>
                  <p className="text-xs font-mono font-bold text-white">#{selectedWithdrawal.withdrawalId || selectedWithdrawal.requestId}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 font-black uppercase">Status</p>
                  <span className={`inline-block px-2 py-0.5 mt-0.5 text-[9px] font-black rounded-full uppercase ${
                    ['pending'].includes(String(selectedWithdrawal.status).toLowerCase())
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      : ['completed', 'approved'].includes(String(selectedWithdrawal.status).toLowerCase())
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {selectedWithdrawal.status}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest pb-1 border-b border-slate-800">
                  User Account Registry
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Name</span>
                    <span className="text-slate-200 block">{selectedWithdrawal.userName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Username</span>
                    <span className="text-orange-400 block">@{selectedWithdrawal.username || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Telegram ID</span>
                    <span className="text-slate-300 block select-all">{selectedWithdrawal.telegramId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">User App UID</span>
                    <span className="text-slate-300 block select-all">{selectedWithdrawal.uid || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest pb-1 border-b border-slate-800">
                  Transaction Ledgers
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Requested</span>
                    <span className="text-slate-200 block">₹{selectedWithdrawal.requestedAmount || selectedWithdrawal.amount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Tax Deduction</span>
                    <span className="text-rose-400 block">₹{selectedWithdrawal.platformFee || 0}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Final Disbursable Payout</span>
                    <span className="text-base font-black text-emerald-400 block">₹{selectedWithdrawal.payoutAmount || selectedWithdrawal.amount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
