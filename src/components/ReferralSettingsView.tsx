import React, { useState, useEffect } from 'react';
import {
  Share2,
  DollarSign,
  ShieldAlert,
  UserX,
  ToggleLeft,
  ToggleRight,
  Save,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Ban,
  MapPin,
  Cpu,
  Globe,
  Monitor,
  X,
  Info,
} from 'lucide-react';
import { AdminConfig } from '../types';
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ReferralSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

interface ReferralLogItem {
  id: string;
  token?: string;
  uid: string;
  referrerUid: string;
  telegramId?: string;
  referredName?: string;
  ip: string;
  deviceHash: string;
  localStorageId?: string;
  browser?: string;
  platform?: string;
  locationPermissionStatus?: string;
  locationCoords?: { latitude: number; longitude: number; accuracy: number } | null;
  verificationTime: string;
  status: 'approved' | 'rejected' | 'verified' | 'pending';
  rejectReason?: string;
  rawSignals?: any;
}

export const ReferralSettingsView: React.FC<ReferralSettingsViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
}) => {
  const [logs, setLogs] = useState<ReferralLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'approved' | 'rejected' | 'duplicate_device' | 'duplicate_ip'>('all');
  const [selectedLog, setSelectedLog] = useState<ReferralLogItem | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      // 1. Fetch from referralLogs collection (Version 2.0 logs)
      const logsQuery = query(collection(db, 'referralLogs'), orderBy('verificationTime', 'desc'), limit(50));
      const logsSnap = await getDocs(logsQuery);
      const items: ReferralLogItem[] = [];

      logsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          token: d.token,
          uid: d.uid,
          referrerUid: d.referrerUid,
          telegramId: d.telegramId,
          referredName: d.referredName,
          ip: d.ip || d.ipAddress || '—',
          deviceHash: d.deviceHash || d.deviceFingerprint || '—',
          localStorageId: d.localStorageId || 'N/A',
          browser: d.browser || d.userAgent || '—',
          platform: d.platform || 'Unknown',
          locationPermissionStatus: d.locationPermissionStatus || 'N/A',
          locationCoords: d.locationCoords || null,
          verificationTime: d.verificationTime || d.createdAt || new Date().toISOString(),
          status: d.status === 'verified' ? 'approved' : d.status || 'pending',
          rejectReason: d.rejectReason || '',
          rawSignals: d.rawSignals || {},
        });
      });

      // 2. Fallback fetch from referralTokens if referralLogs is empty
      if (items.length === 0) {
        const tokenQuery = query(collection(db, 'referralTokens'), orderBy('createdAt', 'desc'), limit(50));
        const tokenSnap = await getDocs(tokenQuery);
        tokenSnap.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: docSnap.id,
            token: d.token,
            uid: String(d.referredUid),
            referrerUid: String(d.referrerUid),
            telegramId: String(d.referredTelegramId || ''),
            referredName: d.referredName || 'User',
            ip: d.ipAddress || '—',
            deviceHash: d.deviceFingerprint || '—',
            localStorageId: d.localStorageId || 'N/A',
            browser: d.userAgent || '—',
            platform: 'Unknown',
            locationPermissionStatus: 'N/A',
            verificationTime: d.verifiedAt || d.createdAt || new Date().toISOString(),
            status: d.status === 'verified' ? 'approved' : d.status || 'pending',
            rejectReason: d.rejectReason || '',
            rawSignals: {},
          });
        });
      }

      setLogs(items);
    } catch (err) {
      console.warn('Error fetching referral logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter & Search Logic
  const filteredLogs = logs.filter((item) => {
    // Search Query Match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchUid = item.uid.toLowerCase().includes(q);
      const matchRef = item.referrerUid.toLowerCase().includes(q);
      const matchTg = (item.telegramId || '').toLowerCase().includes(q);
      const matchName = (item.referredName || '').toLowerCase().includes(q);
      const matchIp = item.ip.toLowerCase().includes(q);
      const matchHash = item.deviceHash.toLowerCase().includes(q);
      const matchLs = (item.localStorageId || '').toLowerCase().includes(q);
      const matchStatus = item.status.toLowerCase().includes(q);

      if (!matchUid && !matchRef && !matchTg && !matchName && !matchIp && !matchHash && !matchLs && !matchStatus) {
        return false;
      }
    }

    // Filter Type Match
    if (filterType === 'approved') return item.status === 'approved';
    if (filterType === 'rejected') return item.status === 'rejected';
    if (filterType === 'duplicate_device') {
      return (
        item.status === 'rejected' &&
        (item.rejectReason?.toLowerCase().includes('device') ||
          item.rejectReason?.toLowerCase().includes('fingerprint') ||
          item.rejectReason?.toLowerCase().includes('same'))
      );
    }
    if (filterType === 'duplicate_ip') {
      const sameIpCount = logs.filter((l) => l.ip !== '—' && l.ip === item.ip).length;
      return sameIpCount > 1;
    }

    return true;
  });

  // Action: Ban Device
  const handleBanDevice = async (log: ReferralLogItem) => {
    if (!confirm(`Are you sure you want to ban device hash ${log.deviceHash.substring(0, 10)}...?`)) return;

    try {
      const res = await fetch('/api/admin/referrals/ban-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint: log.deviceHash,
          localStorageId: log.localStorageId !== 'N/A' ? log.localStorageId : '',
          ipAddress: log.ip,
          reason: `Banned from referral logs (UID #${log.uid})`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Device ${log.deviceHash.substring(0, 10)}... banned successfully.` });
        fetchLogs();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to ban device' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Server error' });
    }
  };

  // Action: Ban User Account
  const handleBanUser = async (log: ReferralLogItem) => {
    if (!confirm(`Are you sure you want to ban User UID #${log.uid}?`)) return;

    try {
      const qUser = query(collection(db, 'users'), where('uid', '==', String(log.uid)));
      const snap = await getDocs(qUser);
      if (!snap.empty) {
        const userRef = doc(db, 'users', snap.docs[0].id);
        await updateDoc(userRef, { banned: true, bannedAt: new Date().toISOString() });
        setActionMessage({ type: 'success', text: `User UID #${log.uid} has been banned.` });
        fetchLogs();
      } else {
        setActionMessage({ type: 'error', text: `User UID #${log.uid} not found in database.` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error banning user' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Referral Engine & Anti Self-Referral V2.0</h2>
            <p className="text-xs text-slate-400">
              Configure reward rates and monitor device fingerprint anti-fraud verifications & audit logs.
            </p>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Settings Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Master Referral Enable Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Referral Program Status</p>
              <p className="text-[11px] text-slate-400">Enable or pause viral referral links</p>
            </div>
            <button
              type="button"
              id="referral-enable-toggle"
              onClick={() => updateConfig({ referralEnable: !config.referralEnable })}
              className={`p-1.5 rounded-lg transition ${
                config.referralEnable ? 'text-cyan-400' : 'text-slate-600'
              }`}
            >
              {config.referralEnable ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Reward Per Referral */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Reward Per Referral (₹)</span>
              </span>
            </label>
            <input
              type="number"
              id="reward-per-referral-input"
              value={config.rewardPerReferral}
              onChange={(e) =>
                updateConfig({ rewardPerReferral: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
            />
          </div>
        </div>

        {/* Anti-Fraud Protections Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Anti-Abuse & Device Fingerprint Protection</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Self Referral Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Self Referral Protection</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Block users from using their own referral link
                </p>
              </div>
              <button
                type="button"
                id="self-referral-toggle"
                onClick={() =>
                  updateConfig({ selfReferralProtection: !config.selfReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.selfReferralProtection ? 'text-cyan-400' : 'text-slate-600'
                }`}
              >
                {config.selfReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>

            {/* Device Fingerprint Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                  <span>Device Fingerprint V2.0</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Requires Render production URL & localStorage fingerprinting
                </p>
              </div>
              <button
                type="button"
                id="duplicate-referral-toggle"
                onClick={() =>
                  updateConfig({ duplicateReferralProtection: !config.duplicateReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.duplicateReferralProtection ? 'text-cyan-400' : 'text-slate-600'
                }`}
              >
                {config.duplicateReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="referral-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* REFERRAL LOGS & ANTI-FRAUD AUDIT DASHBOARD */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        {/* Dashboard Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Referral Verification Logs & Security Audit</h3>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by UID, Referrer, Telegram ID, IP, Device Hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Filter Type Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                filterType === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilterType('approved')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                filterType === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Approved ({logs.filter((l) => l.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilterType('rejected')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                filterType === 'rejected'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Rejected ({logs.filter((l) => l.status === 'rejected').length})
            </button>
            <button
              onClick={() => setFilterType('duplicate_device')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                filterType === 'duplicate_device'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Dup Devices
            </button>
            <button
              onClick={() => setFilterType('duplicate_ip')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                filterType === 'duplicate_ip'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Dup IPs
            </button>
          </div>
        </div>

        {/* Logs Data Table */}
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
            No referral logs match your search or filter.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Referred User</th>
                  <th className="py-3 px-3">Referrer UID</th>
                  <th className="py-3 px-3">IP Address</th>
                  <th className="py-3 px-3">Device Fingerprint</th>
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 bg-slate-900/40">
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Status */}
                    <td className="py-3 px-3">
                      {item.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> APPROVED
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          title={item.rejectReason}
                        >
                          <XCircle className="w-3 h-3" /> REJECTED
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                    </td>

                    {/* Referred User */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{item.referredName || 'User'}</div>
                      <div className="font-mono text-[10px] text-cyan-400">UID: #{item.uid}</div>
                      {item.telegramId && (
                        <div className="text-[10px] text-slate-500 font-mono">TG: {item.telegramId}</div>
                      )}
                    </td>

                    {/* Referrer UID */}
                    <td className="py-3 px-3 font-mono text-indigo-400 font-bold">
                      #{item.referrerUid}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {item.ip}
                    </td>

                    {/* Device Hash */}
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div className="text-slate-300 truncate max-w-[130px]" title={item.deviceHash}>
                        {item.deviceHash}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[130px]" title={item.localStorageId}>
                        LS: {item.localStorageId}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(item.verificationTime).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLog(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-semibold flex items-center gap-1 border border-slate-700"
                          title="View Device Details"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <button
                          onClick={() => handleBanDevice(item)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[11px] font-semibold flex items-center gap-1 border border-rose-800/60"
                          title="Ban Device Fingerprint"
                        >
                          <Ban className="w-3.5 h-3.5" /> Ban Dev
                        </button>
                        <button
                          onClick={() => handleBanUser(item)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 text-[11px] font-semibold flex items-center gap-1 border border-rose-800/40"
                          title="Ban User Account"
                        >
                          <UserX className="w-3.5 h-3.5" /> Ban User
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEVICE DETAILS MODAL / DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Device Fingerprint & Security Details</h3>
                  <p className="text-xs text-slate-400">UID #{selectedLog.uid} • Verification Audit Log</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verification Outcome Box */}
            <div
              className={`p-4 rounded-xl border text-xs space-y-1 ${
                selectedLog.status === 'approved'
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex justify-between font-bold">
                <span>Verification Status: {selectedLog.status.toUpperCase()}</span>
                <span>{new Date(selectedLog.verificationTime).toLocaleString()}</span>
              </div>
              {selectedLog.rejectReason && (
                <div className="text-[11px] opacity-90 pt-1 border-t border-rose-800/40">
                  Rejection Reason: {selectedLog.rejectReason}
                </div>
              )}
            </div>

            {/* Device Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Network & Identifiers
                </div>
                <div className="text-slate-300"><span className="text-slate-500">IP Address:</span> {selectedLog.ip}</div>
                <div className="text-slate-300 truncate" title={selectedLog.deviceHash}>
                  <span className="text-slate-500">Device Hash:</span> {selectedLog.deviceHash}
                </div>
                <div className="text-slate-300 truncate" title={selectedLog.localStorageId}>
                  <span className="text-slate-500">LocalStorage ID:</span> {selectedLog.localStorageId}
                </div>
                <div className="text-slate-300"><span className="text-slate-500">Token:</span> {selectedLog.token || 'N/A'}</div>
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Geolocation & Permission
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">Permission Status:</span> {selectedLog.locationPermissionStatus || 'N/A'}
                </div>
                {selectedLog.locationCoords ? (
                  <>
                    <div className="text-slate-300"><span className="text-slate-500">Latitude:</span> {selectedLog.locationCoords.latitude}</div>
                    <div className="text-slate-300"><span className="text-slate-500">Longitude:</span> {selectedLog.locationCoords.longitude}</div>
                    <div className="text-slate-300"><span className="text-slate-500">Accuracy:</span> {selectedLog.locationCoords.accuracy}m</div>
                  </>
                ) : (
                  <div className="text-slate-500 italic">No coordinates captured</div>
                )}
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 col-span-1 md:col-span-2">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Environment & Hardware Signals
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300 text-[11px]">
                  <div><span className="text-slate-500">Platform:</span> {selectedLog.platform || selectedLog.rawSignals?.platform || 'Unknown'}</div>
                  <div><span className="text-slate-500">Cores:</span> {selectedLog.rawSignals?.hardwareConcurrency || 'N/A'}</div>
                  <div><span className="text-slate-500">Memory:</span> {selectedLog.rawSignals?.deviceMemory ? `${selectedLog.rawSignals.deviceMemory} GB` : 'N/A'}</div>
                  <div><span className="text-slate-500">Screen Res:</span> {selectedLog.rawSignals?.screenResolution || 'N/A'}</div>
                  <div><span className="text-slate-500">Timezone:</span> {selectedLog.rawSignals?.timezone || 'N/A'}</div>
                  <div><span className="text-slate-500">Touch Support:</span> {selectedLog.rawSignals?.touchSupport !== undefined ? String(selectedLog.rawSignals.touchSupport) : 'N/A'}</div>
                </div>
                <div className="pt-2 text-[10px] text-slate-400 truncate" title={selectedLog.browser}>
                  <span className="text-slate-500">User Agent:</span> {selectedLog.browser}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleBanDevice(selectedLog);
                    setSelectedLog(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Ban className="w-4 h-4" /> Ban Device
                </button>
                <button
                  onClick={() => {
                    handleBanUser(selectedLog);
                    setSelectedLog(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
                >
                  <UserX className="w-4 h-4" /> Ban User Account
                </button>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
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
