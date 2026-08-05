import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Sliders, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { FeatureFlags } from '../../types';

export const FeatureFlagsManager: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlags>({
    redeem: true,
    giveaway: true,
    vote: true,
    flashMode: true,
    aiAssistant: true,
    referrals: true,
    withdrawals: true,
    spectatorMode: true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feature-flags');
      const data = await res.json();
      if (data.success && data.flags) {
        setFlags(data.flags);
      }
    } catch (err) {
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggleFlag = async (flagName: string, currentValue: boolean) => {
    const newValue = !currentValue;
    setFlags((prev) => ({ ...prev, [flagName]: newValue }));

    try {
      const res = await fetch('/api/admin/feature-flags/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagName, enabled: newValue }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Module '${flagName}' set to ${newValue ? 'ENABLED' : 'DISABLED'}` });
      } else {
        // Revert on error
        setFlags((prev) => ({ ...prev, [flagName]: currentValue }));
        setStatusMsg({ type: 'error', text: data.error || 'Failed to toggle flag' });
      }
    } catch (err: any) {
      setFlags((prev) => ({ ...prev, [flagName]: currentValue }));
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const modules = [
    { key: 'redeem', name: 'Live Redeem Drop System', desc: 'Controls user speed typing redeem drops & claims' },
    { key: 'giveaway', name: 'Giveaway War Engine', desc: 'Controls squad battle registrations & team points' },
    { key: 'vote', name: 'Voting Contests Suite', desc: 'Controls user voting and contestant submissions' },
    { key: 'flashMode', name: 'Flash Speed Mode', desc: 'Ultra-fast 15-second drop mode' },
    { key: 'aiAssistant', name: 'AI Event Assistant', desc: 'Gemini AI copywriting & broadcast suggestions' },
    { key: 'referrals', name: 'Referral & Milestones Engine', desc: 'Controls referral link generation & bonuses' },
    { key: 'withdrawals', name: 'Wallet Withdrawals', desc: 'Controls UPI, QR, and Redeem Code payouts' },
    { key: 'spectatorMode', name: 'Live Spectator Stream', desc: 'Real-time live typing spectator radar view' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" />
            <span>Phase XIII Dynamic Deployment</span>
          </div>
          <h2 className="text-xl font-black text-white">Zero-Downtime Feature Flags</h2>
          <p className="text-xs text-slate-400 mt-1">
            Instantly toggle application modules on or off without redeploying code.
          </p>
        </div>

        <button
          onClick={fetchFlags}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Flags</span>
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
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Grid of Flags */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading feature flags...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod) => {
            const isEnabled = Boolean(flags[mod.key]);
            return (
              <div
                key={mod.key}
                className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                  isEnabled
                    ? 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40'
                    : 'bg-slate-950/60 border-slate-900 opacity-75'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                    <h3 className="font-bold text-sm text-white">{mod.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400">{mod.desc}</p>
                </div>

                <button
                  onClick={() => handleToggleFlag(mod.key, isEnabled)}
                  className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                    isEnabled
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  {isEnabled ? (
                    <>
                      <ToggleRight className="w-6 h-6 text-cyan-400" />
                      <span className="text-xs font-bold uppercase">ON</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-6 h-6 text-slate-500" />
                      <span className="text-xs font-bold uppercase text-slate-500">OFF</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
