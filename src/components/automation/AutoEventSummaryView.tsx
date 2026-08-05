import React, { useState, useEffect } from 'react';
import { Send, Sparkles, Trophy, CheckCircle2, AlertCircle, Copy, Share2, Award, Zap } from 'lucide-react';
import { EventSummary } from '../../types';

export const AutoEventSummaryView: React.FC = () => {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLatestSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/event-summary/latest');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch event summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSummary();
  }, []);

  const handleBroadcast = async () => {
    if (!summary) return;
    setBroadcasting(true);
    try {
      const res = await fetch('/api/admin/event-summary/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId: summary.eventId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: '1-Click Result Post & Winner Announcement Broadcasted to Telegram Channel!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to broadcast post' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setBroadcasting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatusMsg({ type: 'success', text: 'Copied formatted post to clipboard!' });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/30">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Phase XIV AI Post-Event Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">Auto Event Summary & Telegram Broadcast</h2>
          <p className="text-xs text-slate-400 mt-1">
            When an event ends, AI automatically generates Telegram Result Posts, Winner Announcements & Highlights.
          </p>
        </div>

        <button
          onClick={handleBroadcast}
          disabled={broadcasting || !summary}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{broadcasting ? 'Broadcasting...' : '1-Click Telegram Broadcast'}</span>
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

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Generating post-event AI summary...</div>
      ) : summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Telegram Post Preview */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>Generated Telegram Result Post</span>
              </h3>
              <button
                onClick={() => copyToClipboard(summary.telegramResultPost)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/20 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {summary.telegramResultPost}
            </div>
          </div>

          {/* Statistics & Highlights */}
          <div className="space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Event Performance Statistics</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Claims</p>
                  <p className="text-base font-black text-amber-400">{summary.statistics.totalClaims} Users</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Prize Awarded</p>
                  <p className="text-base font-black text-emerald-400">₹{summary.statistics.totalAmountAwarded}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Fastest Claim Time</p>
                  <p className="text-base font-black text-sky-400">{summary.statistics.fastestClaimSeconds}s</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Top Typist</p>
                  <p className="text-base font-black text-purple-400">{summary.statistics.fastestUser}</p>
                </div>
              </div>
            </div>

            {/* Highlights List */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>AI Key Event Highlights</span>
              </h3>

              <div className="space-y-2 text-xs">
                {summary.highlights.map((h, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-300 flex items-center gap-2">
                    <span className="text-amber-400 font-bold">⚡</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-500">No event summary available yet.</div>
      )}
    </div>
  );
};
