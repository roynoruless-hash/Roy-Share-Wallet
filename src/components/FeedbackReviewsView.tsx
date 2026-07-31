import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { FeedbackReview, FeedbackCampaign } from '../types';
import {
  Check,
  X,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  Star,
  MessageSquare,
  User,
  Phone,
  Tag,
  AlertCircle,
  Eye,
  CornerDownRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileImage,
  RefreshCw,
} from 'lucide-react';

interface FeedbackReviewsViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export const FeedbackReviewsView: React.FC<FeedbackReviewsViewProps> = ({
  config,
  showToast,
}) => {
  const [reviews, setReviews] = useState<FeedbackReview[]>([]);
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [selectedReview, setSelectedReview] = useState<FeedbackReview | null>(null);
  const [approveDialog, setApproveDialog] = useState<FeedbackReview | null>(null);
  const [rejectDialog, setRejectDialog] = useState<FeedbackReview | null>(null);
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

  // Approval/Rejection Input State
  const [approveAmount, setApproveAmount] = useState('10');
  const [approveReason, setApproveReason] = useState('Valuable feedback. Reward credited!');
  const [rejectReason, setRejectReason] = useState('Your feedback did not meet our quality guidelines.');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch reviews and campaigns
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Campaigns
      const campSnap = await getDocs(query(collection(db, 'feedbackCampaigns'), orderBy('createdAt', 'desc')));
      const campList: FeedbackCampaign[] = [];
      campSnap.forEach((doc) => {
        campList.push({ id: doc.id, ...doc.data() } as FeedbackCampaign);
      });
      setCampaigns(campList);

      // Fetch Reviews
      const revSnap = await getDocs(query(collection(db, 'feedbackReviews'), orderBy('submittedAt', 'desc')));
      const revList: FeedbackReview[] = [];
      revSnap.forEach((doc) => {
        revList.push({ id: doc.id, ...doc.data() } as FeedbackReview);
      });
      setReviews(revList);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      showToast('Error loading reviews from Firestore.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync default amount when opening approve modal
  useEffect(() => {
    if (approveDialog) {
      setApproveAmount(String(approveDialog.rewardAmount || 10));
      setApproveReason('Valuable feedback. Reward credited!');
    }
  }, [approveDialog]);

  // Statistics
  const stats = {
    total: reviews.length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
    paid: reviews
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + (Number(r.rewardAmount) || 0), 0),
  };

  // Filter & Search Logic
  const filteredReviews = reviews.filter((review) => {
    const matchesSearch =
      review.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.mobile.includes(searchTerm) ||
      (review.telegramUsername || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (review.message || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || review.status === statusFilter;
    const matchesCampaign = campaignFilter === 'all' || review.campaignId === campaignFilter;
    const matchesCategory = categoryFilter === 'all' || review.category === categoryFilter;
    const matchesRating = ratingFilter === 'all' || String(review.rating) === ratingFilter;

    return matchesSearch && matchesStatus && matchesCampaign && matchesCategory && matchesRating;
  });

  // Pagination bounds
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage) || 1;
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle Approve API Call
  const handleApprove = async () => {
    if (!approveDialog) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/feedback/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          reviewId: approveDialog.id,
          customAmount: Number(approveAmount) || 0,
          reason: approveReason.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast(data.message || 'Feedback approved successfully!', 'success');
        setApproveDialog(null);
        fetchData();
      } else {
        showToast(data.error || 'Failed to approve feedback.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred during approval.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reject API Call
  const handleReject = async () => {
    if (!rejectDialog) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/feedback/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.botToken,
          reviewId: rejectDialog.id,
          reason: rejectReason.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        showToast(data.message || 'Feedback rejected successfully.', 'success');
        setRejectDialog(null);
        fetchData();
      } else {
        showToast(data.error || 'Failed to reject feedback.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred during rejection.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export filtered list to CSV
  const handleExportCSV = () => {
    if (filteredReviews.length === 0) {
      showToast('No records found to export.', 'error');
      return;
    }

    const headers = [
      'Submitted At',
      'Campaign Name',
      'User UID',
      'User Name',
      'Mobile',
      'Telegram ID',
      'Telegram Username',
      'Rating',
      'Category',
      'Title',
      'Message',
      'Status',
      'Reward (₹)',
      'Reason',
    ];

    const rows = filteredReviews.map((r) => [
      new Date(r.submittedAt).toLocaleString(),
      r.campaignName,
      r.uid,
      r.name,
      r.mobile,
      r.telegramId,
      r.telegramUsername || '',
      r.rating,
      r.category,
      r.title.replace(/"/g, '""'),
      (r.message || '').replace(/"/g, '""'),
      r.status,
      r.rewardAmount,
      (r.status === 'approved' ? r.approveReason : r.rejectReason) || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `feedback_reviews_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV of reviews successfully.', 'success');
  };

  return (
    <div className="space-y-6" id="feedback-reviews-module">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Feedback */}
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total</span>
            <MessageSquare className="w-5 h-5 text-sky-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{stats.total}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">feedback surveys</p>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">{stats.pending}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">awaiting review</p>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Approved</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">{stats.approved}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">rewarded surveys</p>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Rejected</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">{stats.rejected}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">rejected surveys</p>
          </div>
        </div>

        {/* Paid Reward Amount */}
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Paid Out</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">₹{stats.paid}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">credited instantly</p>
          </div>
        </div>
      </div>

      {/* Control Filters Area */}
      <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl space-y-4">
        {/* Search row and export */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search UID, Name, Mobile, Message..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              title="Refresh reviews"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-850 hover:bg-emerald-500/10 text-xs sm:text-sm font-semibold text-slate-300 hover:text-emerald-400 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/50">
          {/* Campaign Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campaign</label>
            <select
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">🟡 Pending</option>
              <option value="approved">🟢 Approved</option>
              <option value="rejected">🔴 Rejected</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="wallet">Wallet Balance</option>
              <option value="referral">Referral System</option>
              <option value="withdraw">Withdrawal Settings</option>
              <option value="ui">User Interface</option>
              <option value="speed">Performance / Speed</option>
              <option value="support">Support Helpdesk</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rating</label>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ (5)</option>
              <option value="4">⭐⭐⭐⭐ (4)</option>
              <option value="3">⭐⭐⭐ (3)</option>
              <option value="2">⭐⭐ (2)</option>
              <option value="1">⭐ (1)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Review Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-xs">Fetching submissions...</span>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-450 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-300">No Feedback Reviews Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find any feedback submissions matching the selected filters.
            </p>
          </div>
        ) : (
          <>
            {paginatedReviews.map((rev) => (
              <div
                key={rev.id}
                className={`bg-slate-900 border ${
                  rev.status === 'pending'
                    ? 'border-amber-500/20 bg-gradient-to-br from-slate-900 to-amber-950/5'
                    : rev.status === 'approved'
                    ? 'border-slate-800/80 hover:border-emerald-500/20'
                    : 'border-slate-800/80 hover:border-rose-500/20'
                } p-5 rounded-2xl shadow-sm transition duration-200`}
              >
                {/* Header: User details + Campaign */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm sm:text-base">{rev.name}</span>
                      <span className="text-xs font-mono text-slate-500 select-all font-semibold">({rev.mobile})</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                        UID: {rev.uid}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-450 flex items-center gap-2">
                      <span className="text-sky-400 font-semibold select-all font-mono">Telegram: @{rev.telegramUsername || rev.telegramId}</span>
                      <span className="text-slate-600">•</span>
                      <span>Submitted {new Date(rev.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-450 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-bold">
                      🏆 {rev.campaignName}
                    </span>
                    {rev.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        🟡 Pending Review
                      </span>
                    ) : rev.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🟢 Approved (₹{rev.rewardAmount})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        🔴 Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating + Category + Title + Message Content */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="col-span-1 md:col-span-3 space-y-3">
                    <div className="flex items-center gap-4">
                      {/* Star rating */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Category */}
                      <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                        🏷️ {rev.category}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-100">{rev.title}</h4>
                    {rev.message ? (
                      <p className="text-xs sm:text-sm text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 select-text leading-relaxed">
                        {rev.message}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No detailed description was submitted.</p>
                    )}

                    {/* Reasons if resolved */}
                    {rev.status === 'approved' && rev.approveReason && (
                      <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex gap-2 text-xs text-emerald-400">
                        <CornerDownRight className="w-4 h-4 shrink-0 text-emerald-500" />
                        <div>
                          <span className="font-bold">Reward Reason:</span> {rev.approveReason}
                        </div>
                      </div>
                    )}
                    {rev.status === 'rejected' && rev.rejectReason && (
                      <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 flex gap-2 text-xs text-rose-400">
                        <CornerDownRight className="w-4 h-4 shrink-0 text-rose-500" />
                        <div>
                          <span className="font-bold">Rejection Reason:</span> {rev.rejectReason}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Screenshot Thumbnail / Actions */}
                  <div className="col-span-1 border-t md:border-t-0 md:border-l border-slate-800/60 pt-4 md:pt-0 md:pl-6 flex flex-col justify-between gap-4">
                    {/* Thumbnail if screenshot exists */}
                    {rev.screenshotUrl ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Attachment Screenshot
                        </span>
                        <div
                          onClick={() => setScreenshotModal(rev.screenshotUrl!)}
                          className="relative h-24 rounded-xl border border-slate-800 overflow-hidden group cursor-pointer bg-slate-950"
                        >
                          <img
                            src={rev.screenshotUrl}
                            alt="Screenshot"
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
                        <FileImage className="w-3.5 h-3.5" />
                        <span>No screenshot uploaded</span>
                      </div>
                    )}

                    {/* Resolution Actions for Pending Status */}
                    {rev.status === 'pending' && (
                      <div className="flex gap-2 w-full pt-2">
                        <button
                          onClick={() => setRejectDialog(rev)}
                          className="flex-1 py-2 px-3 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => setApproveDialog(rev)}
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800/80 rounded-2xl">
              <span className="text-xs text-slate-400">
                Showing Page <b className="text-white">{currentPage}</b> of{' '}
                <b className="text-white">{totalPages}</b> ({filteredReviews.length} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* APPROVAL POPUP DIALOG */}
      {approveDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-500">🎉</span> Approve Feedback Review
              </h3>
              <button
                onClick={() => setApproveDialog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Reward Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={approveAmount}
                  onChange={(e) => setApproveAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500 text-emerald-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">Default is campaign bonus: ₹{approveDialog.rewardAmount}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Reason for Credit / Note
                </label>
                <textarea
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
              <button
                onClick={() => setApproveDialog(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white disabled:opacity-50 transition"
              >
                {isProcessing ? 'Processing...' : 'Approve & Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION POPUP DIALOG */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span className="text-rose-500">❌</span> Reject Feedback Review
              </h3>
              <button
                onClick={() => setRejectDialog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Rejection Reason (will be sent to user)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Why is this feedback rejected?"
                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-rose-500 text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
              <button
                onClick={() => setRejectDialog(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white disabled:opacity-50 transition"
              >
                {isProcessing ? 'Processing...' : 'Reject Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREENSHOT EXPANSION MODAL */}
      {screenshotModal && (
        <div
          onClick={() => setScreenshotModal(null)}
          className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-4xl max-h-[85vh] relative animate-scaleIn">
            <img
              src={screenshotModal}
              alt="Screenshot Preview"
              className="max-w-full max-h-[80vh] rounded-2xl border border-slate-800 object-contain shadow-2xl"
            />
            <button
              onClick={() => setScreenshotModal(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs sm:text-sm"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
