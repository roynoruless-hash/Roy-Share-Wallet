import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, Zap, Server, Activity, Wrench } from 'lucide-react';
import { IncidentAlert } from '../../types';

export const IncidentCenterView: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/incidents/active');
      const data = await res.json();
      if (data.success) {
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error('Failed to fetch incident alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000); // 10s auto refresh for real-time alerts
    return () => clearInterval(interval);
  }, []);

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch('/api/admin/incidents/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Incident #${id} resolved!` });
        fetchIncidents();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const activeIncidents = incidents.filter((i) => !i.isResolved);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/50 to-slate-900 border border-rose-500/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            <span>Phase XIV Real-Time Infrastructure Defense</span>
          </div>
          <h2 className="text-xl font-black text-white">Real-Time Incident & Alert Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitors Telegram API, Firestore, High Fraud Spikes, Queue Overflow & Payment Failures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${activeIncidents.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
            <span className="font-bold text-white">
              {activeIncidents.length === 0 ? 'System All Clear' : `${activeIncidents.length} Active Alerts`}
            </span>
          </div>

          <button
            onClick={fetchIncidents}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Incident Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {[
          { name: 'High Fraud', type: 'High Fraud', icon: ShieldAlert },
          { name: 'Telegram API', type: 'Telegram API Failure', icon: Zap },
          { name: 'Firestore DB', type: 'Firestore Failure', icon: Server },
          { name: 'Queue Overflow', type: 'Queue Overflow', icon: Activity },
          { name: 'Payment Failures', type: 'Payment Failure', icon: AlertTriangle },
          { name: 'High Error Rate', type: 'High Error Rate', icon: Wrench },
        ].map((cat) => {
          const catAlerts = incidents.filter((i) => i.type === cat.type && !i.isResolved);
          return (
            <div key={cat.type} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <cat.icon className="w-4 h-4 text-slate-400" />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${catAlerts.length > 0 ? 'bg-rose-500 text-slate-950' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {catAlerts.length > 0 ? `${catAlerts.length} Alert` : '✓ Healthy'}
                </span>
              </div>
              <p className="font-bold text-slate-200">{cat.name}</p>
            </div>
          );
        })}
      </div>

      {/* Active Alerts List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Active Incident Feed ({incidents.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Scanning incident telemetry...</div>
        ) : incidents.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-400 border border-emerald-500/30 rounded-xl bg-emerald-500/5">
            ✓ No incidents detected. All system operations, database queries, and Telegram API connections are running smoothly!
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                  inc.isResolved
                    ? 'bg-slate-950/60 border-slate-800 opacity-60'
                    : 'bg-slate-950 border-rose-500/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${getSeverityStyle(inc.severity)}`}>
                      {inc.severity}
                    </span>
                    <span className="font-bold text-white text-sm">{inc.type}</span>
                    <span className="text-[10px] text-slate-500 font-mono">#{inc.id}</span>
                  </div>

                  <p className="text-slate-300 font-medium">{inc.message}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Timestamp: {new Date(inc.timestamp).toLocaleString()}</p>
                </div>

                {!inc.isResolved ? (
                  <button
                    onClick={() => handleResolveIncident(inc.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 shrink-0 transition"
                  >
                    Resolve Alert
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold">
                    ✓ RESOLVED
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
