import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronsLeft,
  ChevronsRight,
  User,
  Phone,
  MessageSquare,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, startAfter, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { WalletTransaction } from '../types';

export const TransactionsView: React.FC = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'uid' | 'mobile' | 'telegramId' | 'transactionId'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [prevVisibleDocs, setPrevVisibleDocs] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 20;

  // Available types for filtering
  const transactionTypes = [
    'Registration Bonus',
    'Referral Bonus',
    'Referral Milestone Reward',
    'Feedback Reward',
    'Admin Credit',
    'Admin Debit',
    'Withdrawal Request',
    'Withdrawal Approved',
    'Withdrawal Rejected',
  ];

  const fetchTransactions = async (isNext = false, isPrev = false) => {
    setIsLoading(true);
    try {
      let txCollection = collection(db, 'transactions');
      let txQuery;

      // Base query: order by createdAt descending
      if (isNext && lastVisibleDoc) {
        txQuery = query(txCollection, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(itemsPerPage));
      } else if (isPrev && prevVisibleDocs.length > 0) {
        const prevDoc = prevVisibleDocs[prevVisibleDocs.length - 2] || null;
        if (prevDoc) {
          txQuery = query(txCollection, orderBy('createdAt', 'desc'), startAfter(prevDoc), limit(itemsPerPage));
        } else {
          txQuery = query(txCollection, orderBy('createdAt', 'desc'), limit(itemsPerPage));
        }
      } else {
        txQuery = query(txCollection, orderBy('createdAt', 'desc'), limit(itemsPerPage));
      }

      const snap = await getDocs(txQuery);
      const fetched: WalletTransaction[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        fetched.push({
          id: doc.id,
          ...data,
        } as WalletTransaction);
      });

      // Update pagination states
      if (snap.docs.length > 0) {
        setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
        if (isNext) {
          setPrevVisibleDocs((prev) => [...prev, lastVisibleDoc]);
          setCurrentPage((p) => p + 1);
        } else if (isPrev) {
          setPrevVisibleDocs((prev) => prev.slice(0, -1));
          setCurrentPage((p) => Math.max(1, p - 1));
        } else {
          setPrevVisibleDocs([]);
          setCurrentPage(1);
        }
        setHasMore(snap.docs.length === itemsPerPage);
      } else {
        setHasMore(false);
      }

      setTransactions(fetched);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter & Search local helper safely (with full guards against null/undefined values)
  const filteredTransactions = transactions.filter((tx) => {
    try {
      // 1. Search Query
      if (searchQuery && searchQuery.trim()) {
        const q = String(searchQuery).toLowerCase().trim();
        const txUid = tx.uid ? String(tx.uid).toLowerCase() : '';
        const txMobile = tx.mobile ? String(tx.mobile).toLowerCase() : '';
        const txTelegramId = tx.telegramId ? String(tx.telegramId).toLowerCase() : '';
        const txTransactionId = tx.transactionId ? String(tx.transactionId).toLowerCase() : '';
        const txFullName = tx.fullName ? String(tx.fullName).toLowerCase() : '';

        if (searchField === 'uid') {
          if (txUid.indexOf(q) === -1) return false;
        } else if (searchField === 'mobile') {
          if (txMobile.indexOf(q) === -1) return false;
        } else if (searchField === 'telegramId') {
          if (txTelegramId.indexOf(q) === -1) return false;
        } else if (searchField === 'transactionId') {
          if (txTransactionId.indexOf(q) === -1) return false;
        } else {
          const matchAll =
            txUid.indexOf(q) !== -1 ||
            txMobile.indexOf(q) !== -1 ||
            txTelegramId.indexOf(q) !== -1 ||
            txTransactionId.indexOf(q) !== -1 ||
            txFullName.indexOf(q) !== -1;
          if (!matchAll) return false;
        }
      }

      // 2. Filter Type
      if (filterType && filterType !== 'all') {
        if (tx.type !== filterType) return false;
      }

      // 3. Date Filters
      if (startDate) {
        const txDate = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
        const sDate = new Date(startDate).getTime();
        if (isNaN(txDate) || isNaN(sDate) || txDate < sDate) return false;
      }
      if (endDate) {
        const txDate = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
        const eDate = new Date(endDate).setHours(23, 59, 59, 999);
        if (txDate > eDate) return false;
      }

      return true;
    } catch (err) {
      console.warn('Error in transaction filtering:', err);
      return false;
    }
  });

  const exportCSV = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = [
      'Transaction ID',
      'User UID',
      'Telegram ID',
      'Full Name',
      'Mobile Number',
      'Type',
      'Amount (INR)',
      'Balance Before',
      'Balance After',
      'Status',
      'Description',
      'Created At',
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.transactionId || tx.id,
      tx.uid,
      `"${tx.telegramId}"`,
      `"${tx.fullName || 'User'}"`,
      `"${tx.mobile}"`,
      `"${tx.type}"`,
      tx.amount,
      tx.balanceBefore,
      tx.balanceAfter,
      tx.status,
      `"${tx.description?.replace(/"/g, '""') || ''}"`,
      tx.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Wallet Passbook & Transaction Ledger</h2>
            <p className="text-xs text-slate-400">
              Complete, immutable auditing history of all registration bonuses, referrals, withdrawal request approvals, and manual credits.
            </p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={filteredTransactions.length === 0}
          className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80 disabled:opacity-50 transition"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Advanced Filtering & Search Toolbar */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Scope selector & Text input */}
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Scope</label>
            <div className="flex items-center gap-2">
              <select
                value={searchField}
                onChange={(e: any) => setSearchField(e.target.value)}
                className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition"
              >
                <option value="all">All Fields</option>
                <option value="uid">User UID</option>
                <option value="mobile">Mobile Number</option>
                <option value="telegramId">Telegram ID</option>
                <option value="transactionId">Transaction ID</option>
              </select>
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter keywords..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter by Type</label>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition appearance-none"
              >
                <option value="all">All Activity Types</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date Ranges */}
        <div className="flex flex-col sm:flex-row items-end gap-4 pt-1 border-t border-slate-800/60">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setFilterType('all');
                setSearchQuery('');
                setSearchField('all');
              }}
              className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 transition text-center"
            >
              Reset Filters
            </button>
            <button
              onClick={() => fetchTransactions()}
              disabled={isLoading}
              className="py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sky-400 hover:text-sky-300 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-800/80">
                <th className="py-3 px-4">Txn ID / Date</th>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Activity Type</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 max-w-xs">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                    <span>Querying Firestore ledger transactions...</span>
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-950/20 text-xs transition duration-150">
                      {/* Txn ID / Date */}
                      <td className="py-4 px-4 font-mono">
                        <div className="font-bold text-slate-200">{tx.transactionId || tx.id}</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                        </div>
                      </td>

                      {/* User Details */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{tx.fullName || 'User'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Phone className="w-3 h-3 text-slate-600" />
                          <span>{tx.mobile || 'No Mobile'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <MessageSquare className="w-3 h-3 text-slate-600" />
                          <span>TG: {tx.telegramId || 'None'}</span>
                        </div>
                      </td>

                      {/* Activity Type */}
                      <td className="py-4 px-4">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                            tx.type?.includes('Bonus')
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : tx.type?.includes('Referral')
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.type?.includes('Feedback')
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : tx.type?.includes('Request')
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : tx.type?.includes('Approved')
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.type?.includes('Rejected')
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : isCredit
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {tx.type || 'Transaction'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right font-bold font-mono">
                        <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                          {isCredit ? '+' : ''}₹{tx.amount}
                        </span>
                      </td>

                      {/* Running Balance */}
                      <td className="py-4 px-4 text-right font-bold font-mono text-slate-300">
                        ₹{tx.balanceAfter ?? '0'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center justify-center gap-1 w-20 mx-auto ${
                            tx.status === 'completed' || tx.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {tx.status === 'completed' || tx.status === 'approved' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <HelpCircle className="w-3 h-3" />
                          )}
                          <span>{tx.status || 'Success'}</span>
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-4 px-4 max-w-xs text-slate-400 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                        {tx.description || tx.reason || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <span>No ledger transactions matched the search filters.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation Bar */}
        <div className="py-4 px-6 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">
            Page <span className="font-bold text-slate-200">{currentPage}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTransactions(false, true)}
              disabled={currentPage === 1 || isLoading}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 transition flex items-center gap-1.5 text-xs font-bold"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => fetchTransactions(true, false)}
              disabled={!hasMore || isLoading}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 transition flex items-center gap-1.5 text-xs font-bold"
            >
              <span>Next</span>
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
