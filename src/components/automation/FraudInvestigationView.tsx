import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserX, CheckCircle, AlertTriangle, Search, Filter, RefreshCw, Cpu, ExternalLink, ShieldCheck } from 'lucide-react';
import { FraudReport } from '../../types';

export const FraudInvestigationView: React.FC = () => {
  const [reports, setReports] = useState<FraudReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<FraudReport | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFraudReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fraud/investigate');
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        if (data.reports && data.reports.length > 0 && !selectedUser) {
          setSelectedUser(data.reports[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch fraud reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFraudReports();
  }, []);

  const handleAction = async (userId: string, action: 'ban' | 'safe' | 'review') => {
    try {
      const res = await fetch('/api/admin/fraud/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Action '${action.toUpperCase()}' applied to user #${userId}` });
        fetchFraudReports();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update fraud status' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesLevel = filterLevel === 'ALL' || r.riskLevel === filterLevel;
    const matchesSearch =
      r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fingerprint.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'Safe':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Ban Recommended':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>Phase XIV AI Fraud Radar</span>
          </div>
          <h2 className="text-xl font-black text-white">AI Fraud Investigation Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated deep analysis of Device Fingerprints, Duplicate Accounts, VPN Risk & Typing Speed Patterns.
          </p>
        </div>

        <button
          onClick={fetchFraudReports}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-lg shadow-rose-500/20 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-run AI Analysis</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search username, user ID, fingerprint..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          {['ALL', 'Ban Recommended', 'Review', 'Safe'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                filterLevel === lvl
                  ? 'bg-rose-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {lvl === 'ALL' ? 'All Alerts' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: User List & Detailed AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Suspicious Users List */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 max-h-[580px] overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Suspicious Accounts ({filteredReports.length})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Running AI Fraud Scan...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No suspicious user reports match filters.</div>
          ) : (
            filteredReports.map((item) => (
              <div
                key={item.userId}
                onClick={() => setSelectedUser(item)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  selectedUser?.userId === item.userId
                    ? 'bg-slate-800/80 border-rose-500/60 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{item.username}</span>
                    <span className="text-[10px] text-slate-500 font-mono">#{item.userId}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{item.reason}</p>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border block ${getBadgeStyle(item.riskLevel)}`}>
                    {item.riskLevel === 'Safe' ? '✅ Safe' : item.riskLevel === 'Review' ? '⚠ Review' : '🚫 Ban'}
                  </span>
                  <p className="text-[10px] font-mono font-bold text-rose-400">Score: {item.riskScore}/100</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: AI Deep Investigation Report */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5">
          {selectedUser ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${getBadgeStyle(selectedUser.riskLevel)}`}>
                      {selectedUser.riskLevel === 'Safe' ? '✅ Safe' : selectedUser.riskLevel === 'Review' ? '⚠ Review Required' : '🚫 Ban Recommended'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">Risk Score: <strong className="text-rose-400 font-black">{selectedUser.riskScore} / 100</strong></span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    AI Investigation Report: <span className="text-rose-400">{selectedUser.username}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">User ID: {selectedUser.userId} • Analyzed at {new Date(selectedUser.createdAt).toLocaleTimeString()}</p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(selectedUser.userId, 'safe')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Mark Safe</span>
                  </button>
                  <button
                    onClick={() => handleAction(selectedUser.userId, 'ban')}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-rose-500/20 transition"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Ban User</span>
                  </button>
                </div>
              </div>

              {/* AI Analysis Summary Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/20 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
                  <Cpu className="w-4 h-4" />
                  <span>AI Risk Diagnosis</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {selectedUser.reason}
                </p>
              </div>

              {/* Analyzed Risk Signals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Device Fingerprint</p>
                  <p className="font-mono text-xs font-bold text-slate-300 truncate">{selectedUser.fingerprint}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Duplicate Accounts</p>
                  <p className={`font-bold ${selectedUser.duplicateAccountsCount > 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedUser.duplicateAccountsCount} Linked Accounts
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">VPN / Proxy Risk</p>
                  <p className={`font-bold ${selectedUser.vpnDetected ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedUser.vpnDetected ? '⚠ VPN / Proxy Active' : '✓ Clean Connection'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Typing Speed (WPM)</p>
                  <p className={`font-bold ${selectedUser.avgTypingWpm > 130 ? 'text-rose-400' : 'text-sky-400'}`}>
                    {selectedUser.avgTypingWpm} WPM {selectedUser.avgTypingWpm > 130 ? '(Bot Speed)' : ''}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Claim History</p>
                  <p className="font-bold text-amber-400">{selectedUser.totalClaims} Claims</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Referral & Vote Activity</p>
                  <p className="font-bold text-purple-400">{selectedUser.referralsCount} Ref / {selectedUser.voteCount} Votes</p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500">
              Select a suspicious user on the left to view detailed AI Investigation Report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
