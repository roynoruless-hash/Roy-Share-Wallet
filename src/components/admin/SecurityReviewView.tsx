import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  User,
  Smartphone,
  Mail,
  Fingerprint,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SecurityReview {
  id: string;
  telegramId: string;
  fullName: string;
  username?: string;
  mobile: string;
  gmail: string;
  deviceFingerprint: string;
  riskScore: number;
  reason: string;
  ip?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  rejectReason?: string;
}

interface SecurityReviewViewProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

function getAdminSessionToken(): string {
  try {
    const direct = localStorage.getItem('adminSessionToken');
    if (direct && direct.trim()) return direct.trim();
    const raw = localStorage.getItem('roy_admin_auth_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.sessionToken) return parsed.sessionToken.trim();
    }
  } catch (e) {}
  return '';
}

export const SecurityReviewView: React.FC<SecurityReviewViewProps> = ({ showToast }) => {
  const [reviews, setReviews] = useState<SecurityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    setAuthError(false);
    setAuthErrorMessage('');
    try {
      const sessionToken = getAdminSessionToken();
      if (!sessionToken) {
        setAuthError(true);
        setAuthErrorMessage('Admin session token missing. Please log in again.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/security-reviews', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': sessionToken,
          'Authorization': `Bearer ${sessionToken}`,
        }
      });

      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setAuthError(true);
        setAuthErrorMessage(data.error || 'Unauthorized: Admin session token missing or expired. Please log in again.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || []);
      } else if (data.error && (data.error.toLowerCase().includes('unauthorized') || data.error.toLowerCase().includes('session'))) {
        setAuthError(true);
        setAuthErrorMessage(data.error);
      } else {
        showToast(data.error || 'Failed to fetch security reviews', 'error');
      }
    } catch (err: any) {
      showToast('Network error fetching security reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleApprove = async (review: SecurityReview) => {
    if (!confirm(`Are you sure you want to approve registration for ${review.fullName} (${review.telegramId})?`)) {
      return;
    }

    setProcessingId(review.id);
    try {
      const sessionToken = getAdminSessionToken();
      const res = await fetch('/api/admin/security-reviews/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': sessionToken,
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ reviewId: review.id }),
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        setAuthErrorMessage('Session expired while performing approval. Please log in again.');
        return;
      }

      const data = await res.json();
      if (data.success) {
        showToast(`✅ Registration approved! User account created with UID ${data.uid} and ₹${data.bonus} bonus.`, 'success');
        fetchReviews();
      } else {
        showToast(data.error || 'Failed to approve registration', 'error');
      }
    } catch (err) {
      showToast('Error approving registration request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (review: SecurityReview) => {
    setSelectedReview(review);
    setRejectReasonInput('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedReview) return;
    const reason = rejectReasonInput.trim() || 'Failed security verification checks';

    setProcessingId(selectedReview.id);
    try {
      const sessionToken = getAdminSessionToken();
      const res = await fetch('/api/admin/security-reviews/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': sessionToken,
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ reviewId: selectedReview.id, reason }),
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        setAuthErrorMessage('Session expired while rejecting. Please log in again.');
        return;
      }

      const data = await res.json();
      if (data.success) {
        showToast('❌ Registration request rejected.', 'info');
        setRejectModalOpen(false);
        setSelectedReview(null);
        fetchReviews();
      } else {
        showToast(data.error || 'Failed to reject registration', 'error');
      }
    } catch (err) {
      showToast('Error rejecting registration request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      r.telegramId.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      (r.username && r.username.toLowerCase().includes(q)) ||
      r.mobile.includes(q) ||
      r.gmail.toLowerCase().includes(q) ||
      (r.deviceFingerprint && r.deviceFingerprint.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  const pendingCount = reviews.filter((r) => r.status === 'PENDING').length;

  if (authError) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
          <ShieldAlert className="w-8 h-8 animate-bounce" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            🔐 Admin Session Required
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {authErrorMessage || 'Your admin session could not be verified. Please log in again.'}
          </p>
        </div>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('admin-session-expired'));
          }}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
        >
          Login Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Security Review Queue
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                    {pendingCount} Pending
                  </span>
                )}
              </h1>
              <p className="text-slate-400 text-sm">
                Review and approve or reject flagged signup attempts before account creation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchReviews}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search ID, Name, Mobile, Gmail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                statusFilter === st
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Review Queue Cards / Table */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
          <p>Loading security review queue...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <ShieldCheck className="w-12 h-12 mx-auto text-emerald-400/60" />
          <p className="text-base font-semibold text-slate-200">No Security Reviews Found</p>
          <p className="text-sm text-slate-500">
            {searchTerm || statusFilter !== 'ALL'
              ? 'No records match your search or filter criteria.'
              : 'All user registrations are clear and verified.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg transition-all ${
                rev.status === 'PENDING'
                  ? 'border-amber-500/30 bg-amber-500/[0.02]'
                  : rev.status === 'APPROVED'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.01]'
                  : 'border-red-500/20 bg-red-500/[0.01]'
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400">
                    {rev.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {rev.fullName}
                      {rev.username && <span className="text-xs font-normal text-slate-400">@{rev.username.replace('@', '')}</span>}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-cyan-400">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        ID: {rev.telegramId}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
                    <span className="text-slate-400">Risk Score:</span>
                    <span
                      className={`font-bold ${
                        rev.riskScore >= 75
                          ? 'text-red-400'
                          : rev.riskScore >= 50
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {rev.riskScore}/100
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                      rev.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : rev.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {rev.status}
                  </span>
                </div>
              </div>

              {/* Detail Badges Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 py-4 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    Mobile Number
                  </p>
                  <p className="font-mono text-slate-200 font-semibold">{rev.mobile || 'N/A'}</p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Gmail Address
                  </p>
                  <p className="font-mono text-slate-200 font-semibold truncate">{rev.gmail || 'N/A'}</p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                    <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                    Device Fingerprint
                  </p>
                  <p className="font-mono text-slate-300 truncate" title={rev.deviceFingerprint}>
                    {rev.deviceFingerprint || 'Unknown'}
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Trigger Reason
                  </p>
                  <p className="text-amber-300 font-semibold truncate" title={rev.reason}>
                    {rev.reason}
                  </p>
                </div>
              </div>

              {rev.status === 'REJECTED' && rev.rejectReason && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 mb-4">
                  <span className="font-semibold">Rejection Reason:</span> {rev.rejectReason}
                </div>
              )}

              {/* Action Buttons for Pending Reviews */}
              {rev.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleOpenRejectModal(rev)}
                    disabled={processingId === rev.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Registration
                  </button>

                  <button
                    onClick={() => handleApprove(rev)}
                    disabled={processingId === rev.id}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {processingId === rev.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve Registration
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && selectedReview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Reject Registration Request
            </h3>
            <p className="text-xs text-slate-400">
              User: <span className="text-white font-semibold">{selectedReview.fullName}</span> (ID: {selectedReview.telegramId})
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="e.g. Duplicate account detected, failed mobile identity match..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processingId === selectedReview.id}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {processingId === selectedReview.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
