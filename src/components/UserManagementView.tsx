import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  X,
  Eye,
  PlusCircle,
  MinusCircle,
  Ban,
  CheckCircle,
  MessageSquare,
  Wallet,
  Shield,
  Copy,
  AlertTriangle,
  Loader2,
  Send,
  History,
  FileText,
  Trash2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  UserCheck,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AdminConfig, BotUser, WalletTransaction } from '../types';
import { BulkDeleteModal } from './BulkDeleteModal';
import {
  fetchUsersFromDb,
  fetchUserTransactions,
  creditUserWallet,
  debitUserWallet,
  banUser,
  unbanUser,
  sendDirectTelegramMessage,
  deleteUserAccountPermanently,
} from '../services/userService';
import {
  GlassCard,
  GlassBadge,
  GlassButton,
  GlassInput,
  GlassModal,
  StatCard,
  SkeletonUserCard,
  EmptyState,
} from './common/GlassComponents';

interface UserManagementViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ config, showToast }) => {
  const [users, setUsers] = useState<BotUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'high_risk' | 'safe'>('all');

  // Selected User for Profile Modal
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Passbook modal state
  const [isPassbookOpen, setIsPassbookOpen] = useState(false);
  const [passbookSearch, setPassbookSearch] = useState('');
  const [passbookFilter, setPassbookFilter] = useState('all');
  const [passbookPage, setPassbookPage] = useState(1);

