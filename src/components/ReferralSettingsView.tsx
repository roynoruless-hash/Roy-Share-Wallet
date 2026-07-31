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
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  Sliders,
  Shield,
  Coins,
  Award,
  PlusCircle,
  HelpCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { AdminConfig, ReferralMilestone, MilestoneClaimRecord } from '../types';
import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  fetchMilestonesFromDb,
  saveMilestoneToDb,
  deleteMilestoneFromDb,
  updateMilestonePositionsInDb,
} from '../services/milestoneService';

interface ReferralSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
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
  showToast,
}) => {
  // Stats state
  const [stats, setStats] = useState({
    totalReferrals: 0,
    todayReferrals: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    totalRewardsDistributed: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Milestones states
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Milestone Form states
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneRequiredReferrals, setMilestoneRequiredReferrals] = useState(5);
  const [milestoneRewardAmount, setMilestoneRewardAmount] = useState(20);
  const [milestoneRewardType, setMilestoneRewardType] = useState<'wallet' | 'coins' | 'bonus'>('wallet');
  const [milestoneActive, setMilestoneActive] = useState(true);

  // Logs state (from original)
  const [logs, setLogs] = useState<ReferralLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'approved' | 'rejected' | 'duplicate_device' | 'duplicate_ip'>('all');
  const [selectedLog, setSelectedLog] = useState<ReferralLogItem | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Toast wrapper fallback
  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      setActionMessage({ type: type === 'error' ? 'error' : 'success', text: msg });
    }
  };

  // Fetch Dashboard Stats from Firestore
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      // 1. Fetch claims from milestoneClaimRecords
      const claimsSnap = await getDocs(collection(db, 'milestoneClaimRecords'));
      let pending = 0;
      let approved = 0;
      let rejected = 0;
      let milestoneRewardsSum = 0;

      claimsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const status = d.status || 'pending';
        if (status === 'pending') pending++;
        else if (status === 'approved') {
          approved++;
          milestoneRewardsSum += Number(d.rewardAmount) || 0;
        } else if (status === 'rejected') rejected++;
      });

      // 2. Fetch referral logs
      let totalRefs = 0;
      let todayRefs = 0;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const logsSnap = await getDocs(collection(db, 'referralLogs'));
      logsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status === 'verified' || d.status === 'approved') {
          totalRefs++;
          const t = new Date(d.verificationTime || d.createdAt || Date.now()).getTime();
          if (t > oneDayAgo) {
            todayRefs++;
          }
        }
      });

      // Fallback: if no logs in referralLogs, check referralTokens
      if (totalRefs === 0) {
        const tokensSnap = await getDocs(collection(db, 'referralTokens'));
        tokensSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.status === 'verified') {
            totalRefs++;
            const t = new Date(d.verifiedAt || d.createdAt || Date.now()).getTime();
            if (t > oneDayAgo) {
              todayRefs++;
            }
          }
        });
      }

      // Calculate total rewards distributed
      const baseReferralRewards = totalRefs * (config.rewardPerReferral || 5);
      const totalDistributed = baseReferralRewards + milestoneRewardsSum;

      setStats({
        totalReferrals: totalRefs,
        todayReferrals: todayRefs,
        pendingClaims: pending,
        approvedClaims: approved,
        rejectedClaims: rejected,
        totalRewardsDistributed: totalDistributed,
      });
    } catch (err) {
      console.warn('Error fetching stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Milestones from Database
  const fetchMilestones = async () => {
    setLoadingMilestones(true);
    try {
      const data = await fetchMilestonesFromDb();
      setMilestones(data);
    } catch (err) {
      console.warn('Error fetching milestones:', err);
    } finally {
      setLoadingMilestones(false);
    }
  };

  // Fetch Verification Logs (From original)
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
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
      console.warn('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load everything on mount
  useEffect(() => {
    fetchStats();
    fetchMilestones();
    fetchLogs();
  }, [config.rewardPerReferral]);

  const handleRefreshAll = () => {
    fetchStats();
    fetchMilestones();
    fetchLogs();
    triggerToast('Referral metrics & milestones updated instantly', 'success');
  };

  // Save Milestone to DB
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<ReferralMilestone> = {
        requiredReferrals: milestoneRequiredReferrals,
        rewardAmount: milestoneRewardAmount,
        rewardType: milestoneRewardType,
        active: milestoneActive,
      };
      if (editingMilestoneId) {
        payload.id = editingMilestoneId;
      }

      await saveMilestoneToDb(payload);
      triggerToast(
        editingMilestoneId ? 'Milestone modified successfully' : 'New milestone added successfully',
        'success'
      );

      // Reset Form state
      setShowMilestoneForm(false);
      setEditingMilestoneId(null);
      setMilestoneRequiredReferrals(5);
      setMilestoneRewardAmount(20);
      setMilestoneRewardType('wallet');
      setMilestoneActive(true);

      // Refresh lists
      fetchMilestones();
      fetchStats();
    } catch (err: any) {
      triggerToast('Milestone save failed: ' + err.message, 'error');
    }
  };

  const startMilestoneEdit = (m: ReferralMilestone) => {
    setEditingMilestoneId(m.id);
    setMilestoneRequiredReferrals(m.requiredReferrals);
    setMilestoneRewardAmount(m.rewardAmount);
    setMilestoneRewardType(m.rewardType as any);
    setMilestoneActive(m.active);
    setShowMilestoneForm(true);
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone reward rule?')) return;
    try {
      await deleteMilestoneFromDb(id);
      triggerToast('Milestone reward rule deleted', 'success');
      fetchMilestones();
      fetchStats();
    } catch (err: any) {
      triggerToast('Deletion failed: ' + err.message, 'error');
    }
  };

  const handleMoveMilestone = async (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= milestones.length) return;

    const list = [...milestones];
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;

    try {
      await updateMilestonePositionsInDb(list);
      setMilestones(list);
      triggerToast('Sequence rearranged successfully', 'success');
    } catch (err: any) {
      triggerToast('Failed to rearrange sequence: ' + err.message, 'error');
    }
  };

  // Actions for original referral logs
  const handleBanDevice = async (log: ReferralLogItem) => {
    if (!confirm(`Are you sure you want to ban device fingerprint ${log.deviceHash.substring(0, 10)}...?`)) return;

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
        triggerToast(`Device ${log.deviceHash.substring(0, 10)}... banned successfully.`, 'success');
        fetchLogs();
      } else {
        triggerToast(data.error || 'Failed to ban device', 'error');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Server error', 'error');
    }
  };

  const handleBanUser = async (log: ReferralLogItem) => {
    if (!confirm(`Are you sure you want to ban User UID #${log.uid}?`)) return;

    try {
      const qUser = query(collection(db, 'users'), where('uid', '==', String(log.uid)));
      const snap = await getDocs(qUser);
      if (!snap.empty) {
        const userRef = doc(db, 'users', snap.docs[0].id);
        await updateDoc(userRef, { banned: true, bannedAt: new Date().toISOString() });
        triggerToast(`User UID #${log.uid} has been banned.`, 'success');
        fetchLogs();
      } else {
        triggerToast(`User UID #${log.uid} not found in database.`, 'error');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Error banning user', 'error');
    }
  };

  // Filter logs logic
  const filteredLogs = logs.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchUid = item.uid.toLowerCase().includes(q);
      const matchRef = item.referrerUid.toLowerCase().includes(q);
      const matchTg = (item.telegramId || '').toLowerCase().includes(q);
      const matchName = (item.referredName || '').toLowerCase().includes(q);
      const matchIp = item.ip.toLowerCase().includes(q);
      const matchHash = item.deviceHash.toLowerCase().includes(q);
      const matchStatus = item.status.toLowerCase().includes(q);

      if (!matchUid && !matchRef && !matchTg && !matchName && !matchIp && !matchHash && !matchStatus) {
        return false;
      }
    }

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

  // Safe configurations from props config
  const referralEnable = config.referralEnable ?? true;
  const referralRewardType = config.referralRewardType ?? 'wallet';
  const referralRewardCredit = config.referralRewardCredit ?? 'automatic';
  const rewardPerReferral = config.rewardPerReferral ?? 5;
  const minReferralsBeforeClaim = config.minReferralsBeforeClaim ?? 0;
  const maxMilestoneLimit = config.maxMilestoneLimit ?? 100;
  const allowOnlyOneClaimPerMilestone = config.allowOnlyOneClaimPerMilestone ?? true;
  const resetMilestoneOption = config.resetMilestoneOption ?? false;
  const requireDeviceVerification = config.requireDeviceVerification ?? true;
  const requireIpCheck = config.requireIpCheck ?? true;
  const requireFingerprintCheck = config.requireFingerprintCheck ?? true;
  const rejectSameDevice = config.rejectSameDevice ?? true;
  const rejectSelfReferral = config.rejectSelfReferral ?? true;
  const rejectDuplicateBrowser = config.rejectDuplicateBrowser ?? true;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sky-400">
                <Share2 className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">🎁 Referral Reward Settings</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                  Admin System v3.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete control over direct rewards, dynamic milestones, anti-abuse parameters, and live statistics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={loadingStats || loadingMilestones || loadingLogs}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition self-start sm:self-auto shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingStats || loadingMilestones || loadingLogs) ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh Engine Data</span>
          </button>
        </div>
      </div>

      {/* Inline Banner Alerts */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
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

      {/* ==============================================
          1. ADMIN DASHBOARD METRIC COUNTERS
          ============================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Referrals */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Referrals</span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/10"><Share2 className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono mt-2">
            {loadingStats ? <span className="animate-pulse">...</span> : stats.totalReferrals}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Verified Program Invites</span>
        </div>

        {/* Today's Referrals */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Referrals</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"><TrendingUp className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-indigo-400 font-mono mt-2">
            {loadingStats ? <span className="animate-pulse">...</span> : stats.todayReferrals}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Last 24 Hours Registration</span>
        </div>

        {/* Pending Claims */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Claims</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/10"><Clock className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-amber-400 font-mono mt-2">
            {loadingStats ? <span className="animate-pulse">...</span> : stats.pendingClaims}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Claims Request Queue</span>
        </div>

        {/* Approved Claims */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approved Claims</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"><CheckCircle2 className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-2">
            {loadingStats ? <span className="animate-pulse">...</span> : stats.approvedClaims}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Approved Milestone Claims</span>
        </div>

        {/* Rejected Claims */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rejected Claims</span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/10"><XCircle className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-rose-400 font-mono mt-2">
            {loadingStats ? <span className="animate-pulse">...</span> : stats.rejectedClaims}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Flagged Abuse Attempts</span>
        </div>

        {/* Total Rewards Distributed */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rewards Paid</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"><DollarSign className="w-3.5 h-3.5" /></span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono mt-2 truncate" title={`₹${stats.totalRewardsDistributed}`}>
            ₹{loadingStats ? <span className="animate-pulse">...</span> : stats.totalRewardsDistributed}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Direct + Milestone Rewards</span>
        </div>
      </div>

      {/* Main Forms Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Hand: General Settings, Direct Reward, Rules */}
        <div className="space-y-6">
          {/* ==============================================
              2. GENERAL SETTINGS CARD
              ============================================== */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>General Referral Settings</span>
            </h3>

            <div className="space-y-4">
              {/* Referral System Toggle */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Referral Program Master Status</p>
                  <p className="text-[10px] text-slate-500">Enable or pause the viral invitation program</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ referralEnable: !referralEnable })}
                  className={`p-1.5 rounded-lg transition ${
                    referralEnable ? 'text-sky-400' : 'text-slate-600'
                  }`}
                >
                  {referralEnable ? (
                    <ToggleRight className="w-9 h-9" />
                  ) : (
                    <ToggleLeft className="w-9 h-9" />
                  )}
                </button>
              </div>

              {/* Reward Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 block">Referral Reward System Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['wallet', 'coins', 'bonus'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateConfig({ referralRewardType: type })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition ${
                        referralRewardType === type
                          ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type === 'wallet' ? 'Wallet (₹)' : type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reward Credit Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 block">Reward Credit Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateConfig({ referralRewardCredit: 'automatic' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center text-center ${
                      referralRewardCredit === 'automatic'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Instant Automatic</span>
                    <span className="text-[9px] opacity-70 font-normal">Credited upon verify</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ referralRewardCredit: 'manual' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center text-center ${
                      referralRewardCredit === 'manual'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Manual Approval</span>
                    <span className="text-[9px] opacity-70 font-normal">Requires admin approval</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ==============================================
              3. DIRECT REFERRAL REWARD CARD
              ============================================== */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Direct Referral Reward Setting</span>
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Base Reward Amount</span>
                <span className="text-slate-500 italic">Example: 1 Referral = ₹{rewardPerReferral}</span>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</div>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={rewardPerReferral}
                  onChange={(e) => updateConfig({ rewardPerReferral: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  placeholder="5"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                This setting governs the core invite payout credit. Administrators can customize or change it dynamically at any time.
              </p>
            </div>
          </div>

          {/* ==============================================
              4. REWARD RULES CARD
              ============================================== */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Reward Issuance Rules</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minimum Referrals */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Min Referrals Before Claiming</label>
                <input
                  type="number"
                  min="0"
                  value={minReferralsBeforeClaim}
                  onChange={(e) => updateConfig({ minReferralsBeforeClaim: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="0"
                />
              </div>

              {/* Max Milestone Limit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Max Milestones Limit</label>
                <input
                  type="number"
                  min="1"
                  value={maxMilestoneLimit}
                  onChange={(e) => updateConfig({ maxMilestoneLimit: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="100"
                />
              </div>

              {/* Allow only one claim per milestone */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between col-span-1 sm:col-span-2">
                <div>
                  <p className="text-xs font-bold text-slate-200">Strict Single Milestone Claim</p>
                  <p className="text-[10px] text-slate-500">Allow users to only claim each milestone once</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ allowOnlyOneClaimPerMilestone: !allowOnlyOneClaimPerMilestone })}
                  className={`p-1.5 rounded-lg transition ${
                    allowOnlyOneClaimPerMilestone ? 'text-sky-400' : 'text-slate-600'
                  }`}
                >
                  {allowOnlyOneClaimPerMilestone ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Reset Milestone Option */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between col-span-1 sm:col-span-2">
                <div>
                  <p className="text-xs font-bold text-slate-200">Milestone Auto-Reset Option</p>
                  <p className="text-[10px] text-slate-500">Reset user milestone history once they complete all levels</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ resetMilestoneOption: !resetMilestoneOption })}
                  className={`p-1.5 rounded-lg transition ${
                    resetMilestoneOption ? 'text-sky-400' : 'text-slate-600'
                  }`}
                >
                  {resetMilestoneOption ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Hand: Referral Verification Anti Fraud Config */}
        <div className="space-y-6">
          {/* ==============================================
              5. REFERRAL VERIFICATION (ANTI FRAUD) CARD
              ============================================== */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Referral Verification & Security Controls</span>
            </h3>

            <div className="space-y-3.5">
              {/* Require Device Verification */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Device Verification</p>
                  <p className="text-[10px] text-slate-500">Require referrals to open and verify via web frame portal</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ requireDeviceVerification: !requireDeviceVerification })}
                  className={`p-1 transition ${requireDeviceVerification ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {requireDeviceVerification ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              {/* Require IP Check */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">IP Geolocation Duplicity Check</p>
                  <p className="text-[10px] text-slate-500">Audit and trace IP networks for double registrants</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ requireIpCheck: !requireIpCheck })}
                  className={`p-1 transition ${requireIpCheck ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {requireIpCheck ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              {/* Require Fingerprint Check */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Device Fingerprint Match (Canvas/WebGL)</p>
                  <p className="text-[10px] text-slate-500">Enable deep hardware hashes to prevent fake accounts</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ requireFingerprintCheck: !requireFingerprintCheck })}
                  className={`p-1 transition ${requireFingerprintCheck ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {requireFingerprintCheck ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              {/* Reject Same Device */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Reject Same Device</p>
                  <p className="text-[10px] text-slate-500">Block users logging multiple accounts on single hardware</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ rejectSameDevice: !rejectSameDevice })}
                  className={`p-1 transition ${rejectSameDevice ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {rejectSameDevice ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              {/* Reject Self Referral */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Reject Self Referral Link Usage</p>
                  <p className="text-[10px] text-slate-500">Block the active account from using their own referral link</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ rejectSelfReferral: !rejectSelfReferral })}
                  className={`p-1 transition ${rejectSelfReferral ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {rejectSelfReferral ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>

              {/* Reject Duplicate Browser */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Block Duplicate Browser Headers</p>
                  <p className="text-[10px] text-slate-500">Reject identical user-agent footprints on distinct accounts</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig({ rejectDuplicateBrowser: !rejectDuplicateBrowser })}
                  className={`p-1 transition ${rejectDuplicateBrowser ? 'text-sky-400' : 'text-slate-600'}`}
                >
                  {rejectDuplicateBrowser ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
                </button>
              </div>
            </div>
          </div>

          {/* Master Save Configuration Button Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-sky-950 border border-slate-800 shadow-md flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-white">Save All Referral Configuration</h4>
              <p className="text-[11px] text-slate-400">
                All customized settings, rule switches, and direct payouts are synchronized to Firebase and instantly apply to active Telegram bot backends.
              </p>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Configuration...' : 'Save Configuration Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==============================================
          6. MILESTONE REWARDS CARD (INLINE INTERFACE)
          ============================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Unlimited Milestones ({milestones.length})</h3>
              <p className="text-[11px] text-slate-400">Configure progressive referral levels and rewards</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMilestoneId(null);
              setMilestoneRequiredReferrals(5);
              setMilestoneRewardAmount(20);
              setMilestoneRewardType('wallet');
              setMilestoneActive(true);
              setShowMilestoneForm(!showMilestoneForm);
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Add Milestone</span>
          </button>
        </div>

        {/* Inline Milestone Creation / Editing Form */}
        {showMilestoneForm && (
          <form
            onSubmit={handleSaveMilestone}
            className="p-5 rounded-xl bg-slate-950 border border-sky-500/30 space-y-4 animate-fade-in"
          >
            <h4 className="text-xs font-bold text-sky-400 uppercase tracking-widest">
              {editingMilestoneId ? '✏️ Edit Referral Milestone' : '➕ Add New Referral Milestone'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Required Referrals</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={milestoneRequiredReferrals}
                  onChange={(e) => setMilestoneRequiredReferrals(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Reward Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={milestoneRewardAmount}
                  onChange={(e) => setMilestoneRewardAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Reward Type</label>
                <select
                  value={milestoneRewardType}
                  onChange={(e) => setMilestoneRewardType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="wallet">Wallet Balance (₹)</option>
                  <option value="coins">Coins Balance</option>
                  <option value="bonus">Bonus Balance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Active Status</label>
                <select
                  value={milestoneActive ? 'active' : 'inactive'}
                  onChange={(e) => setMilestoneActive(e.target.value === 'active')}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="active">Active ON</option>
                  <option value="inactive">Inactive OFF</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowMilestoneForm(false);
                  setEditingMilestoneId(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Save Milestone Rule
              </button>
            </div>
          </form>
        )}

        {/* Milestone List */}
        {loadingMilestones ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-400 ml-2 font-medium">Fetching milestones...</span>
          </div>
        ) : milestones.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-850">
            No progressive milestones configured. Add a level above to incentivize users.
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Required Referrals</th>
                  <th className="py-3 px-4">Reward Value</th>
                  <th className="py-3 px-4">Reward Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {milestones.map((m, index) => (
                  <tr key={m.id} className="hover:bg-slate-800/20 text-slate-300">
                    {/* Order & Move Buttons */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-sky-400">#{index + 1}</span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveMilestone(index, 'up')}
                            disabled={index === 0}
                            className="text-slate-500 hover:text-white disabled:opacity-25"
                            title="⬆ Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMilestone(index, 'down')}
                            disabled={index === milestones.length - 1}
                            className="text-slate-500 hover:text-white disabled:opacity-25"
                            title="⬇ Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Required Referrals */}
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-white font-extrabold font-mono text-[11px]">
                        {m.requiredReferrals} Invites
                      </span>
                    </td>

                    {/* Reward Payout */}
                    <td className="py-3 px-4 font-extrabold text-slate-100 text-sm font-mono">
                      ₹{m.rewardAmount}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 uppercase text-slate-400 font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 text-[10px] border border-slate-850 font-mono">
                        {m.rewardType || 'wallet'}
                      </span>
                    </td>

                    {/* Active State toggle status */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        m.active
                          ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}>
                        {m.active ? 'Active ON' : 'Inactive OFF'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => startMilestoneEdit(m)}
                          className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition"
                          title="✏️ Edit Milestone"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition"
                          title="🗑 Delete Milestone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ==============================================
          7. AUDIT LOGS & ANTI-FRAUD SECURITY AUDITS (collapsible)
          ============================================== */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Referral Verification Logs & Security Audit</h3>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by UID, Referrer, Telegram ID, IP, Device Fingerprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-850 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition border ${
                filterType === 'all'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilterType('approved')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition border ${
                filterType === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              Approved ({logs.filter((l) => l.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilterType('rejected')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition border ${
                filterType === 'rejected'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              Rejected ({logs.filter((l) => l.status === 'rejected').length})
            </button>
            <button
              onClick={() => setFilterType('duplicate_device')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition border ${
                filterType === 'duplicate_device'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              Dup Devices
            </button>
            <button
              onClick={() => setFilterType('duplicate_ip')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition border ${
                filterType === 'duplicate_ip'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              Dup IPs
            </button>
          </div>
        </div>

        {/* Audit Data Table */}
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
            No referral audit logs matched filter settings.
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
                    {/* Status badge */}
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

                    {/* Referred User info */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{item.referredName || 'User'}</div>
                      <div className="font-mono text-[10px] text-sky-400">UID: #{item.uid}</div>
                      {item.telegramId && (
                        <div className="text-[10px] text-slate-500 font-mono">TG: {item.telegramId}</div>
                      )}
                    </td>

                    {/* Referrer */}
                    <td className="py-3 px-3 font-mono text-indigo-400 font-bold">
                      #{item.referrerUid}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {item.ip}
                    </td>

                    {/* Device fingerprint hash */}
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

                    {/* Action buttons */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-semibold flex items-center gap-1 border border-slate-750"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBanDevice(item)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[11px] font-semibold flex items-center gap-1 border border-rose-800/60"
                        >
                          <Ban className="w-3.5 h-3.5" /> Ban Dev
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBanUser(item)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 text-[11px] font-semibold flex items-center gap-1 border border-rose-800/40"
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

      {/* Device Verification Details Modal Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Device Fingerprint Audit</h3>
                  <p className="text-xs text-slate-400">UID #{selectedLog.uid} • Security Diagnostics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verdict */}
            <div
              className={`p-4 rounded-xl border text-xs space-y-1 ${
                selectedLog.status === 'approved'
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex justify-between font-bold">
                <span>Verification State: {selectedLog.status.toUpperCase()}</span>
                <span>{new Date(selectedLog.verificationTime).toLocaleString()}</span>
              </div>
              {selectedLog.rejectReason && (
                <div className="text-[11px] opacity-95 pt-1 border-t border-rose-800/30">
                  Reject reason description: {selectedLog.rejectReason}
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5" /> Network Identifiers
                </div>
                <div><span className="text-slate-500">IP Address:</span> {selectedLog.ip}</div>
                <div className="truncate" title={selectedLog.deviceHash}><span className="text-slate-500">Device Hash:</span> {selectedLog.deviceHash}</div>
                <div className="truncate" title={selectedLog.localStorageId}><span className="text-slate-500">LS Footprint:</span> {selectedLog.localStorageId}</div>
                <div><span className="text-slate-500">Session Token:</span> {selectedLog.token || 'N/A'}</div>
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> GPS Geolocation
                </div>
                <div><span className="text-slate-500">GPS Permission:</span> {selectedLog.locationPermissionStatus || 'N/A'}</div>
                {selectedLog.locationCoords ? (
                  <>
                    <div><span className="text-slate-500">Coordinates:</span> {selectedLog.locationCoords.latitude.toFixed(5)}, {selectedLog.locationCoords.longitude.toFixed(5)}</div>
                    <div><span className="text-slate-500">Accuracy radius:</span> {selectedLog.locationCoords.accuracy} meters</div>
                  </>
                ) : (
                  <div className="text-slate-500 italic text-[11px]">No GPS coordinates captured</div>
                )}
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 col-span-1 md:col-span-2">
                <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5 mb-1">
                  <Monitor className="w-3.5 h-3.5" /> Client Environment & Signals
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300 text-[11px]">
                  <div><span className="text-slate-500">Platform:</span> {selectedLog.platform || selectedLog.rawSignals?.platform || 'Unknown'}</div>
                  <div><span className="text-slate-500">CPU Cores:</span> {selectedLog.rawSignals?.hardwareConcurrency || 'N/A'}</div>
                  <div><span className="text-slate-500">RAM Memory:</span> {selectedLog.rawSignals?.deviceMemory ? `${selectedLog.rawSignals.deviceMemory} GB` : 'N/A'}</div>
                  <div><span className="text-slate-500">Resolution:</span> {selectedLog.rawSignals?.screenResolution || 'N/A'}</div>
                  <div><span className="text-slate-500">Timezone:</span> {selectedLog.rawSignals?.timezone || 'N/A'}</div>
                  <div><span className="text-slate-500">Touch Support:</span> {selectedLog.rawSignals?.touchSupport !== undefined ? String(selectedLog.rawSignals.touchSupport) : 'N/A'}</div>
                </div>
                <div className="pt-2 text-[10px] text-slate-400 truncate" title={selectedLog.browser}>
                  <span className="text-slate-500">User Agent:</span> {selectedLog.browser}
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between border-t border-slate-850 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleBanDevice(selectedLog);
                    setSelectedLog(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Ban className="w-4 h-4" /> Ban Device
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleBanUser(selectedLog);
                    setSelectedLog(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition border border-slate-750"
                >
                  <UserX className="w-4 h-4" /> Ban Account
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
