import React, { useState, useEffect } from 'react';
import { Users, Send, Gift, Bell, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { RetentionCampaign } from '../../types';

export const UserRetentionEngineView: React.FC = () => {
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [campaigns, setCampaigns] = useState<RetentionCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<'Comeback Bonus' | 'Reminder' | 'Special Event Invite'>('Comeback Bonus');
  const [bonusAmount, setBonusAmount] = useState<number>(5);
  const [customMsg, setCustomMsg] = useState<string>('🎁 Special Comeback Reward! Log in today to claim your ₹5 bonus balance!');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInactiveAndCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/retention/inactive-users');
      const data = await res.json();
      if (data.success) {
        setInactiveCount(data.inactiveUsersCount || 0);
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch retention info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInactiveAndCampaigns();
  }, []);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/retention/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          bonusAmount: selectedType === 'Comeback Bonus' ? bonusAmount : undefined,
          message: customMsg,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Retention Campaign '${selectedType}' executed for ${data.targetedCount || inactiveCount} inactive users!` });
        fetchInactiveAndCampaigns();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to trigger campaign' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Phase XIV Automated Retention & Win-Back Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">User Retention & Re-engagement Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Detect inactive users and launch Comeback Bonuses, Telegram Reminders, and Special Event Invites.
          </p>
        </div>

        <button
          onClick={fetchInactiveAndCampaigns}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-lg shadow-rose-500/20 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Scan Inactive Users</span>
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Trigger Campaign */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-rose-400" />
              <span>Launch Retention Campaign</span>
            </h3>

            <div className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold">
              {inactiveCount} Inactive Users Targeted
            </div>
          </div>

          <form onSubmit={handleSendCampaign} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Campaign Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Comeback Bonus', label: '🎁 Comeback Bonus', icon: Gift },
                  { id: 'Reminder', label: '🔔 Reminder Alert', icon: Bell },
                  { id: 'Special Event Invite', label: '⭐ Special Invite', icon: Sparkles },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedType(item.id as any);
                      if (item.id === 'Comeback Bonus') setCustomMsg('🎁 Special Comeback Reward! Log in today to claim your ₹5 bonus balance!');
                      if (item.id === 'Reminder') setCustomMsg('⏰ We miss you! Claim new giveaway redeem codes now!');
                      if (item.id === 'Special Event Invite') setCustomMsg('⚡ VIP Event Drop starting soon! High value reward codes inside!');
                    }}
                    className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 text-center transition ${
                      selectedType === item.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedType === 'Comeback Bonus' && (
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Comeback Bonus Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Broadcast Message Content</label>
              <textarea
                required
                rows={3}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs shadow-lg shadow-rose-500/20 transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Execute Campaign ({inactiveCount} Users)</span>
            </button>
          </form>
        </div>

        {/* Right List: Sent Campaigns History */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Executed Retention Campaigns History</span>
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading campaign history...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No retention campaigns sent yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {campaigns.map((camp) => (
                <div key={camp.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400">{camp.type}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Targeted: {camp.targetUsersCount} users</span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed font-mono">{camp.message}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span>Sent: {camp.sentAt ? new Date(camp.sentAt).toLocaleString() : 'Just now'}</span>
                    <span className="text-emerald-400 font-bold">✓ EXECUTED</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
