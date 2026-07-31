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
  User,
  ShieldAlert,
  MessageSquare,
  Eye,
  Send,
  ExternalLink,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'qr' | 'redeem_code'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal states
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Details verification failed');

  const [messagingUser, setMessagingUser] = useState<{ telegramId: string; userName?: string } | null>(null);
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);

  // Real-time Firestore Listener for Withdrawals
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WithdrawalRecord[] = [];
        snapshot.forEach((doc) => {
          list.push({
            id: doc.id,
            ...(doc.data() as Omit<WithdrawalRecord, 'id'>),
          });
        });
        setWithdrawals(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching withdrawals:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    const itemMethod = w.method || 'upi';
    const matchesMethod = methodFilter === 'all' || itemMethod === methodFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      w.withdrawalId?.toLowerCase().includes(q) ||
      w.uid?.toLowerCase().includes(q) ||
      w.telegramId?.toLowerCase().includes(q) ||
      w.upiId?.toLowerCase().includes(q) ||
      w.redeemCodeDetails?.toLowerCase().includes(q) ||
      w.userName?.toLowerCase().includes(q);

    return matchesStatus && matchesMethod && matchesSearch;
  });

  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length;
  const completedCount = withdrawals.filter((w) => w.status === 'completed').length;
  const rejectedCount = withdrawals.filter((w) => w.status === 'rejected').length;

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Withdrawal & Payout Management</h2>
            <p className="text-xs text-slate-400">
              Manage multi-method withdrawals (UPI, QR Code, Redeem Code), review requests, approve payouts & refund.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{pendingCount} Pending</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{completedCount} Completed</span>
          </span>
        </div>
      </div>

      {/* 1. CONFIGURATION SETTINGS SECTION */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <h3 className="text-xs font-bold text-slate-400 tracking-wide uppercase">
          Withdrawal System Controls & Limits
        </h3>

        {/* Toggles List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Master Enable Withdraw Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Global Withdrawals</p>
                <p className="text-[10px] text-slate-400">Master system switch</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-withdraw-toggle"
              onClick={() => updateConfig({ enableWithdraw: !config.enableWithdraw })}
              className={`p-1 rounded-lg transition ${
                config.enableWithdraw ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableWithdraw ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* Enable UPI Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">UPI Method</p>
                <p className="text-[10px] text-slate-400">Allow UPI ID inputs</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-upi-toggle"
              onClick={() => updateConfig({ enableUpi: !config.enableUpi })}
              className={`p-1 rounded-lg transition ${
                config.enableUpi ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableUpi ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* Enable QR Code Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">QR Code Method</p>
                <p className="text-[10px] text-slate-400">Allow QR image uploads</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-qr-toggle"
              onClick={() => updateConfig({ enableQr: !config.enableQr })}
              className={`p-1 rounded-lg transition ${
                config.enableQr ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableQr ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* Enable Redeem Code Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Redeem Code</p>
                <p className="text-[10px] text-slate-400">Allow gift card codes</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-redeem-toggle"
              onClick={() => updateConfig({ enableRedeemCode: !config.enableRedeemCode })}
              className={`p-1 rounded-lg transition ${
                config.enableRedeemCode ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableRedeemCode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Min & Max Limits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Minimum Withdrawal Limit (₹)</span>
            </label>
            <input
              type="number"
              id="min-withdrawal-input"
              value={config.minWithdrawal}
              onChange={(e) => updateConfig({ minWithdrawal: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-sky-400" />
              <span>Maximum Withdrawal Limit (₹)</span>
            </label>
            <input
              type="number"
              id="max-withdrawal-input"
              value={config.maxWithdrawal}
              onChange={(e) => updateConfig({ maxWithdrawal: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Processing Time Notice */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Processing Time Notice</span>
          </label>
          <textarea
            id="processing-time-notice-input"
            value={config.processingTimeNotice}
            onChange={(e) => updateConfig({ processingTimeNotice: e.target.value })}
            rows={2}
            placeholder="e.g. Withdrawal requests are processed within 24 hours."
            className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="withdrawal-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Limits & Config'}</span>
          </button>
        </div>
      </div>

      {/* 2. PENDING WITHDRAWALS & PAYOUT QUEUE */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Withdrawal Requests & Payout Queue</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingCount} Action Required
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">Review requests, check UPI/QR/Redeem code details, approve or reject with automatic refund.</p>
          </div>

          {/* Status & Method Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Completed ({completedCount})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  statusFilter === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected ({rejectedCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  statusFilter === 'all'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
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
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-bold focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Methods</option>
              <option value="upi">💳 UPI ID</option>
              <option value="qr">🖼 QR Code</option>
              <option value="redeem_code">🎁 Redeem Code</option>
            </select>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Withdrawal ID, UID, Telegram ID, UPI ID, or Redeem details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading withdrawal queue...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-400">No Withdrawal Requests Found</p>
            <p className="text-xs text-slate-500">
              {statusFilter !== 'all' || methodFilter !== 'all'
                ? `No requests match active filters.`
                : 'No withdrawal requests recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3.5">ID & Date</th>
                  <th className="p-3.5">User Details</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Payout Details</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredWithdrawals.map((w) => {
                  const isProcessing = processingId === w.id;
                  const method = w.method || 'upi';

                  return (
                    <tr key={w.id || w.withdrawalId} className="hover:bg-slate-800/30 transition">
                      {/* Withdrawal ID & Date */}
                      <td className="p-3.5 font-mono">
                        <span className="font-bold text-white block">#{w.withdrawalId}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(w.createdAt).toLocaleString()}
                        </span>
                      </td>

                      {/* User Details */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-200 block">{w.userName || 'User'}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              UID: #{w.uid} | TG: {w.telegramId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Method Badge */}
                      <td className="p-3.5">
                        {method === 'upi' && (
                          <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold text-[11px] inline-flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>UPI ID</span>
                          </span>
                        )}
                        {method === 'qr' && (
                          <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[11px] inline-flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR Code</span>
                          </span>
                        )}
                        {method === 'redeem_code' && (
                          <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-[11px] inline-flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5" />
                            <span>Redeem Code</span>
                          </span>
                        )}
                      </td>

                      {/* Payout Details */}
                      <td className="p-3.5 font-mono">
                        {method === 'upi' && (
                          <span className="px-2 py-1 rounded bg-slate-950 text-sky-300 border border-slate-800 font-semibold block text-ellipsis overflow-hidden max-w-[180px]">
                            {w.upiId || 'N/A'}
                          </span>
                        )}

                        {method === 'qr' && (
                          <div>
                            {w.qrImageUrl ? (
                              <button
                                onClick={() => setPreviewQrUrl(w.qrImageUrl!)}
                                className="group relative rounded-lg border border-purple-500/30 overflow-hidden bg-slate-950 p-1 flex items-center gap-2 text-purple-300 hover:text-white hover:border-purple-400 transition"
                              >
                                <img
                                  src={w.qrImageUrl}
                                  alt="QR Code"
                                  className="w-10 h-10 object-cover rounded border border-slate-800"
                                  onError={(e) => {
                                    // Fallback if image fails loading directly
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <span className="text-[11px] font-sans font-semibold underline flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-purple-400" />
                                  <span>View QR Code</span>
                                </span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">No QR Image</span>
                            )}
                          </div>
                        )}

                        {method === 'redeem_code' && (
                          <div className="p-2 rounded bg-slate-950 text-pink-300 border border-slate-800 font-sans text-xs">
                            <p className="font-semibold">{w.redeemCodeDetails || 'Redeem Code Requested'}</p>
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 font-bold text-emerald-400 text-sm">
                        ₹{w.amount}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {w.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {w.status === 'completed' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        )}
                        {w.status === 'rejected' && (
                          <div>
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                            {w.rejectReason && (
                              <p className="text-[10px] text-slate-500 mt-1 max-w-[150px] truncate">
                                {w.rejectReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Message Button */}
                          <button
                            onClick={() =>
                              setMessagingUser({
                                telegramId: w.telegramId,
                                userName: w.userName,
                              })
                            }
                            title="Send Direct Telegram Message"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                          </button>

                          {w.status === 'pending' ? (
                            <>
                              <button
                                disabled={isProcessing}
                                onClick={() => handleApprove(w.id!, w.withdrawalId)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow transition disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                disabled={isProcessing}
                                onClick={() => setRejectingDocId(w.id!)}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 shadow transition disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              Processed {w.processedAt ? new Date(w.processedAt).toLocaleDateString() : ''}
                            </span>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Reject Withdrawal Request</span>
              </h3>
              <button
                onClick={() => setRejectingDocId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting this request will automatically refund the withdrawal amount back to the user's wallet balance and send a Telegram notification with the reason.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Rejection Reason:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Invalid UPI ID / Unreadable QR code / Account mismatch"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
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
                {processingId === rejectingDocId ? 'Processing Refund...' : 'Confirm Reject & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND DIRECT MESSAGE MODAL */}
      {messagingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>Send Message to {messagingUser.userName || messagingUser.telegramId}</span>
              </h3>
              <button
                onClick={() => setMessagingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This message will be delivered immediately to the user's Telegram chat via your bot.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Message Content:</label>
              <textarea
                value={directMessageText}
                onChange={(e) => setDirectMessageText(e.target.value)}
                rows={4}
                placeholder="e.g. Please send a clearer QR code image, or contact support if you need assistance."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

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
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingMsg ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE IMAGE PREVIEW MODAL */}
      {previewQrUrl && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span>User Uploaded Payment QR Code</span>
              </h3>
              <button
                onClick={() => setPreviewQrUrl(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-center border border-slate-800">
              <img
                src={previewQrUrl}
                alt="User QR Code Full Preview"
                className="max-h-[380px] max-w-full object-contain rounded-lg border border-slate-800 shadow-md"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewQrUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Original Image</span>
              </a>

              <button
                onClick={() => setPreviewQrUrl(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
