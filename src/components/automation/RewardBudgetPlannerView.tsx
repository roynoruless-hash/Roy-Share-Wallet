import React, { useState } from 'react';
import { Calculator, Sparkles, CheckCircle2, AlertCircle, ArrowRight, DollarSign, Award, Layers } from 'lucide-react';
import { BudgetPlan } from '../../types';

export const RewardBudgetPlannerView: React.FC = () => {
  const [budget, setBudget] = useState<number>(1000);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/budget-planner/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to generate budget plan' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBudgetPlan = async () => {
    if (!plan) return;
    try {
      const res = await fetch('/api/admin/budget-planner/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Budget ₹${plan.totalBudget} applied! Golden codes and scheduled drop created.` });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to apply budget plan' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4" />
            <span>Phase XIV AI Budget Allocation Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">AI Reward Budget Planner</h2>
          <p className="text-xs text-slate-400 mt-1">
            Input your total event budget (e.g. ₹1000). AI optimizes Prize Pool, Golden Codes & Winner Distribution for maximum ROI.
          </p>
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
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Input Form & Plan Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span>Enter Target Event Budget</span>
          </h3>

          <form onSubmit={handleGeneratePlan} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Total Budget (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
                <input
                  type="number"
                  required
                  min={100}
                  max={100000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  placeholder="e.g. 1000"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-base font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2">
              {[500, 1000, 2500, 5000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setBudget(amt)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                    budget === amt
                      ? 'bg-purple-500 text-slate-950 border-purple-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'AI Analyzing Distribution...' : 'Generate AI Budget Allocation'}</span>
            </button>
          </form>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5">
          {plan ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white">AI Optimal Budget Plan</h3>
                  <p className="text-xs text-purple-400 font-mono">Total Budget: ₹{plan.totalBudget}</p>
                </div>

                <button
                  onClick={handleApplyBudgetPlan}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply & Create Event Drop</span>
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Standard Prize Pool</p>
                  <p className="text-base font-black text-amber-400">₹{plan.prizePool}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Golden Codes Pool</p>
                  <p className="text-base font-black text-purple-400">₹{plan.goldenCodes}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Winner Count</p>
                  <p className="text-base font-black text-sky-400">{plan.winnerCount} Lucky Users</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Expected ROI</p>
                  <p className="text-base font-black text-emerald-400">{plan.estimatedRoi}</p>
                </div>
              </div>

              {/* Reward Distribution List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI Reward Distribution Breakdown</span>
                </h4>

                <div className="space-y-2 text-xs">
                  {plan.rewardDistribution.map((dist, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-200 flex items-center justify-between">
                      <span className="font-bold text-purple-400">Tier {idx + 1}</span>
                      <span>{dist}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500">
              Enter budget on the left and click "Generate AI Budget Allocation" to calculate reward breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
