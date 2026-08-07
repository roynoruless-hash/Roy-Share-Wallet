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
  FileText,
  Trash2,
  ShieldAlert,
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

  // Handle Action: Delete User Account (Super Admin only, no OTP required)
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
          showToast(res.error || res.reason || 'Session expired or invalid. Redirecting to login...', 'error');
          window.dispatchEvent(new Event('admin-session-expired'));
          return;
        }
      } catch (e) {
        console.warn('API call failed, executing direct Firestore fallback:', e);
      }

      if (res && res.success) {
        showToast('✅ User account deleted successfully. The user can now register again as a new account.', 'success');
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
          showToast('✅ User account deleted successfully. The user can now register again as a new account.', 'success');
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

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
              <span>Refresh Users</span>
            </button>

            <button
              onClick={() => {
                setBulkDeleteActionType('DELETE_ALL_USERS');
                setIsBulkDeleteOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/40 transition shadow-md shadow-rose-600/15 active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>🗑 Delete All Users</span>
            </button>

            <button
              onClick={() => {
                setBulkDeleteActionType('RESET_PLATFORM');
                setIsBulkDeleteOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/40 transition shadow-md shadow-amber-600/15 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>🧹 Reset Platform</span>
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
                        <code>{user.appUid || user.uid}</code>
                        <button
                          onClick={() => copyToClipboard(user.appUid || user.uid, 'UID')}
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
                    UID: <code className="text-sky-400 font-mono">{selectedUser.appUid || selectedUser.uid}</code> | Telegram ID: <code className="text-slate-300 font-mono">{selectedUser.telegramId}</code>
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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
                  <span>💬 Message</span>
                </button>

                <button
                  onClick={() => setActiveModal('delete')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition flex items-center justify-center gap-1.5 shadow-sm col-span-2 sm:col-span-1"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>🗑️ Delete</span>
                </button>
              </div>
            </div>

            {/* TRANSACTION HISTORY */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  <span>Wallet Transaction Ledger</span>
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
                <div className="space-y-2">
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {transactions.slice(0, 3).map((tx) => {
                      const isCredit = tx.amount >= 0;
                      return (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs animate-scaleIn"
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
                                {tx.type || 'Transaction'}
                              </div>
                              <div className="text-[11px] text-slate-400 line-clamp-1">{tx.description || tx.reason || 'No description'}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isCredit ? `+` : ''}₹{tx.amount}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Bal: ₹{tx.balanceAfter}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setIsPassbookOpen(true);
                      setPassbookSearch('');
                      setPassbookFilter('all');
                      setPassbookPage(1);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-850 text-sky-400 border border-slate-800 transition shadow-sm"
                  >
                    <History className="w-4 h-4 text-sky-400" />
                    <span>View Full Transaction History & Passbook</span>
                  </button>
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
              Target User: <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.appUid || selectedUser.uid}</code>)
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
              Are you sure you want to suspend user <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.appUid || selectedUser.uid}</code>)?
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
              Re-activate account for <b className="text-white">{selectedUser.firstName}</b> (UID: <code className="text-sky-400">{selectedUser.appUid || selectedUser.uid}</code>)?
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

      {/* ACTION MODAL: DELETE USER ACCOUNT (SUPER ADMIN ONLY) */}
      {activeModal === 'delete' && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-rose-900/40">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
                <span>Delete User Account (Super Admin)</span>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Permanent Warning Box */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>⚠️ PERMANENT DELETION WARNING</span>
              </div>
              <p className="font-semibold text-rose-100">
                Are you sure you want to permanently delete this user account? This action cannot be undone.
              </p>
            </div>

            {/* Target Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div className="font-bold text-white text-sm pb-1 border-b border-slate-800 flex justify-between">
                <span>👤 {selectedUser.firstName}</span>
                <span className="text-sky-400 font-mono">UID: {selectedUser.appUid || selectedUser.uid}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>📱 Mobile: <b className="text-slate-200">{selectedUser.mobile || 'N/A'}</b></div>
                <div>🆔 Telegram ID: <b className="text-slate-200">{selectedUser.telegramId}</b></div>
                <div>💰 Wallet: <b className="text-emerald-400">₹{selectedUser.walletBalance}</b></div>
                <div>👥 Referrals: <b className="text-slate-200">{selectedUser.totalReferrals || 0}</b></div>
              </div>
            </div>

            {/* Items wiped notice */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">The following data will be permanently purged:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                <li>Firestore Profile & Status records</li>
                <li>Wallet balance & full transaction history</li>
                <li>Referral tokens, logs & milestone claim records</li>
                <li>Feedback submissions & OTP verifications</li>
                <li>Contest registrations & voting history</li>
                <li>Withdrawal requests & device verification fingerprints</li>
              </ul>
              <p className="pt-1.5 text-emerald-400 font-medium">
                ✅ Once deleted, the mobile number and Telegram ID will be completely freed, allowing the user to register again as a new account.
              </p>
            </div>

            {/* Reason Input */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  Reason for Deletion (Optional - for Audit Log)
                </label>
                <input
                  type="text"
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="e.g. Fraudulent account / Duplicate entry / User requested"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED USER TRANSACTIONS HISTORY & PASSBOOK MODAL */}
      {isPassbookOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-scaleIn flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedUser.firstName}'s Transaction History
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Registered Mobile: <span className="font-mono text-slate-200">{selectedUser.mobile || 'N/A'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPassbookOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-850"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Filters bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={passbookSearch}
                  onChange={(e) => {
                    setPassbookSearch(e.target.value);
                    setPassbookPage(1);
                  }}
                  placeholder="Search by description or type..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <select
                  value={passbookFilter}
                  onChange={(e) => {
                    setPassbookFilter(e.target.value);
                    setPassbookPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition appearance-none"
                >
                  <option value="all">All Transactions</option>
                  <option value="bonus">Bonus (Registration, Milestones)</option>
                  <option value="referral">Referral Bonuses</option>
                  <option value="feedback">Feedback Rewards</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="credit">Admin Credits</option>
                  <option value="debit">Admin Debits</option>
                </select>
              </div>
            </div>

            {/* Transactions Table/List Container */}
            <div className="flex-1 overflow-y-auto min-h-[250px] border border-slate-800 rounded-xl bg-slate-950/40">
              {(() => {
                // Filter logic
                const filtered = transactions.filter((tx) => {
                  // Search query match
                  if (passbookSearch.trim()) {
                    const sq = passbookSearch.toLowerCase();
                    const typeMatch = tx.type?.toLowerCase().includes(sq);
                    const descMatch = (tx.description || tx.reason || '').toLowerCase().includes(sq);
                    const idMatch = tx.transactionId?.toLowerCase().includes(sq);
                    if (!typeMatch && !descMatch && !idMatch) return false;
                  }

                  // Dropdown filter match
                  if (passbookFilter !== 'all') {
                    const type = tx.type?.toLowerCase() || '';
                    if (passbookFilter === 'bonus') {
                      if (!type.includes('bonus') && !type.includes('milestone')) return false;
                    } else if (passbookFilter === 'referral') {
                      if (!type.includes('referral')) return false;
                    } else if (passbookFilter === 'feedback') {
                      if (!type.includes('feedback')) return false;
                    } else if (passbookFilter === 'withdrawal') {
                      if (!type.includes('withdrawal')) return false;
                    } else if (passbookFilter === 'credit') {
                      if (!type.includes('credit')) return false;
                    } else if (passbookFilter === 'debit') {
                      if (!type.includes('debit')) return false;
                    }
                  }

                  return true;
                });

                // Pagination math
                const passbookPageSize = 8;
                const totalItems = filtered.length;
                const totalPages = Math.ceil(totalItems / passbookPageSize) || 1;
                const startIndex = (passbookPage - 1) * passbookPageSize;
                const paginatedItems = filtered.slice(startIndex, startIndex + passbookPageSize);

                return (
                  <div className="flex flex-col h-full justify-between">
                    {/* List */}
                    <div className="divide-y divide-slate-850">
                      {paginatedItems.length > 0 ? (
                        paginatedItems.map((tx) => {
                          const isCredit = tx.amount >= 0;
                          return (
                            <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-900/40 text-xs transition">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-500">{tx.transactionId || 'N/A'}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                    isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {tx.type || 'Transaction'}
                                  </span>
                                </div>
                                <p className="text-slate-300 font-medium">{tx.description || tx.reason || 'No description'}</p>
                                <span className="text-[10px] text-slate-500 block">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                                </span>
                              </div>

                              <div className="text-right space-y-1">
                                <div className={`font-black text-sm font-mono ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isCredit ? '+' : ''}₹{tx.amount}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 font-mono">
                                  Bal: ₹{tx.balanceAfter}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-16 text-center text-slate-600 text-xs flex flex-col items-center justify-center gap-2">
                          <FileText className="w-8 h-8 text-slate-700" />
                          <span>No transaction records matched criteria.</span>
                        </div>
                      )}
                    </div>

                    {/* Pagination control footer */}
                    {totalPages > 1 && (
                      <div className="p-3 bg-slate-900/60 border-t border-slate-850 flex items-center justify-between shrink-0">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Showing {startIndex + 1}-{Math.min(startIndex + passbookPageSize, totalItems)} of {totalItems}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={passbookPage === 1}
                            onClick={() => setPassbookPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 text-[11px] font-bold transition"
                          >
                            Prev
                          </button>
                          <span className="text-[11px] text-slate-400 font-mono px-1">
                            {passbookPage} / {totalPages}
                          </span>
                          <button
                            disabled={passbookPage === totalPages}
                            onClick={() => setPassbookPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 text-[11px] font-bold transition"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end shrink-0 pt-1">
              <button
                onClick={() => setIsPassbookOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close Passbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete All Users & Reset Platform Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        actionType={bulkDeleteActionType}
        onSuccess={() => {
          loadUsers();
        }}
        showToast={showToast}
      />
    </div>
  );
};
