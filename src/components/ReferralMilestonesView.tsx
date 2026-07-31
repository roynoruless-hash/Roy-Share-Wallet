import React, { useState, useEffect } from 'react';
import {
  fetchMilestonesFromDb,
  saveMilestoneToDb,
  deleteMilestoneFromDb,
  updateMilestonePositionsInDb,
  fetchMilestoneClaimsFromDb,
  resetUserMilestonesInDb,
  approveMilestoneClaimInDb,
  rejectMilestoneClaimInDb
} from '../services/milestoneService';
import { fetchUsersFromDb } from '../services/userService';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, runTransaction, getDocs, query, where } from 'firebase/firestore';
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  RotateCcw,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  Info,
  Loader2,
  MapPin,
} from 'lucide-react';
import { ReferralMilestone, MilestoneClaimRecord, BotUser } from '../types';

interface ReferralMilestonesViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ReferralMilestonesView: React.FC<ReferralMilestonesViewProps> = ({
  config,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'settings' | 'claims' | 'analytics' | 'tools'>('settings');
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [claims, setClaims] = useState<MilestoneClaimRecord[]>([]);
  const [users, setUsers] = useState<BotUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states for milestone
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [requiredReferrals, setRequiredReferrals] = useState<number>(5);
  const [rewardAmount, setRewardAmount] = useState<number>(20);
  const [rewardType, setRewardType] = useState<'wallet' | 'coins' | 'bonus'>('wallet');
  const [active, setActive] = useState<boolean>(true);

  // Search & Filter states for claims
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');

  // Modal/Prompt states for actions
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Tools states (Manual Credit/Deduct/Reset)
  const [targetUid, setTargetUid] = useState('');
  const [creditAmount, setCreditAmount] = useState<number>(50);
  const [creditType, setCreditType] = useState<'wallet' | 'coins' | 'bonus'>('wallet');
  const [toolLoading, setToolLoading] = useState(false);

  // Load everything
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mList, cList, uList] = await Promise.all([
        fetchMilestonesFromDb(),
        fetchMilestoneClaimsFromDb(),
        fetchUsersFromDb()
      ]);
      setMilestones(mList);
      setClaims(cList);
      setUsers(uList);
    } catch (err: any) {
      showToast('Error loading milestone data: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Milestone
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const mData: Partial<ReferralMilestone> = {
        requiredReferrals,
        rewardAmount,
        rewardType,
        active,
      };
      if (editingId) mData.id = editingId;

      await saveMilestoneToDb(mData);
      showToast(editingId ? 'Milestone updated successfully' : 'Milestone added successfully', 'success');
      
      // Reset form
      setShowForm(false);
      setEditingId(null);
      setRequiredReferrals(5);
      setRewardAmount(20);
      setRewardType('wallet');
      setActive(true);

      // Refresh
      await loadData();
    } catch (err: any) {
      showToast('Failed to save milestone: ' + err.message, 'error');
    }
  };

  // Edit Milestone triggering
  const startEdit = (m: ReferralMilestone) => {
    setEditingId(m.id);
    setRequiredReferrals(m.requiredReferrals);
    setRewardAmount(m.rewardAmount);
    setRewardType(m.rewardType as any);
    setActive(m.active);
    setShowForm(true);
  };

  // Delete Milestone
  const handleDeleteMilestone = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone? Existing claim logs will remain.')) return;
    try {
      await deleteMilestoneFromDb(id);
      showToast('Milestone deleted', 'success');
      await loadData();
    } catch (err: any) {
      showToast('Failed to delete milestone: ' + err.message, 'error');
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (m: ReferralMilestone) => {
    try {
      await saveMilestoneToDb({
        id: m.id,
        active: !m.active
      });
      showToast(`Milestone ${!m.active ? 'enabled' : 'disabled'} successfully`, 'success');
      await loadData();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Move Milestone position (up/down)
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
      showToast('Order updated', 'success');
    } catch (err: any) {
      showToast('Failed to change order: ' + err.message, 'error');
    }
  };

  // Manual Approve Claim
  const handleApproveClaim = async (claimId: string) => {
    if (!window.confirm('Approve this claim and credit user wallet?')) return;
    try {
      const res = await approveMilestoneClaimInDb(claimId, 'admin_manual');
      if (res.success) {
        showToast('Claim approved and reward credited!', 'success');
        await loadData();
      } else {
        showToast(res.error || 'Approval failed', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Open Manual Reject Dialogue
  const openRejectModal = (claimId: string) => {
    setSelectedClaimId(claimId);
    setRejectReason('Same Device Detected'); // default common reason
    setShowRejectModal(true);
  };

  // Manual Reject Confirm
  const handleConfirmReject = async () => {
    if (!selectedClaimId) return;
    try {
      const res = await rejectMilestoneClaimInDb(selectedClaimId, rejectReason, 'admin_manual');
      if (res.success) {
        showToast('Claim rejected successfully', 'success');
        setShowRejectModal(false);
        setSelectedClaimId(null);
        await loadData();
      } else {
        showToast(res.error || 'Rejection failed', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Tool: Reset User Milestone
  const handleResetUserMilestones = async () => {
    if (!targetUid.trim()) {
      showToast('Please specify a User UID', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to RESET milestone progress and claims for UID ${targetUid}? This will let them claim all milestones again.`)) return;

    setToolLoading(true);
    try {
      await resetUserMilestonesInDb(targetUid.trim());
      showToast(`Milestone progress reset for UID ${targetUid}`, 'success');
      setTargetUid('');
      await loadData();
    } catch (err: any) {
      showToast('Reset failed: ' + err.message, 'error');
    } finally {
      setToolLoading(false);
    }
  };

  // Tool: Credit Reward Manually
  const handleManualBalanceAdjustment = async (action: 'credit' | 'deduct') => {
    if (!targetUid.trim()) {
      showToast('User UID is required', 'error');
      return;
    }
    if (creditAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    setToolLoading(true);
    try {
      // Find user
      const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', targetUid.trim())));
      if (uSnap.empty) {
        showToast(`User UID ${targetUid} not found`, 'error');
        setToolLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', uSnap.docs[0].id);
      const userRefData = uSnap.docs[0].data();

      await runTransaction(db, async (transaction) => {
        const freshUser = await transaction.get(userDocRef);
        if (!freshUser.exists()) throw new Error('User not found');

        const uData = freshUser.data();
        const curWallet = Number(uData.walletBalance || 0);
        const curCoins = Number(uData.coinsBalance || 0);
        const curBonus = Number(uData.bonusBalance || 0);

        let finalVal = 0;
        let updateFields: any = {};

        const delta = action === 'credit' ? creditAmount : -creditAmount;

        if (creditType === 'coins') {
          finalVal = Math.max(0, curCoins + delta);
          updateFields.coinsBalance = finalVal;
        } else if (creditType === 'bonus') {
          finalVal = Math.max(0, curBonus + delta);
          updateFields.bonusBalance = finalVal;
        } else {
          finalVal = Math.max(0, curWallet + delta);
          updateFields.walletBalance = finalVal;
        }

        transaction.update(userDocRef, updateFields);

        // Save wallet transaction
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: uSnap.docs[0].id,
          uid: targetUid.trim(),
          type: 'admin_adjustment',
          amount: delta,
          balanceAfter: finalVal,
          reason: `Admin Manual Adjustment (${action.toUpperCase()}): ${creditType}`,
          createdAt: new Date().toISOString(),
        });
      });

      showToast(`Successfully ${action}ed ₹${creditAmount} (${creditType}) to UID ${targetUid}`, 'success');
      setTargetUid('');
      await loadData();
    } catch (err: any) {
      showToast('Adjustment failed: ' + err.message, 'error');
    } finally {
      setToolLoading(false);
    }
  };

  // Filter claims
  const filteredClaims = claims.filter((c) => {
    const matchesSearch =
      c.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.telegramUsername || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.deviceFingerprint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ip.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Analytics
  const totalClaimsCount = claims.length;
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const rejectedClaims = claims.filter(c => c.status === 'rejected');
  const totalCreditedAmount = approvedClaims.reduce((sum, c) => sum + c.rewardAmount, 0);

  return (
    <div className="space-y-6">
      {/* Tab Header Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-400" />
            Referral Milestone Reward System
          </h2>
          <p className="text-xs text-slate-400">
            Set unlimited milestone targets, monitor automated device fingerprinting verification, and audits.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800/60 rounded-xl max-w-xl">
        <button
          onClick={() => setSubTab('settings')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'settings'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚙️ Milestones Configuration
        </button>
        <button
          onClick={() => setSubTab('claims')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative ${
            subTab === 'claims'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📄 Claim Requests & Logs
        </button>
        <button
          onClick={() => setSubTab('analytics')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📊 Milestone Analytics
        </button>
        <button
          onClick={() => setSubTab('tools')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'tools'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🛠 Admin Tools
        </button>
      </div>

      {/* 1. MILESTONE SETTINGS TAB */}
      {subTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Unlimited Milestones ({milestones.length})
            </h3>
            <button
              onClick={() => {
                setEditingId(null);
                setRequiredReferrals(5);
                setRewardAmount(20);
                setRewardType('wallet');
                setActive(true);
                setShowForm(!showForm);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <form
              onSubmit={handleSaveMilestone}
              className="bg-slate-900 border border-blue-500/20 rounded-2xl p-5 space-y-4 animate-fade-in"
            >
              <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest">
                {editingId ? '✏️ Edit Referral Milestone' : '➕ Add New Referral Milestone'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Required Referrals</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={requiredReferrals}
                    onChange={(e) => setRequiredReferrals(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Reward Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Reward Type</label>
                  <select
                    value={rewardType}
                    onChange={(e) => setRewardType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="wallet">Wallet Balance (₹)</option>
                    <option value="coins">Coins Balance</option>
                    <option value="bonus">Bonus Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Status</label>
                  <select
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) => setActive(e.target.value === 'active')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Enabled (Active)</option>
                    <option value="inactive">Disabled (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          )}

          {/* Milestone List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400 font-semibold">Loading configuration...</p>
            </div>
          ) : milestones.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
              <Award className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">No milestones configured yet.</p>
              <p className="text-[10px] text-slate-500">Milestones help users earn additional rewards dynamically as they scale successful referrals.</p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                      <th className="py-3 px-4">Order</th>
                      <th className="py-3 px-4">Required Referrals</th>
                      <th className="py-3 px-4">Reward Value</th>
                      <th className="py-3 px-4">Reward Wallet Type</th>
                      <th className="py-3 px-4">Active State</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-semibold">
                    {milestones.map((m, index) => (
                      <tr key={m.id} className="hover:bg-slate-900/30">
                        <td className="py-3.5 px-4 text-slate-400">
                          <div className="flex items-center gap-1">
                            <span className="font-bold">#{index + 1}</span>
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveMilestone(index, 'up')}
                                disabled={index === 0}
                                className="text-slate-500 hover:text-white disabled:opacity-20"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveMilestone(index, 'down')}
                                disabled={index === milestones.length - 1}
                                className="text-slate-500 hover:text-white disabled:opacity-20"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-white">
                          <span className="bg-slate-950 px-2 py-1 border border-slate-800 rounded-lg font-black text-blue-400">
                            {m.requiredReferrals} Referrals
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-200">
                          ₹{m.rewardAmount}
                        </td>
                        <td className="py-3.5 px-4 uppercase text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 text-[10px] font-black text-slate-400 border border-slate-800">
                            {m.rewardType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleActive(m)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border transition ${
                              m.active
                                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {m.active ? '✅ Active' : '❌ Disabled'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(m)}
                              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="p-1.5 rounded-lg bg-slate-950 border border-slate-850 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition"
                              title="Delete"
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
            </div>
          )}
        </div>
      )}

      {/* 2. CLAIM REQUESTS & LOGS TAB */}
      {subTab === 'claims' && (
        <div className="space-y-6 animate-fade-in">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by UID, User, FP, IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
            </div>
            {/* Status Filter */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                  statusFilter === 'all' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Claims
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                  statusFilter === 'approved' ? 'bg-emerald-950/80 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
                  statusFilter === 'rejected' ? 'bg-rose-950/80 text-rose-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>

          {/* Claims logs list */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400 font-semibold">Loading claim reports...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">No claims matched current criteria.</p>
              <p className="text-[10px] text-slate-500">When users trigger and request claim verification, they show up here immediately.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((c) => (
                <div
                  key={c.id}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 space-y-4 transition ${
                    c.status === 'approved'
                      ? 'border-emerald-500/10 hover:border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.02)]'
                      : c.status === 'rejected'
                      ? 'border-rose-500/10 hover:border-rose-500/20'
                      : 'border-slate-800/80 hover:border-blue-500/20'
                  }`}
                >
                  {/* Top user profile card */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black text-blue-400 uppercase">UID</span>
                        <span className="text-xs font-black text-white leading-none">#{c.uid}</span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-200">
                          {c.userName || 'Unknown User'}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                          Telegram: <span className="text-blue-400">@{c.telegramUsername || 'N/A'}</span>
                          <span className="text-slate-700">|</span>
                          ID: <span className="text-slate-400">{c.telegramId}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500">
                        {new Date(c.claimTime).toLocaleString()}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          c.status === 'approved'
                            ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
                            : c.status === 'rejected'
                            ? 'bg-rose-950/80 border-rose-500/30 text-rose-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>

                  {/* Audit parameters grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Milestone
                      </span>
                      <span className="font-bold text-blue-400">
                        {c.requiredReferrals} Referrals
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Claim Reward
                      </span>
                      <span className="font-bold text-white">
                        ₹{c.rewardAmount} <span className="text-[10px] text-slate-400 uppercase font-bold">({c.rewardType})</span>
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Client IP Address
                      </span>
                      <span className="font-semibold text-slate-300 select-all font-mono">
                        {c.ip || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Fingerprint Hash
                      </span>
                      <span className="font-semibold text-slate-300 block truncate select-all font-mono" title={c.deviceFingerprint}>
                        {c.deviceFingerprint ? c.deviceFingerprint.slice(0, 10) + '...' : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Anti Fraud Diagnostics or Rejection Details */}
                  <div className="flex flex-col sm:flex-row justify-between gap-4 text-xs">
                    <div className="space-y-1 max-w-xl text-slate-400">
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500">
                        <span>Platform: <strong className="text-slate-300 font-mono">{c.platform || 'Unknown'}</strong></span>
                        <span>•</span>
                        <span>Timezone: <strong className="text-slate-300 font-mono">{c.timezone || 'N/A'}</strong></span>
                        <span>•</span>
                        <span>Browser: <strong className="text-slate-300 block truncate max-w-xs font-mono" title={c.userAgent}>{c.userAgent ? c.userAgent.split(' ')[0] : 'N/A'}</strong></span>
                      </div>
                      
                      {c.location && (
                        <p className="text-[10px] text-blue-400/90 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Location verified: {c.location.latitude.toFixed(4)}, {c.location.longitude.toFixed(4)}
                        </p>
                      )}

                      {c.status === 'rejected' && (
                        <div className="bg-rose-950/20 border border-rose-500/10 rounded-xl px-3 py-2 text-rose-400 font-semibold text-xs mt-2 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>Rejection Reason: <strong>{c.rejectReason || 'Same Device Detected'}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Admin Actions */}
                    <div className="flex items-end justify-end gap-2">
                      {c.status !== 'approved' && (
                        <button
                          onClick={() => handleApproveClaim(c.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold uppercase transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Manual Approve
                        </button>
                      )}
                      {c.status !== 'rejected' && (
                        <button
                          onClick={() => openRejectModal(c.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase transition flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Manual Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. MILESTONE ANALYTICS TAB */}
      {subTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Total Claims</span>
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-white">{totalClaimsCount}</span>
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Rewards</span>
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-emerald-400">{approvedClaims.length}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected Fraud Attempts</span>
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-rose-400">{rejectedClaims.length}</span>
                <XCircle className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Total Credited Reward</span>
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-blue-400">₹{totalCreditedAmount}</span>
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Quick Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Claims approved vs rejected */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Anti Fraud Engine Distribution</h4>
              {totalClaimsCount === 0 ? (
                <p className="text-xs text-slate-500">No telemetry logs available yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>Approved Claims ({approvedClaims.length})</span>
                    <span>{((approvedClaims.length / totalClaimsCount) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(approvedClaims.length / totalClaimsCount) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>Rejected Claims ({rejectedClaims.length})</span>
                    <span>{((rejectedClaims.length / totalClaimsCount) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${(rejectedClaims.length / totalClaimsCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Top milestones claimed */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Milestone Breakdown</h4>
              {milestones.length === 0 ? (
                <p className="text-xs text-slate-500">No milestones configured.</p>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {milestones.map((m) => {
                    const count = approvedClaims.filter(c => c.milestoneId === m.id).length;
                    const maxCount = Math.max(...milestones.map(x => approvedClaims.filter(c => c.milestoneId === x.id).length)) || 1;
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-300">{m.requiredReferrals} Referrals Milestone (₹{m.rewardAmount})</span>
                          <span className="text-blue-400">{count} Claims</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TOOLS TAB */}
      {subTab === 'tools' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Tool A: Reset User Milestones */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-bold text-white">Reset User Milestone Progress</h4>
              </div>
              <p className="text-xs text-slate-400">
                Resets the milestone claims history and un-uses active claim tokens for a specific user UID. This allows them to re-claim milestones they have previously unlocked.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">User UID</label>
                  <input
                    type="text"
                    placeholder="Enter User ID (e.g., 5903912)"
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleResetUserMilestones}
                  disabled={toolLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase transition flex items-center justify-center gap-1"
                >
                  {toolLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Reset Milestone Progress
                </button>
              </div>
            </div>

            {/* Tool B: Manual Balance Adjustment (Credit/Deduct) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Manual Balance adjustment (Credit / Deduct)</h4>
              </div>
              <p className="text-xs text-slate-400">
                Manually adjust a user's wallet, coins, or bonus balance. This logs an administrative transaction record.
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min="1"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Wallet Type</label>
                    <select
                      value={creditType}
                      onChange={(e) => setCreditType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="wallet">Wallet Balance</option>
                      <option value="coins">Coins</option>
                      <option value="bonus">Bonus</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleManualBalanceAdjustment('credit')}
                    disabled={toolLoading}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase transition flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Credit Wallet
                  </button>
                  <button
                    onClick={() => handleManualBalanceAdjustment('deduct')}
                    disabled={toolLoading}
                    className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold uppercase transition flex items-center justify-center gap-1"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    Deduct Wallet
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL DIALOG */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/20 rounded-2xl p-5 space-y-4 shadow-2xl relative">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-500" />
              Reject Milestone Claim Reward
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Rejection Reason</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Same Device Detected">Same Device Detected</option>
                  <option value="Self Referral is not allowed.">Self Referral is not allowed.</option>
                  <option value="Proxy/VPN Detected.">Proxy/VPN Detected.</option>
                  <option value="Suspicious device activity.">Suspicious device activity.</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
