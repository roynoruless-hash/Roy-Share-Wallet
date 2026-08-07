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
  Sparkles
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AdminConfig, WithdrawalRecord } from '../types';

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
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'qr' | 'redeem_code'>('all');
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

  // Real-time Firestore Listener for both withdrawals and withdraw_requests
  useEffect(() => {
    setLoading(true);
    let list1: WithdrawalRecord[] = [];
    let list2: WithdrawalRecord[] = [];

    const mergeAndSet = () => {
      const map = new Map<string, WithdrawalRecord>();

      const addRecord = (item: WithdrawalRecord) => {
        const key = item.withdrawalId || item.requestId || item.id || '';
        if (!key) return;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, item);
        } else {
          map.set(key, {
            ...existing,
            ...item,
            id: existing.id || item.id,
            withdrawalId: existing.withdrawalId || item.withdrawalId || item.requestId,
            requestId: existing.requestId || item.requestId || item.withdrawalId,
            status: item.status || existing.status,
          });
        }
      };

      list1.forEach(addRecord);
      list2.forEach(addRecord);

      const merged = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const pendingList = merged.filter(w => String(w.status).toLowerCase() === 'pending');
      console.log(`[Firestore Query] Admin Panel loaded ${merged.length} total withdrawal records (${pendingList.length} PENDING) from collections 'withdrawals' (${list1.length}) and 'withdraw_requests' (${list2.length}).`);

      setWithdrawals(merged);
      setLoading(false);
    };

    const q1 = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const q2 = query(collection(db, 'withdraw_requests'), orderBy('createdAt', 'desc'));

    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        list1 = [];
        snapshot.forEach((doc) => {
          list1.push({ id: doc.id, ...(doc.data() as Omit<WithdrawalRecord, 'id'>) });
        });
        mergeAndSet();
      },
      (err) => {
        console.error('Error fetching withdrawals collection:', err);
        mergeAndSet();
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        list2 = [];
        snapshot.forEach((doc) => {
          list2.push({ id: doc.id, ...(doc.data() as Omit<WithdrawalRecord, 'id'>) });
        });
        mergeAndSet();
      },
      (err) => {
        console.error('Error fetching withdraw_requests collection:', err);
        mergeAndSet();
      }
    );

    return () => {
      unsub1();
      unsub2();
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

    const itemMethod = w.method || 'upi';
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
        const res = await fetch('/api/admin/withdrawals/approve', {
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
        const res = await fetch('/api/admin/withdrawals/reject', {
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
      const res = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          withdrawalId: docId,
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
      const res = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          withdrawalId: rejectingDocId,
          reason: rejectReason,
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
      const res = await fetch('/api/admin/send-message', {
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
      const payoutDest = w.method === 'upi' ? w.upiId : (w.method === 'redeem_code' ? w.redeemCodeDetails : 'QR Code Image Upload');
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
        <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          Withdrawal System Controls & Limits
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Global Withdrawals</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Core System Switch</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-withdraw-toggle"
              onClick={() => updateConfig({ enableWithdraw: !config.enableWithdraw })}
              className={`p-1 rounded-lg transition ${
                config.enableWithdraw ? 'text-orange-400' : 'text-slate-600'
              }`}
            >
              {config.enableWithdraw ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">UPI Method</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">UPI ID payouts</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-upi-toggle"
              onClick={() => updateConfig({ enableUpi: !config.enableUpi })}
              className={`p-1 rounded-lg transition ${
                config.enableUpi ? 'text-blue-400' : 'text-slate-600'
              }`}
            >
              {config.enableUpi ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">QR Code Method</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">QR uploads</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-qr-toggle"
              onClick={() => updateConfig({ enableQr: !config.enableQr })}
              className={`p-1 rounded-lg transition ${
                config.enableQr ? 'text-purple-400' : 'text-slate-600'
              }`}
            >
              {config.enableQr ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Redeem Code</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Google Redeem codes</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-redeem-toggle"
              onClick={() => updateConfig({ enableRedeemCode: !config.enableRedeemCode })}
              className={`p-1 rounded-lg transition ${
                config.enableRedeemCode ? 'text-pink-400' : 'text-slate-600'
              }`}
            >
              {config.enableRedeemCode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <span>Minimum Payout (₹)</span>
            </label>
            <input
              type="number"
              id="min-withdrawal-input"
              value={config.minWithdrawal}
              onChange={(e) => updateConfig({ minWithdrawal: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span>Maximum Payout Limit (₹)</span>
            </label>
            <input
              type="number"
              id="max-withdrawal-input"
              value={config.maxWithdrawal}
              onChange={(e) => updateConfig({ maxWithdrawal: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-purple-400" />
                <span>Withdrawal Tax Platform Fee (%)</span>
              </span>
              <span className="text-[10px] text-slate-500">Default: 6%</span>
            </label>
            <input
              type="number"
              id="platform-fee-input"
              value={config.platformFeePercent !== undefined ? config.platformFeePercent : 6}
              onChange={(e) => {
                const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                updateConfig({ platformFeePercent: val, withdrawalTax: val });
              }}
              min={0}
              max={100}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>Processing Time Notice</span>
          </label>
          <textarea
            id="processing-time-notice-input"
            value={config.processingTimeNotice}
            onChange={(e) => updateConfig({ processingTimeNotice: e.target.value })}
            rows={2}
            placeholder="e.g. Withdrawal requests are processed within 24 hours."
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500 transition resize-none font-sans"
          />
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="withdrawal-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/10 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4.5 h-4.5" />
            <span>{isSaving ? 'Saving...' : 'Sync Limits'}</span>
          </button>
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
                  const method = w.method || 'upi';

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
                        {method === 'upi' && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-blue-300 border border-slate-800 font-bold block truncate max-w-[200px]">
                            {w.upiId || 'N/A'}
                          </span>
                        )}
                        {method === 'qr' && (
                          <div>
                            {w.qrImageUrl ? (
                              <button
                                onClick={() => setPreviewQrUrl(w.qrImageUrl!)}
                                className="group relative rounded-lg border border-purple-500/30 overflow-hidden bg-slate-950 px-2 py-1 flex items-center gap-1.5 text-purple-300 hover:text-white hover:border-purple-400 transition"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] font-bold">Open QR Code</span>
                              </button>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No QR Image</span>
                            )}
                          </div>
                        )}
                        {method === 'redeem_code' && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-pink-300 border border-slate-800 font-bold block truncate max-w-[200px]">
                            {w.redeemCodeDetails || 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* Requested Amount -> Platform Fee -> Payout Value */}
                      <td className="p-4 font-mono">
                        <div className="space-y-0.5">
                          <span className="text-base font-black text-emerald-400 block">
                            ₹{w.payoutAmount !== undefined ? w.payoutAmount : w.amount}
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            Requested: ₹{w.requestedAmount || w.amount} | Tax: ₹{w.platformFee || 0}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {['pending', 'pending'].includes(String(w.status).toLowerCase()) && (
                          <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                        {['completed', 'approved'].includes(String(w.status).toLowerCase()) && (
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
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wide transition disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                disabled={isProcessing}
                                onClick={() => setRejectingDocId(w.id!)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wide transition disabled:opacity-50"
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
