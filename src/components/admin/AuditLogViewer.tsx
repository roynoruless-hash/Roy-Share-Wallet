import React, { useState, useEffect } from 'react';
import { FileText, Search, ShieldAlert, Filter, Lock, RefreshCw } from 'lucide-react';
import { AuditLogEntry } from '../../types';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesCat = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.adminId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'SECURITY':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'EVENT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'USER':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'BACKUP':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-rose-500/30">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Phase XIII Enterprise Audit Compliance</span>
          </div>
          <h2 className="text-xl font-black text-white">Immutable Audit Log Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-proof real-time ledger of all admin actions, security locks, withdrawals, and system changes.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-lg shadow-rose-500/20 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Filter & Search Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action, details, admin..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          {['ALL', 'SECURITY', 'EVENT', 'USER', 'BACKUP', 'SYSTEM'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-rose-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Recorded Action History ({filteredLogs.length})</span>
          </h3>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            ● Append-Only Ledger
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading immutable logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No audit records found matching criteria.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadge(log.category)}`}>
                      {log.category}
                    </span>
                    <span className="font-mono font-bold text-white">{log.action}</span>
                  </div>
                  <p className="text-slate-400 text-xs font-mono">{log.details}</p>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
                  <div className="text-right">
                    <p className="text-slate-300 font-semibold">{log.adminId}</p>
                    <p className="font-mono text-[10px] text-slate-500">{log.ip}</p>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-3">
                    <p className="text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</p>
                    <p className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