  // Modal Action States
  const [activeModal, setActiveModal] = useState<'credit' | 'debit' | 'ban' | 'unban' | 'message' | 'delete' | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Delete Modal States
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteActionType, setBulkDeleteActionType] = useState<'DELETE_ALL_USERS' | 'RESET_PLATFORM'>('DELETE_ALL_USERS');

  // Load Users from Firestore
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsersFromDb();
      setUsers(data);
    } catch (err: any) {
      showToast('Failed to load users from Firestore', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Load User Transactions when selected user changes
  useEffect(() => {
    if (selectedUser) {
      setIsLoadingTx(true);
      fetchUserTransactions(selectedUser.uid)
        .then((txs) => setTransactions(txs))
        .finally(() => setIsLoadingTx(false));
    } else {
      setTransactions([]);
    }
  }, [selectedUser]);

  // Aggregate Dashboard Metrics
  const stats = useMemo(() => {
    const totalUsers = users.length;
    let activeCount = 0;
    let bannedCount = 0;
    let totalBalance = 0;

    users.forEach((u) => {
      if (u.status === 'banned' || u.banned) {
        bannedCount++;
      } else {
        activeCount++;
      }
      totalBalance += Number(u.walletBalance) || 0;
    });

    return { totalUsers, activeCount, bannedCount, totalBalance };
  }, [users]);

  // Filter users by search query + status chips
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isBanned = u.status === 'banned' || u.banned;

      // Status chip check
      if (statusFilter === 'active' && isBanned) return false;
      if (statusFilter === 'banned' && !isBanned) return false;
      if (statusFilter === 'high_risk' && (!isBanned && (u.walletBalance || 0) < 500)) return false; // simple example heuristic
      if (statusFilter === 'safe' && isBanned) return false;

      // Search text match
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = u.firstName ? u.firstName.toLowerCase().includes(q) : false;
      const uidMatch = u.uid ? u.uid.toLowerCase().includes(q) : false;
      const appUidMatch = u.appUid ? u.appUid.toLowerCase().includes(q) : false;
      const tgIdMatch = u.telegramId ? u.telegramId.toLowerCase().includes(q) : false;
      const usernameMatch = u.username ? u.username.toLowerCase().includes(q) : false;
      const mobileMatch = u.mobile ? u.mobile.toLowerCase().includes(q) : false;

      return nameMatch || uidMatch || appUidMatch || tgIdMatch || usernameMatch || mobileMatch;
    });
  }, [users, searchQuery, statusFilter]);

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard`, 'info');
  };

  // Close modals reset
  const closeModal = () => {
    setActiveModal(null);
    setModalAmount('');
    setModalReason('');
    setModalMessage('');
  };

  // Action: Delete User Account
  const handleDeleteAccount = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      let res: any = null;
      let sessionToken = '';
      try {
        const rawSession = localStorage.getItem('royshare_admin_session') || sessionStorage.getItem('royshare_admin_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          sessionToken = parsed.sessionToken || '';
        }
      } catch (e) {}

      try {
        const apiRes = await fetch('/api/admin/delete-user-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
            'x-admin-session-token': sessionToken,
          },
          body: JSON.stringify({
            targetUid: selectedUser.uid,
            targetDocId: selectedUser.id,
            targetTelegramId: selectedUser.telegramId,
            targetMobile: selectedUser.mobile,
            adminRole: 'Super Admin',
            reason: modalReason.trim() || 'Super Admin Account Deletion',
          }),
        });
        res = await apiRes.json();

        if (apiRes.status === 401 || apiRes.status === 403 || (res && res.error && res.error.toLowerCase().includes('unauthorized'))) {
          showToast(res.error || res.reason || 'Session expired or invalid.', 'error');
          window.dispatchEvent(new Event('admin-session-expired'));
          return;
        }
      } catch (e) {
        console.warn('API call failed, executing direct Firestore fallback:', e);
      }

      if (res && res.success) {
        showToast('✅ User account deleted successfully.', 'success');
        const deletedUid = selectedUser.uid;
        setSelectedUser(null);
        closeModal();
        setUsers((prev) => prev.filter((u) => u.uid !== deletedUid && u.id !== selectedUser.id));
        loadUsers();
      } else if (res && res.error) {
        showToast(`Deletion failed: ${res.error}`, 'error');
      } else {
        const directRes = await deleteUserAccountPermanently({
          user: selectedUser,
          adminId: config.adminTelegramId || 'Super Admin',
          adminName: 'Super Admin',
          reason: modalReason.trim() || 'Super Admin Account Deletion',
        });
        if (directRes.success) {
          showToast('✅ User account deleted successfully.', 'success');
          const deletedUid = selectedUser.uid;
          setSelectedUser(null);
          closeModal();
          setUsers((prev) => prev.filter((u) => u.uid !== deletedUid && u.id !== selectedUser.id));
          loadUsers();
        } else {
          showToast(`Deletion failed: ${directRes.error}`, 'error');
        }
      }
    } catch (err: any) {
      showToast(`Error deleting account: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Add Money
  const handleCredit = async () => {
    if (!selectedUser) return;
    const amt = parseFloat(modalAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await creditUserWallet({
        userDocId: selectedUser.id,
        uid: selectedUser.uid,
        telegramId: selectedUser.telegramId,
        amount: amt,
        reason: modalReason.trim() || 'Admin Manual Credit',
        adminId: config.adminTelegramId || 'admin',
        botToken: config.botToken,
      });

      if (res.success) {
        showToast(`Successfully credited ₹${amt} to user #${selectedUser.uid}`, 'success');
        const updatedUser = { ...selectedUser, walletBalance: res.newBalance };
        setSelectedUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        fetchUserTransactions(selectedUser.uid).then(setTransactions);
        closeModal();
      } else {
        showToast(`Credit failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Deduct Money
  const handleDebit = async () => {
    if (!selectedUser) return;
    const amt = parseFloat(modalAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    if (amt > selectedUser.walletBalance) {
      showToast(`Cannot deduct ₹${amt}. Current balance is ₹${selectedUser.walletBalance}`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await debitUserWallet({
        userDocId: selectedUser.id,
        uid: selectedUser.uid,
        telegramId: selectedUser.telegramId,
        amount: amt,
        reason: modalReason.trim() || 'Admin Manual Debit',
        adminId: config.adminTelegramId || 'admin',
        botToken: config.botToken,
      });

      if (res.success) {
        showToast(`Successfully debited ₹${amt} from user #${selectedUser.uid}`, 'success');
        const updatedUser = { ...selectedUser, walletBalance: res.newBalance };
        setSelectedUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        fetchUserTransactions(selectedUser.uid).then(setTransactions);
        closeModal();
      } else {
        showToast(`Debit failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Ban User
  const handleBan = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await banUser({
        userDocId: selectedUser.id,
        uid: selectedUser.uid,
        telegramId: selectedUser.telegramId,
        reason: modalReason.trim() || 'Violation of Bot Policies',
        adminId: config.adminTelegramId || 'admin',
        botToken: config.botToken,
      });

      if (res.success) {
        showToast(`User #${selectedUser.uid} has been banned`, 'success');
        const updatedUser = {
          ...selectedUser,
          status: 'banned',
          banned: true,
          banReason: modalReason.trim() || 'Violation of Bot Policies',
        };
        setSelectedUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        closeModal();
      } else {
        showToast(`Ban failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Unban User
  const handleUnban = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const res = await unbanUser({
        userDocId: selectedUser.id,
        uid: selectedUser.uid,
        telegramId: selectedUser.telegramId,
        adminId: config.adminTelegramId || 'admin',
        botToken: config.botToken,
      });

      if (res.success) {
        showToast(`Suspension lifted for user #${selectedUser.uid}`, 'success');
        const updatedUser = { ...selectedUser, status: 'active', banned: false, banReason: '' };
        setSelectedUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        closeModal();
      } else {
        showToast(`Unban failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Send Message
  const handleSendMessage = async () => {
    if (!selectedUser) return;
    if (!modalMessage.trim()) {
      showToast('Please enter a message to send', 'error');
      return;
    }

    if (!config.botToken) {
      showToast('Bot Token is missing in Admin Configuration', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendDirectTelegramMessage(
        config.botToken,
        selectedUser.telegramId,
        modalMessage.trim()
      );

      if (res.success) {
        showToast(`Message delivered to user @${selectedUser.username || selectedUser.uid}`, 'success');
        closeModal();
      } else {
        showToast(`Delivery failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error sending message: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* SECTION 1: HEADER & CONTROLS */}
      <GlassCard className="relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  User Management
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scoped exclusively to <strong className="text-sky-400">ROY SHARE WALLET</strong> users
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="secondary" size="sm" onClick={loadUsers} isLoading={isLoading} icon={RefreshCw}>
              Refresh
            </GlassButton>

            <GlassButton
              variant="danger"
              size="sm"
              onClick={() => {
                setBulkDeleteActionType('DELETE_ALL_USERS');
                setIsBulkDeleteOpen(true);
              }}
              icon={Trash2}
            >
              Delete All Users
            </GlassButton>

            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setBulkDeleteActionType('RESET_PLATFORM');
                setIsBulkDeleteOpen(true);
              }}
              icon={RefreshCw}
            >
              Reset Platform
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* SECTION 2: METRICS STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Roy Share Scope"
          icon={Users}
          iconColor="text-sky-400"
          badge="Scoped"
        />
        <StatCard
          title="Active Users"
          value={stats.activeCount}
          subtitle="Verified & Active"
          icon={UserCheck}
          iconColor="text-emerald-400"
          trendType="up"
        />
        <StatCard
          title="Banned Users"
          value={stats.bannedCount}
          subtitle="Suspended"
          icon={Ban}
          iconColor="text-rose-400"
          trendType="down"
        />
        <StatCard
          title="Total Balance"
          value={`₹${stats.totalBalance.toLocaleString()}`}
          subtitle="User Ledger"
          icon={Wallet}
          iconColor="text-amber-400"
        />
      </div>

      {/* SECTION 3: SEARCH & FILTER CONTROLS */}
      <GlassCard className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex-1">
            <GlassInput
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search UID, Telegram ID, Username, Name, Mobile..."
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Users' },
              { id: 'active', label: '🟢 Active' },
              { id: 'banned', label: '🔴 Banned' },
              { id: 'high_risk', label: '🟡 High Balance' },
              { id: 'safe', label: '🛡️ Safe' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setStatusFilter(chip.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border whitespace-nowrap ${
                  statusFilter === chip.id
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <span>
            Showing <strong className="text-white">{filteredUsers.length}</strong> of{' '}
            <strong className="text-slate-300">{users.length}</strong> users
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-sky-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear search
            </button>
          )}
        </div>
      </GlassCard>

      {/* SECTION 4: USER CONTENT (DESKTOP TABLE & MOBILE CARDS) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonUserCard key={i} />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="No Users Found"
          description={
            searchQuery
              ? `No user matched "${searchQuery}". Try searching with a different UID, Telegram ID or phone number.`
              : 'No registered Roy Share Wallet users found.'
          }
          icon={Users}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <>
          {/* DESKTOP VIEW: High-Contrast Glass Table */}
          <div className="hidden md:block w-full overflow-x-auto rounded-2xl border border-slate-800/80 glass-card">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">UID & Telegram ID</th>
                  <th className="py-3.5 px-4">Mobile</th>
                  <th className="py-3.5 px-4">Wallet Balance</th>
                  <th className="py-3.5 px-4">Referrals</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isBanned = user.status === 'banned' || user.banned;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-900/60 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isBanned
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-sky-400 transition">
                              {user.firstName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {user.username ? `@${user.username.replace('@', '')}` : 'No username'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1 font-bold text-sky-400">
                          <span>{user.appUid || user.uid}</span>
                          <button
                            onClick={() => copyToClipboard(user.appUid || user.uid, 'UID')}
                            className="p-1 hover:text-white text-slate-500"
                            title="Copy UID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          TG: {user.telegramId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {user.mobile || 'N/A'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-400 text-sm">
                          ₹{user.walletBalance}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">{user.totalReferrals || 0}</div>
                        <span className="text-[10px] text-sky-400">
                          Earned: ₹{user.totalReferralEarnings || 0}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <GlassBadge variant={isBanned ? 'rose' : 'emerald'} size="sm">
                          {isBanned ? 'Banned' : 'Active'}
                        </GlassBadge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                          icon={Eye}
                        >
                          Details
                        </GlassButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW: Responsive Glass Cards */}
          <div className="md:hidden grid grid-cols-1 gap-3.5">
            {filteredUsers.map((user) => {
              const isBanned = user.status === 'banned' || user.banned;
              return (
                <GlassCard key={user.id} className="space-y-3 relative overflow-hidden">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isBanned
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{user.firstName}</h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {user.username ? `@${user.username.replace('@', '')}` : 'No Telegram Username'}
                        </p>
                      </div>
                    </div>

                    <GlassBadge variant={isBanned ? 'rose' : 'emerald'} size="sm">
                      {isBanned ? 'Banned' : 'Active'}
                    </GlassBadge>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-slate-400 text-[11px]">UID:</span>
                      <div className="flex items-center gap-1 font-mono font-bold text-sky-400">
                        <span>{user.appUid || user.uid}</span>
                        <button
                          onClick={() => copyToClipboard(user.appUid || user.uid, 'UID')}
                          className="p-1 hover:text-white text-slate-500"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1">
                      <span className="text-slate-400 text-[11px]">Mobile:</span>
                      <span className="font-semibold text-slate-200">{user.mobile || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1">
                      <span className="text-slate-400 text-[11px]">Telegram ID:</span>
                      <span className="font-mono text-slate-300">{user.telegramId}</span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-300 font-semibold text-[11px]">Wallet Balance:</span>
                      <span className="font-bold text-emerald-400 text-sm">₹{user.walletBalance}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-slate-950/60 text-center border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">Referrals</span>
                        <span className="font-bold text-white text-xs">{user.totalReferrals || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 text-center border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">Earnings</span>
                        <span className="font-bold text-sky-400 text-xs">₹{user.totalReferralEarnings || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Button */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                      className="w-full"
                      icon={Eye}
                    >
                      View Profile & Actions
                    </GlassButton>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* USER DETAILS & PROFILE MODAL */}
      <GlassModal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.firstName || 'User Details'}
        subtitle={`UID: ${selectedUser?.appUid || selectedUser?.uid || ''} | Telegram ID: ${selectedUser?.telegramId || ''}`}
        maxWidth="2xl"
      >
        {selectedUser && (
          <div className="space-y-5">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Wallet Balance</span>
                <span className="text-lg font-black text-emerald-400">₹{selectedUser.walletBalance}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Referrals</span>
                <span className="text-lg font-black text-white">{selectedUser.totalReferrals || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Referral Rewards</span>
                <span className="text-lg font-black text-sky-400">₹{selectedUser.totalReferralEarnings || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Mobile Number</span>
                <span className="text-xs font-bold text-slate-200 block truncate mt-1">{selectedUser.mobile || 'N/A'}</span>
              </div>
            </div>

            {/* Profile Info Grid */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-2">Profile Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-slate-300 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Username:</span>
                  <span className="font-semibold text-white">{selectedUser.username ? `@${selectedUser.username.replace('@', '')}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Channel Verified:</span>
                  <span className={selectedUser.channelVerified ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {selectedUser.channelVerified ? 'Yes ✅' : 'No ❌'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Group Verified:</span>
                  <span className={selectedUser.groupVerified ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {selectedUser.groupVerified ? 'Yes ✅' : 'No ❌'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Referred By:</span>
                  <span className="font-mono text-sky-400">{selectedUser.referredBy || selectedUser.referrerUid || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Registration Date:</span>
                  <span>{new Date(selectedUser.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Active:</span>
                  <span>{new Date(selectedUser.lastActive || selectedUser.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {(selectedUser.status === 'banned' || selectedUser.banned) && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 mt-2">
                  <span className="font-bold block">Ban Reason:</span>
                  <p className="text-xs">{selectedUser.banReason || 'Violation of bot terms'}</p>
                </div>
              )}
            </div>

            {/* Admin Action Buttons */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Actions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <GlassButton variant="success" size="sm" onClick={() => setActiveModal('credit')} icon={PlusCircle}>
                  Add Money
                </GlassButton>

                <GlassButton variant="secondary" size="sm" onClick={() => setActiveModal('debit')} icon={MinusCircle}>
                  Deduct
                </GlassButton>

                {selectedUser.status === 'banned' || selectedUser.banned ? (
                  <GlassButton variant="success" size="sm" onClick={() => setActiveModal('unban')} icon={CheckCircle}>
                    Unban
                  </GlassButton>
                ) : (
                  <GlassButton variant="danger" size="sm" onClick={() => setActiveModal('ban')} icon={Ban}>
                    Ban
                  </GlassButton>
                )}

                <GlassButton variant="primary" size="sm" onClick={() => setActiveModal('message')} icon={MessageSquare}>
                  Message
                </GlassButton>

                <GlassButton variant="danger" size="sm" onClick={() => setActiveModal('delete')} icon={Trash2} className="col-span-2 sm:col-span-1">
                  Delete
                </GlassButton>
              </div>
            </div>

            {/* Wallet Ledger */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  <span>Wallet Transaction Ledger</span>
                </h4>
                <span className="text-[11px] text-slate-500">{transactions.length} records</span>
              </div>

              {isLoadingTx ? (
                <div className="py-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Loading transaction records...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 border border-slate-800">
                  No transaction records found for this user.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {transactions.slice(0, 3).map((tx) => {
                      const isCredit = tx.amount >= 0;
                      return (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-1.5 rounded-lg border ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-bold text-white">{tx.type || 'Transaction'}</div>
                              <div className="text-[11px] text-slate-400 line-clamp-1">{tx.description || tx.reason || 'No description'}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isCredit ? '+' : ''}₹{tx.amount}
                            </div>
                            <div className="text-[10px] text-slate-500">Bal: ₹{tx.balanceAfter}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsPassbookOpen(true);
                      setPassbookSearch('');
                      setPassbookFilter('all');
                      setPassbookPage(1);
                    }}
                    className="w-full"
                    icon={History}
                  >
                    View Full Transaction History & Passbook
                  </GlassButton>
                </div>
              )}
            </div>
          </div>
        )}
      </GlassModal>

      {/* ACTION MODAL: CREDIT MONEY */}
      <GlassModal
        isOpen={activeModal === 'credit'}
        onClose={closeModal}
        title="➕ Add Money to Wallet"
        subtitle={`Target User: ${selectedUser?.firstName || ''} (UID: ${selectedUser?.appUid || selectedUser?.uid || ''})`}
      >
        <div className="space-y-4">
          <GlassInput
            type="number"
            label="Amount (₹)"
            value={modalAmount}
            onChange={(e) => setModalAmount(e.target.value)}
            placeholder="e.g. 50"
          />
          <GlassInput
            type="text"
            label="Reason / Note"
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Promotional Bonus / Admin Refund"
          />

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            ⚡ Wallet balance will update immediately in Firestore and notify the user via Telegram.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="success" size="sm" onClick={handleCredit} isLoading={isSubmitting}>
              Confirm Credit
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ACTION MODAL: DEDUCT MONEY */}
      <GlassModal
        isOpen={activeModal === 'debit'}
        onClose={closeModal}
        title="➖ Deduct Money from Wallet"
        subtitle={`Target User: ${selectedUser?.firstName || ''} | Current Balance: ₹${selectedUser?.walletBalance || 0}`}
      >
        <div className="space-y-4">
          <GlassInput
            type="number"
            label="Amount to Deduct (₹)"
            value={modalAmount}
            onChange={(e) => setModalAmount(e.target.value)}
            placeholder="e.g. 20"
          />
          <GlassInput
            type="text"
            label="Reason / Note"
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Penalty / Correction"
          />

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            ⚠️ Negative wallet balance is strictly prevented by the system.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" size="sm" onClick={handleDebit} isLoading={isSubmitting}>
              Confirm Debit
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ACTION MODAL: BAN USER */}
      <GlassModal
        isOpen={activeModal === 'ban'}
        onClose={closeModal}
        title="🚫 Ban User Account"
        subtitle={`User: ${selectedUser?.firstName || ''} (UID: ${selectedUser?.appUid || selectedUser?.uid || ''})`}
      >
        <div className="space-y-4">
          <GlassInput
            label="Reason for Suspension"
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Fraudulent activity / Self referral abuse"
          />

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            🚫 The bot will reply with <code>🚫 Your account has been suspended.</code> to any message.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" size="sm" onClick={handleBan} isLoading={isSubmitting}>
              Confirm Ban
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ACTION MODAL: UNBAN USER */}
      <GlassModal
        isOpen={activeModal === 'unban'}
        onClose={closeModal}
        title="✅ Lift Account Suspension"
        subtitle={`User: ${selectedUser?.firstName || ''}`}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            User will regain access to all wallet features and receive a Telegram notification.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="success" size="sm" onClick={handleUnban} isLoading={isSubmitting}>
              Confirm Unban
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ACTION MODAL: SEND MESSAGE */}
      <GlassModal
        isOpen={activeModal === 'message'}
        onClose={closeModal}
        title="💬 Send Direct Telegram Message"
        subtitle={`Recipient: ${selectedUser?.firstName || ''} (@${selectedUser?.username || selectedUser?.telegramId || ''})`}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">Message Text (HTML)</label>
            <textarea
              value={modalMessage}
              onChange={(e) => setModalMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              className="glass-input w-full rounded-xl p-3 text-xs sm:text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSendMessage} isLoading={isSubmitting} icon={Send}>
              Send Message
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ACTION MODAL: DELETE ACCOUNT */}
      <GlassModal
        isOpen={activeModal === 'delete'}
        onClose={closeModal}
        title="🚨 Delete User Account (Super Admin)"
        subtitle={`User: ${selectedUser?.firstName || ''} (UID: ${selectedUser?.appUid || selectedUser?.uid || ''})`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>PERMANENT DELETION WARNING</span>
            </div>
            <p>
              Are you sure you want to permanently delete this user account? This action cannot be undone.
            </p>
          </div>

          <GlassInput
            label="Reason for Deletion"
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Duplicate account / User request"
          />

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton variant="secondary" size="sm" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" size="sm" onClick={handleDeleteAccount} isLoading={isSubmitting} icon={Trash2}>
              Permanently Delete User
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* PASSBOOK TRANSACTIONS MODAL */}
      <GlassModal
        isOpen={isPassbookOpen}
        onClose={() => setIsPassbookOpen(false)}
        title={`${selectedUser?.firstName || 'User'}'s Transaction History`}
        subtitle={`Mobile: ${selectedUser?.mobile || 'N/A'}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassInput
              icon={Search}
              value={passbookSearch}
              onChange={(e) => {
                setPassbookSearch(e.target.value);
                setPassbookPage(1);
              }}
              placeholder="Search description or type..."
            />
            <select
              value={passbookFilter}
              onChange={(e) => {
                setPassbookFilter(e.target.value);
                setPassbookPage(1);
              }}
              className="glass-input rounded-xl px-3 py-2 text-xs text-slate-300"
            >
              <option value="all">All Transactions</option>
              <option value="bonus">Bonus</option>
              <option value="referral">Referrals</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="credit">Credits</option>
              <option value="debit">Debits</option>
            </select>
          </div>

          <div className="min-h-[250px] border border-slate-800 rounded-xl bg-slate-950/60 p-2 space-y-2">
            {(() => {
              const filtered = transactions.filter((tx) => {
                if (passbookSearch.trim()) {
                  const sq = passbookSearch.toLowerCase();
                  const typeMatch = tx.type?.toLowerCase().includes(sq);
                  const descMatch = (tx.description || tx.reason || '').toLowerCase().includes(sq);
                  if (!typeMatch && !descMatch) return false;
                }
                if (passbookFilter !== 'all') {
                  const type = tx.type?.toLowerCase() || '';
                  if (!type.includes(passbookFilter)) return false;
                }
                return true;
              });

              const pageSize = 8;
              const totalItems = filtered.length;
              const totalPages = Math.ceil(totalItems / pageSize) || 1;
              const startIndex = (passbookPage - 1) * pageSize;
              const items = filtered.slice(startIndex, startIndex + pageSize);

              if (items.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No transactions match criteria.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {items.map((tx) => {
                    const isCredit = tx.amount >= 0;
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{tx.type || 'Transaction'}</div>
                          <div className="text-[11px] text-slate-400">{tx.description || tx.reason || 'N/A'}</div>
                          <div className="text-[10px] text-slate-500">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isCredit ? '+' : ''}₹{tx.amount}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">Bal: ₹{tx.balanceAfter}</div>
                        </div>
                      </div>
                    );
                  })}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                      <span>
                        Page {passbookPage} of {totalPages}
                      </span>
                      <div className="flex gap-1">
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          disabled={passbookPage === 1}
                          onClick={() => setPassbookPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </GlassButton>
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          disabled={passbookPage === totalPages}
                          onClick={() => setPassbookPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </GlassButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </GlassModal>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        actionType={bulkDeleteActionType}
        onSuccess={loadUsers}
        showToast={showToast}
      />
    </div>
  );
};
