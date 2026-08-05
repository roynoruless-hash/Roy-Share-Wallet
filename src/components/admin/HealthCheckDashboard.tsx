import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, Server, Database, Bot, Wallet, Cpu } from 'lucide-react';
import { HealthCheckResult } from '../../types';

export const HealthCheckDashboard: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const runHealthDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/health-check');
      const data = await res.json();
      if (data.success && data.health) {
        setHealth(data.health);
      }
    } catch (err) {
      console.error('Failed to run health check:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthDiagnostics();
  }, []);

  const getServiceIcon = (name: string) => {
    if (name.includes('Bot')) return <Bot className="w-5 h-5 text-sky-400" />;
    if (name.includes('Database') || name.includes('Firestore')) return <Database className="w-5 h-5 text-emerald-400" />;
    if (name.includes('Wallet')) return <Wallet className="w-5 h-5 text-amber-400" />;
    if (name.includes('Gemini') || name.includes('AI')) return <Cpu className="w-5 h-5 text-purple-400" />;
    return <Server className="w-5 h-5 text-cyan-400" />;
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'HEALTHY':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'DEGRADED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>Phase XIII System Reliability</span>
          </div>
          <h2 className="text-xl font-black text-white">Daily & Live Health Check Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated health verification across Telegram Bot, Firestore, Wallet Engine, APIs & Background Jobs.
          </p>
        </div>

        <button
          onClick={runHealthDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Testing...' : 'Run Live Diagnostic'}</span>
        </button>
      </div>

      {/* Overall Health Card */}
      {health && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl border ${
                health.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {health.overallStatus === 'HEALTHY' ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall System Health</p>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>{health.overallStatus}</span>
                <span className="text-xs font-normal text-slate-500">({health.latencyMs} ms latency)</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Auto-Alert Monitoring Active</span>
          </div>
        </div>
      )}

      {/* Service Verification Cards */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Core Infrastructure Services</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Verifying system components...</div>
        ) : health?.services ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.services.map((svc) => (
              <div
                key={svc.name}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    {getServiceIcon(svc.name)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{svc.name}</h4>
                    <p className="text-[10px] text-slate-500">Last Checked: {new Date(svc.lastChecked).toLocaleTimeString()}</p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(svc.status)}`}>
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">No diagnostic results available.</div>
        )}
      </div>
    </div>
  );
};
