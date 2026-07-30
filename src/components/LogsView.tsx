import React, { useState, useEffect } from 'react';
import { FileText, UserPlus, ArrowDownRight, Share2, AlertOctagon, Activity, Search, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { LogEntry, LogType } from '../types';
import { fetchSystemLogs, logSystemEvent } from '../services/configService';

interface LogsViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ showToast }) => {
  const [activeLogTab, setActiveLogTab] = useState<LogType | 'all'>('all');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const logCategories = [
    { id: 'all', label: 'All System Logs', icon: FileText },
    { id: 'registration' as LogType, label: 'Registration Logs', icon: UserPlus },
    { id: 'withdrawal' as LogType, label: 'Withdrawal Logs', icon: ArrowDownRight },
    { id: 'referral' as LogType, label: 'Referral Logs', icon: Share2 },
    { id: 'error' as LogType, label: 'Error Logs', icon: AlertOctagon },
    { id: 'activity' as LogType, label: 'Activity Logs', icon: Activity },
  ];

  const loadLogs = async () => {
    setIsLoading(true);
    const filter = activeLogTab === 'all' ? undefined : activeLogTab;
    const data = await fetchSystemLogs(filter);
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [activeLogTab]);

  const handleSimulateLog = async (type: LogType) => {
    const messages: Record<LogType, string> = {
      registration: 'New user registered via Telegram Bot ID #109283.',
      withdrawal: 'Withdrawal request created for ₹250 (UPI: test@upi).',
      referral: 'Referral bonus of ₹5 awarded to user #109283.',
      error: 'Telegram API rate limit reached during channel member check.',
      activity: 'Admin updated wallet configuration in Firestore settings/config.',
    };

    await logSystemEvent(type, messages[type], { simulated: true });
    showToast(`Test ${type} log appended!`, 'info');
    loadLogs();
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return log.message.toLowerCase().includes(q) || log.type.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System Audit & Event Logs</h2>
            <p className="text-xs text-slate-400">
              Audit log sections for Registration, Withdrawal, Referral, Error, and Activity records.
            </p>
          </div>
        </div>
      </div>

      {/* Categories Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800/80 overflow-x-auto">
          {logCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeLogTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveLogTab(cat.id as LogType | 'all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter logs..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table / Empty State Container */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl min-h-[300px]">
        {filteredLogs.length > 0 ? (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.type === 'error'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : log.type === 'registration'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : log.type === 'withdrawal'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : log.type === 'referral'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {log.type}
                  </span>
                  <div>
                    <p className="text-slate-200 font-medium">{log.message}</p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Empty Logs Placeholder State */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-300">
                No {activeLogTab === 'all' ? '' : activeLogTab} logs recorded yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Log entries will populate here automatically as users interact with future Bot modules.
              </p>
            </div>

            {/* Test Log Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleSimulateLog('registration')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
              >
                + Test Registration Log
              </button>
              <button
                onClick={() => handleSimulateLog('withdrawal')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
              >
                + Test Withdrawal Log
              </button>
              <button
                onClick={() => handleSimulateLog('referral')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
              >
                + Test Referral Log
              </button>
              <button
                onClick={() => handleSimulateLog('error')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold border border-rose-900/50 transition"
              >
                + Test Error Log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
