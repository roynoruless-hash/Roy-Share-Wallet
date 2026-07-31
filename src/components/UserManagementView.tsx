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
  Phone,
  UserCheck,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  Share2,
  Copy,
  AlertTriangle,
  Loader2,
  Send,
  History,
} from 'lucide-react';
import { AdminConfig, BotUser, WalletTransaction } from '../types';
import {
  fetchUsersFromDb,
  fetchUserTransactions,
  creditUserWallet,
  debitUserWallet,
  banUser,
  unbanUser,
  sendDirectTelegramMessage,
} from '../services/userService';

interface UserManagementViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ config, showToast }) => {
  const [users, setUsers] = useState<BotUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected User for Profile Modal
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Modal Action States
  const [activeModal, setActiveModal] = useState<'credit' | 'debit' | 'ban' | 'unban' | 'message' | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Filter users instantly by UID, Telegram ID, Username, Full Name, Mobile
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const nameMatch = u.firstName ? u.firstName.toLowerCase().includes(q) : false;
      const uidMatch = u.uid ? u.uid.toLowerCase().includes(q) : false;
      const tgIdMatch = u.telegramId ? u.telegramId.toLowerCase().includes(q) : false;
      const usernameMatch = u.username ? u.username.toLowerCase().includes(q) : false;
      const mobileMatch = u.mobile ? u.mobile.toLowerCase().includes(q) : false;
      return nameMatch || uidMatch || tgIdMatch || usernameMatch || mobileMatch;
    });
  }, [users, searchQuery]);

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

  // Handle Action: Add Money
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
        // Update local state immediately
        const updatedUser = { ...selectedUser, walletBalance: res.newBalance };
        setSelectedUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        // Refresh transactions
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

  // Handle Action: Deduct Money
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

  // Handle Action: Ban User
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

  // Handle Action: Unban User
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

  // Handle Action: Send Message
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
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                User Management
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 pl-11">
              Search, inspect profiles, manage wallet balances, ban/unban users, and send direct notifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
              <span>Refresh Users</span>
            </button>
            <div className="px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold">
              Total Users: {users.length}
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mt-6 relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by UID, Telegram ID, Username, Full Name, or Mobile Number..."
              className="w-full pl-12 pr-10 py-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-xs text-slate-400 pl-1 flex items-center gap-1.5">
              <span>Showing <b>{filteredUsers.length}</b> of <b>{users.length}</b> users</span>
            </div>
          )}
        </div>
      </div>

      {/* USER LIST / SKELETON / EMPTY STATE */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/60 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-slate-800 rounded" />
                <div className="h-5 w-16 bg-slate-800 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-800/80 rounded" />
                <div className="h-3 w-3/4 bg-slate-800/80 rounded" />
                <div className="h-3 w-1/2 bg-slate-800/80 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <X className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">❌ No user found.</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No registered Telegram user matches your search query &quot;{searchQuery}&quot;. Please verify the UID, Telegram ID, or phone number and try again.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isBanned = user.status === 'banned' || user.banned;
            return (
              <div
                key={user.id}
                className={`p-5 rounded-2xl bg-slate-900/80 border transition-all duration-200 flex flex-col justify-between hover:border-slate-700 shadow-lg group relative ${
                  isBanned ? 'border-rose-900/40 bg-rose-950/10' : 'border-slate-800/80'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-md ${
                        isBanned ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      }`}>
                        {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-sky-400 transition">
                          👤 {user.firstName}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {user.username ? `@${user.username.replace('@', '')}` : 'No Telegram Username'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0 border ${
                        isBanned
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {isBanned ? '🚫 Banned' : '🟢 Active'}
                    </span>
                  </div>

                  {/* Card Details List */}
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-950/40">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        🆔 UID:
                      </span>
                      <span className="font-mono font-bold text-white flex items-center gap-1">
                        <code>{user.uid}</code>
                        <button
                          onClick={() => copyToClipboard(user.uid, 'UID')}
                          className="hover:text-sky-400 text-slate-500 p-0.5"
                          title="Copy UID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 px-2">
                      <span className="text-slate-400">📱 Mobile Number:</span>
                      <span className="font-medium text-slate-200">{user.mobile || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 px-2">
                      <span className="text-slate-400">🆔 Telegram ID:</span>
                      <span className="font-mono text-slate-200">{user.telegramId}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 px-2 bg-emerald-500/5 rounded border border-emerald-500/10">
                      <span className="text-slate-300 font-semibold">💰 Wallet Balance:</span>
                      <span className="font-bold text-emerald-400 text-sm">₹{user.walletBalance}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded bg-slate-950/60 text-center">
                        <span className="text-[10px] text-slate-400 block">👥 Referrals</span>
                        <span className="font-bold text-white">{user.totalReferrals || 0}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/60 text-center">
                        <span className="text-[10px] text-slate-400 block">🎁 Earnings</span>
                        <span className="font-bold text-sky-400">₹{user.totalReferralEarnings || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>📅 Registered:</span>
                      <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* View Details Button */}
                <div className="mt-4 pt-3 border-t border-slate-800/60">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-sky-500 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* USER DETAILS MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                    selectedUser.status === 'banned' || selectedUser.banned
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  }`}
                >
                  {selectedUser.firstName ? selectedUser.firstName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedUser.firstName}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        selectedUser.status === 'banned' || selectedUser.banned
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {selectedUser.status === 'banned' || selectedUser.banned ? 'Banned' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    UID: <code className="text-sky-400 font-mono">{selectedUser.uid}</code> | Telegram ID: <code className="text-slate-300 font-mono">{selectedUser.telegramId}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Complete Profile Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">💰 Wallet Balance</span>
                <span className="text-base font-bold text-emerald-400">₹{selectedUser.walletBalance}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">👥 Total Referrals</span>
                <span className="text-base font-bold text-white">{selectedUser.totalReferrals || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">🎁 Referral Earnings</span>
                <span className="text-base font-bold text-sky-400">₹{selectedUser.totalReferralEarnings || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">📱 Mobile Number</span>
                <span className="text-xs font-semibold text-slate-200 truncate block mt-1">{selectedUser.mobile || 'N/A'}</span>
              </div>
            </div>

            {/* Extended Profile Attributes */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 border-b border-slate-800/80 pb-2">Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-slate-300 pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Username:</span>
                  <span className="font-medium text-white">{selectedUser.username ? `@${selectedUser.username.replace('@', '')}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Channel Verified:</span>
                  <span className={selectedUser.channelVerified ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {selectedUser.channelVerified ? 'Yes ✅' : 'No ❌'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Group Verified:</span>
                  <span className={selectedUser.groupVerified ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {selectedUser.groupVerified ? 'Yes ✅' : 'No ❌'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Referred By (UID):</span>
                  <span className="font-mono text-sky-400">{selectedUser.referredBy || selectedUser.referrerUid || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration Date:</span>
                  <span>{new Date(selectedUser.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Active:</span>
                  <span>{new Date(selectedUser.lastActive || selectedUser.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {(selectedUser.status === 'banned' || selectedUser.banned) && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 mt-2">
                  <span className="font-bold block">Ban Reason:</span>
                  <p className="text-xs">{selectedUser.banReason || 'No reason specified'}</p>
                </div>
              )}
            </div>

            {/* ADMIN ACTION BUTTONS */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Actions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => setActiveModal('credit')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>➕ Add Money</span>
                </button>

                <button
                  onClick={() => setActiveModal('debit')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>➖ Deduct Money</span>
                </button>

                {selectedUser.status === 'banned' || selectedUser.banned ? (
                  <button
                    onClick={() => setActiveModal('unban')}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>✅ Unban User</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveModal('ban')}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-slate-950 border border-rose-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Ban className="w-4 h-4" />
                    <span>🚫 Ban User</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveModal('message')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border border-sky-500/30 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>💬 Send Message</span>
                </button>
              </div>
            </div>

            {/* TRANSACTION HISTORY */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  <span>Latest Wallet Transactions</span>
                </h4>
                <span className="text-[11px] text-slate-500">{transactions.length} records</span>
              </div>

              {isLoadingTx ? (
                <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Loading transaction history...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 border border-slate-800/80">
                  No transaction records found for this user.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === 'admin_credit' || tx.type === 'referral' || tx.type === 'registration_bonus';
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg border ${
                              isCredit
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-white">
                              {tx.type === 'admin_credit'
                                ? 'Admin Credit'
                                : tx.type === 'admin_debit'
                                ? 'Admin Debit'
                                : tx.type === 'referral'
                                ? 'Referral Reward'
                                : tx.type === 'withdrawal'
                                ? 'Withdrawal'
                                : tx.type}
                            </div>
                            <div className="text-[11px] text-slate-400">{tx.reason || 'No description'}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isCredit ? `+₹${tx.amount}` : `-₹${tx.amount}`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Bal: ₹{tx.balanceAfter} | {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
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

      {/* ACTION MODAL: CREDIT MONEY */}
      {activeModal === 'credit' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>➕ Add Money to Wallet</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Target User: <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.uid}</code>)
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="e.g. Promotional Bonus / Admin Refund"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              ⚡ Wallet balance will update immediately in Firestore and notify the user via Telegram.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCredit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Confirm Credit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL: DEDUCT MONEY */}
      {activeModal === 'debit' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-400" />
                <span>➖ Deduct Money from Wallet</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Target User: <b className="text-white">{selectedUser.firstName}</b> | Current Balance: <b className="text-emerald-400">₹{selectedUser.walletBalance}</b>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount to Deduct (₹)</label>
                <input
                  type="number"
                  min="1"
                  max={selectedUser.walletBalance}
                  step="any"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="e.g. Penalty / Correction"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              ⚠️ Negative wallet balance is strictly prevented by the system.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDebit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Confirm Debit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL: BAN USER */}
      {activeModal === 'ban' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>🚫 Ban User Account</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Are you sure you want to suspend user <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.uid}</code>)?
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Reason for Suspension</label>
              <textarea
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="e.g. Fraudulent activity / Self referral abuse"
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              🚫 The bot will reply with <code>🚫 Your account has been suspended. Contact Admin.</code> to any message from this user.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Confirm Ban</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL: UNBAN USER */}
      {activeModal === 'unban' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>✅ Lift Account Suspension</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Re-activate account for <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.uid}</code>)?
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              User will regain access to all wallet features and receive a Telegram notification.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUnban}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Confirm Unban</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL: SEND MESSAGE */}
      {activeModal === 'message' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <span>💬 Send Direct Message</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Recipient: <b className="text-white">{selectedUser.firstName}</b> (@{selectedUser.username || selectedUser.telegramId})
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Message Text (HTML formatted)</label>
              <textarea
                value={modalMessage}
                onChange={(e) => setModalMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Supports Telegram HTML tags: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Send Message</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
