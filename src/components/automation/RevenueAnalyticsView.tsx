import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { RevenueAnalytics } from '../../types';

export const RevenueAnalyticsView: React.FC = () => {
  const [data, setData] = useState<RevenueAnalytics | null>(null);
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Yearly'>('Monthly');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/revenue/analytics?period=${period}`);
      const json = await res.json();
      if (json.success) {
        setData(json.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch revenue analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Phase XIV Financial Intelligence</span>
          </div>
          <h2 className="text-xl font-black text-white">Smart Revenue & Profit Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">
            Track Platform Revenue, Withdrawal Fees, Referral Costs, Event Prizes & Net Profit in real-time.
          </p>
        </div>

        {/* Timeframe Toggles */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                period === p
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Computing financial metrics...</div>
      ) : data ? (
        <>
          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Platform Revenue</span>
              <p className="text-xl font-black text-white">₹{data.platformRevenue.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                <ArrowUpRight className="w-3 h-3" />
                <span>Gross Income</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Withdrawal Fees (2-5%)</span>
              <p className="text-xl font-black text-sky-400">₹{data.withdrawalFees.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[10px] text-sky-400 font-bold">
                <ArrowUpRight className="w-3 h-3" />
                <span>Transaction Margin</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Referral Payouts</span>
              <p className="text-xl font-black text-purple-400">₹{data.referralCost.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                <ArrowDownRight className="w-3 h-3 text-purple-400" />
                <span>Acquisition Cost</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Prize Drops Cost</span>
              <p className="text-xl font-black text-amber-400">₹{data.prizeCost.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                <ArrowDownRight className="w-3 h-3 text-amber-400" />
                <span>Event Rewards</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950/80 to-slate-900 border border-emerald-500/40 space-y-1">
              <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider">Net Profit</span>
              <p className="text-2xl font-black text-emerald-400">₹{data.netProfit.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{data.platformRevenue > 0 ? `${Math.round((data.netProfit / data.platformRevenue) * 100)}% Margin` : '100% Margin'}</span>
              </div>
            </div>
          </div>

          {/* Visual Trend Chart (Custom Clean SVG Visualizer) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>{period} Revenue vs. Profit Distribution</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Live Data Projection</span>
            </div>

            {/* Custom SVG Bar Chart */}
            <div className="space-y-3 pt-2">
              {data.history.map((item, idx) => {
                const maxVal = Math.max(...data.history.map((h) => h.revenue || 1));
                const revPct = Math.min(100, Math.max(10, (item.revenue / maxVal) * 100));
                const profitPct = Math.min(100, Math.max(5, (item.profit / maxVal) * 100));

                return (
                  <div key={idx} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-300 w-24">{item.label}</span>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span>Revenue: <strong className="text-white">₹{item.revenue}</strong></span>
                        <span>Prizes: <strong className="text-amber-400">₹{item.prizes}</strong></span>
                        <span>Net Profit: <strong className="text-emerald-400">₹{item.profit}</strong></span>
                      </div>
                    </div>

                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                      <div
                        style={{ width: `${revPct}%` }}
                        className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-xs text-slate-500">No financial data available.</div>
      )}
    </div>
  );
};
