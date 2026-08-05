import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Users, Clock, AlertCircle, CheckCircle2, Download, ShieldCheck, Globe, Smartphone, Monitor } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface AnalyticsData {
  totalParticipants: number;
  peakOnlineUsers: number;
  avgTypingSpeed: number;
  avgClaimTime: number;
  invalidSubmissionRate: number;
  successRate: number;
  hourlyActivityGraph: Array<{ hour: string; claims: number; attempts: number; online: number }>;
  deviceDistribution: { Mobile: number; Desktop: number; Tablet: number };
  browserDistribution: { TelegramWebApp: number; Chrome: number; Safari: number; Firefox: number };
  countryDistribution: { India: number; Bangladesh: number; Nigeria: number; Other: number };
}

export const EventAnalyticsView: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/live-event/analytics')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.analytics) {
          setData(res.analytics);
        }
      })
      .catch((err) => console.error('Failed to load event analytics:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    if (!data) return;
    const csvRows = [
      ['Metric', 'Value'],
      ['Total Participants', data.totalParticipants],
      ['Peak Online Users', data.peakOnlineUsers],
      ['Avg Typing Speed (s)', data.avgTypingSpeed],
      ['Avg Claim Time (s)', data.avgClaimTime],
      ['Invalid Submission Rate (%)', data.invalidSubmissionRate],
      ['Success Rate (%)', data.successRate],
      [],
      ['Hour', 'Claims', 'Attempts', 'Online'],
      ...data.hourlyActivityGraph.map((h) => [h.hour, h.claims, h.attempts, h.online]),
    ];

    const csvContent = csvRows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event_analytics_${Date.now()}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
        <p className="mt-3 text-sm">Loading Live Telemetry Analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-400">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-2 text-sm">No analytics telemetry available yet.</p>
      </div>
    );
  }

  const deviceData = Object.entries(data.deviceDistribution).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 text-white">
      {/* Analytics Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-emerald-400" />
            <span>Event Performance Telemetry & Analytics</span>
          </h2>
          <p className="text-xs text-gray-400">Real-time claim velocity, traffic breakdown & system efficiency</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700 transition"
          >
            <Download className="h-3.5 w-3.5" /> CSV Export
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition"
          >
            <Download className="h-3.5 w-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="h-4 w-4 text-emerald-400" /> Total Users
          </div>
          <div className="mt-2 text-2xl font-black text-white">{data.totalParticipants}</div>
          <div className="mt-1 text-[11px] text-emerald-400">Unique participants</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <TrendingUp className="h-4 w-4 text-cyan-400" /> Peak Online
          </div>
          <div className="mt-2 text-2xl font-black text-white">{data.peakOnlineUsers}</div>
          <div className="mt-1 text-[11px] text-cyan-400">Max concurrent</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-4 w-4 text-amber-400" /> Avg Speed
          </div>
          <div className="mt-2 text-2xl font-black text-white">{data.avgTypingSpeed}s</div>
          <div className="mt-1 text-[11px] text-amber-400">Typing velocity</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-4 w-4 text-purple-400" /> Claim Time
          </div>
          <div className="mt-2 text-2xl font-black text-white">{data.avgClaimTime}s</div>
          <div className="mt-1 text-[11px] text-purple-400">Avg unlock to claim</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <AlertCircle className="h-4 w-4 text-rose-400" /> Invalid Submissions
          </div>
          <div className="mt-2 text-2xl font-black text-rose-300">{data.invalidSubmissionRate}%</div>
          <div className="mt-1 text-[11px] text-rose-400">Failed / wrong code</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Success Rate
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300">{data.successRate}%</div>
          <div className="mt-1 text-[11px] text-emerald-400">Valid claim ratio</div>
        </div>
      </div>

      {/* Hourly Claims & Activity Chart */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center justify-between">
          <span>Hourly Claim Velocity & Traffic Activity</span>
          <span className="text-xs font-mono text-emerald-400">LIVE TELEMETRY</span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.hourlyActivityGraph}>
              <defs>
                <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="claims" stroke="#10b981" fillOpacity={1} fill="url(#colorClaims)" name="Claims" />
              <Area type="monotone" dataKey="online" stroke="#06b6d4" fillOpacity={1} fill="url(#colorOnline)" name="Online Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distributions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Device Distribution */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-400" /> Device Types
          </h4>
          <div className="space-y-3">
            {Object.entries(data.deviceDistribution).map(([device, pct]) => (
              <div key={device}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{device}</span>
                  <span className="font-bold text-emerald-400">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Browser Distribution */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-cyan-400" /> App & Browser
          </h4>
          <div className="space-y-3">
            {Object.entries(data.browserDistribution).map(([browser, pct]) => (
              <div key={browser}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{browser}</span>
                  <span className="font-bold text-cyan-400">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Country Distribution */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-400" /> Geographic Region
          </h4>
          <div className="space-y-3">
            {Object.entries(data.countryDistribution).map(([country, pct]) => (
              <div key={country}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{country}</span>
                  <span className="font-bold text-purple-400">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
