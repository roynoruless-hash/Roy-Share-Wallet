import React, { useState, useEffect } from 'react';
import { Zap, Plus, Trash2, CheckCircle2, AlertCircle, Play, Gift, Award, DollarSign } from 'lucide-react';
import { AutoRewardRule } from '../../types';

export const AutoRewardEngineView: React.FC = () => {
  const [rules, setRules] = useState<AutoRewardRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState<string>('First Claim Reward Rule');
  const [triggerEvent, setTriggerEvent] = useState<string>('First Claim');
  const [rewardAmount, setRewardAmount] = useState<number>(10);
  const [conditions, setConditions] = useState<string>('Credit ₹10 on user first successful code claim');

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auto-reward/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to fetch auto reward rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/auto-reward/rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, triggerEvent, rewardAmount, conditions }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Auto reward rule created and activated!' });
        setShowModal(false);
        fetchRules();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save rule' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/auto-reward/rules/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Rule state updated.' });
        fetchRules();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch('/api/admin/auto-reward/rules/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Rule deleted.' });
        fetchRules();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" />
            <span>Phase XIV Automated Wallet Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">Auto Reward Rules Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Set trigger-based rules (First Claim, Golden Drop, Top Typist) that automatically credit user wallets.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create Reward Rule</span>
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

      {/* Rules List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-400" />
          <span>Active & Configured Rules ({rules.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading reward rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No active reward rules. Click "Create Reward Rule" above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <h4 className="font-bold text-sm text-white">{rule.name}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {rule.triggerEvent}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Reward Payout</p>
                  <p className="text-base font-black text-emerald-400">₹{rule.rewardAmount}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{rule.conditions}</p>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Total Paid Out:</span>
                  <span className="font-bold text-white font-mono">₹{rule.totalPaidOut || 0}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.isActive)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      rule.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Create Auto Reward Rule</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. First Claim Bonus"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Trigger Event</label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="First Claim">First Claim (₹10)</option>
                    <option value="Golden Claim">Golden Claim (₹100)</option>
                    <option value="Top Typist">Top Typist (₹20)</option>
                    <option value="Referral Multiplier">Referral Multiplier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Reward Payout (₹)</label>
                  <input
                    type="number"
                    required
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Rule Conditions & Notes</label>
                <textarea
                  required
                  rows={3}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Describe when this rule applies..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Save & Activate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
