import React, { useState, useEffect } from 'react';
import { Lightbulb, Users, Clock, AlertTriangle, TrendingUp, Sparkles, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import { AdminInsights } from '../../types';

export const AdminInsightsView: React.FC = () => {
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/insights/digest');
      const data = await res.json();
      if (data.success) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error('Failed to fetch admin insights digest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Phase XIV Daily Morning Executive Digest</span>
          </div>
          <h2 className="text-xl font-black text-white">AI Executive Admin Insights</h2>
          <p className="text-xs text-slate-400 mt-1">
            Daily intelligence report: Inactive Users, Peak Hours, Fraud Trends, Best Event Windows & Growth Actions.
          </p>
        </div>

        <button
          onClick={fetchInsights}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs shadow-lg shadow-indigo-500/20 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh AI Digest</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Synthesizing executive morning digest...</div>
      ) : insights ? (
        <div className="space-y-6">
          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Inactive Users</span>
              </span>
              <p className="text-2xl font-black text-amber-400">{insights.inactiveUsersCount} Accounts</p>
              <p className="text-[11px] text-slate-400">Not active in past 5 days</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Peak Active Hours</span>
              </span>
              <p className="text-xl font-black text-sky-400">{insights.mostActiveHours}</p>
              <p className="text-[11px] text-slate-400">Highest claim engagement window</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Fraud Trends</span>
              </span>
              <p className="text-sm font-bold text-rose-300">{insights.fraudTrends}</p>
              <p className="text-[11px] text-slate-400">Auto-flagged VPNs & duplicates</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Revenue & Growth Trend</span>
              </span>
              <p className="text-sm font-bold text-emerald-400">{insights.revenueTrends}</p>
              <p className="text-[11px] text-slate-400">Conversion & retention stability</p>
            </div>
          </div>

          {/* Today's Suggestions & Growth Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Today's AI Strategic Suggestions</span>
              </h3>

              <div className="space-y-3 text-xs">
                {insights.todaysSuggestions.map((sug, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold shrink-0">{i + 1}</span>
                    <p className="text-slate-200 leading-relaxed font-medium">{sug}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Growth & Monetization Roadmap</span>
              </h3>

              <div className="space-y-3 text-xs">
                {insights.growthSuggestions.map((g, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                    <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-slate-200 leading-relaxed font-medium">{g}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-500">No admin insights data available.</div>
      )}
    </div>
  );
};
