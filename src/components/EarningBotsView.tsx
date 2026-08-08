import React, { useState, useEffect } from 'react';
import { Bot, Plus, ToggleLeft, ToggleRight, Check, X, Shield, Users, Trophy, Gift, ArrowRight, RefreshCw, Layers, Radio, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface EarningBot {
  id: string;
  botId: string;
  botUsername: string;
  botFirstName: string;
  botName: string;
  adminChatId: string;
  referralReward: number;
  registrationBonus: number;
  minWithdrawal: number;
  withdrawalTax: number;
  withdrawalMethods: string[];
  status: 'active' | 'paused';
  dailyReferralLimit: number;
  referralEarningCap: number;
  channels: any[];
  groups: any[];
}

interface EarningBotAnalytics {
  totalUsers: number;
  todaysUsers: number;
  totalReferrals: number;
  validReferrals: number;
  totalRewardAmount: number;
  totalWithdrawnAmount: number;
  pendingWithdrawals: number;
  totalWithdrawals: number;
}

interface EarningBotsViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EarningBotsView: React.FC<EarningBotsViewProps> = ({ showToast }) => {
  const [bots, setBots] = useState<EarningBot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<EarningBot | null>(null);
  const [botAnalytics, setBotAnalytics] = useState<Record<string, EarningBotAnalytics>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  // New Bot Form State
  const [newToken, setNewToken] = useState('');
  const [newAdminChatId, setNewAdminChatId] = useState('');
  const [newReferralReward, setNewReferralReward] = useState('10');
  const [newRegistrationBonus, setNewRegistrationBonus] = useState('5');
  const [newMinWithdrawal, setNewMinWithdrawal] = useState('100');
  const [newWithdrawalTax, setNewWithdrawalTax] = useState('5');
  const [newDailyLimit, setNewDailyLimit] = useState('50');
  const [newEarningCap, setNewEarningCap] = useState('1000');
  const [newMethods, setNewMethods] = useState<string[]>(['UPI']);

  // Channel/Group Form State
  const [newChannelChatId, setNewChannelChatId] = useState('');
  const [newChannelLink, setNewChannelLink] = useState('');
  const [newGroupChatId, setNewGroupChatId] = useState('');
  const [newGroupLink, setNewGroupLink] = useState('');
  const [isVerifyingChat, setIsVerifyingChat] = useState(false);

  // Load Earning Bots on mount
  const fetchBots = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/admin/earning-bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.bots || []);
        // Fetch analytics for each bot
        data.bots.forEach((b: EarningBot) => {
          fetchBotAnalytics(b.id);
        });
      } else {
        showToast(data.error || 'Failed to fetch earning bots', 'error');
      }
    } catch (err) {
      showToast('Network error while loading earning bots', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBotAnalytics = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/earning-bots/${id}/analytics`);
      const data = await res.json();
      if (data.success) {
        setBotAnalytics(prev => ({
          ...prev,
          [id]: data.analytics
        }));
      }
    } catch (e) {
      console.error('Error fetching analytics for', id, e);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleConnectBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) {
      showToast('Please enter a valid Telegram Bot Token', 'error');
      return;
    }

    setIsConnecting(true);
    try {
      const res = await apiFetch('/api/admin/earning-bots/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: newToken.trim(),
          adminChatId: newAdminChatId.trim(),
          referralReward: Number(newReferralReward),
          registrationBonus: Number(newRegistrationBonus),
          minWithdrawal: Number(newMinWithdrawal),
          withdrawalTax: Number(newWithdrawalTax),
          withdrawalMethods: newMethods,
          dailyReferralLimit: Number(newDailyLimit),
          referralEarningCap: Number(newEarningCap),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Bot @${data.bot.botUsername} connected and registered successfully!`, 'success');
        setNewToken('');
        setNewAdminChatId('');
        fetchBots();
      } else {
        showToast(data.error || 'Connection failed', 'error');
      }
    } catch (err) {
      showToast('Error connecting bot', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToggleStatus = async (bot: EarningBot) => {
    const nextStatus = bot.status === 'active' ? 'paused' : 'active';
    try {
      const res = await apiFetch(`/api/admin/earning-bots/${bot.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bot,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Bot status updated to ${nextStatus}`, 'success');
        fetchBots();
        if (selectedBot?.id === bot.id) {
          setSelectedBot(prev => prev ? { ...prev, status: nextStatus } : null);
        }
      } else {
        showToast(data.error || 'Failed to update bot status', 'error');
      }
    } catch (err) {
      showToast('Network error updating bot status', 'error');
    }
  };

  const handleAddChat = async (type: 'channel' | 'group') => {
    if (!selectedBot) return;

    const chatId = type === 'channel' ? newChannelChatId.trim() : newGroupChatId.trim();
    const link = type === 'channel' ? newChannelLink.trim() : newGroupLink.trim();

    if (!chatId) {
      showToast('Chat ID is required for verification.', 'error');
      return;
    }

    setIsVerifyingChat(true);
    try {
      const res = await apiFetch(`/api/admin/earning-bots/${selectedBot.id}/add-channel-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, chatId, link }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Successfully verified and added ${type}: ${data.item.name}!`, 'success');
        if (type === 'channel') {
          setNewChannelChatId('');
          setNewChannelLink('');
        } else {
          setNewGroupChatId('');
          setNewGroupLink('');
        }
        fetchBots().then(() => {
          // Keep selection updated
          setBots(latest => {
            const fresh = latest.find(b => b.id === selectedBot.id);
            if (fresh) setSelectedBot(fresh);
            return latest;
          });
        });
      } else {
        showToast(data.error || 'Verification failed', 'error');
      }
    } catch (err) {
      showToast('Network error during verification', 'error');
    } finally {
      setIsVerifyingChat(false);
    }
  };

  const handleDeleteChat = async (type: 'channel' | 'group', chatId: string) => {
    if (!selectedBot) return;

    try {
      const res = await apiFetch(`/api/admin/earning-bots/${selectedBot.id}/delete-channel-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, chatId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`${type === 'channel' ? 'Channel' : 'Group'} removed.`, 'success');
        fetchBots().then(() => {
          setBots(latest => {
            const fresh = latest.find(b => b.id === selectedBot.id);
            if (fresh) setSelectedBot(fresh);
            return latest;
          });
        });
      } else {
        showToast(data.error || 'Failed to delete chat target', 'error');
      }
    } catch (err) {
      showToast('Network error removing chat', 'error');
    }
  };

  const handleSyncAllWebhooks = async () => {
    try {
      const res = await apiFetch('/api/admin/earning-bots/sync-webhooks', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(data.error || 'Webhook synchronization failed', 'error');
      }
    } catch (err) {
      showToast('Error synchronizing webhooks', 'error');
    }
  };

  const toggleMethod = (m: string) => {
    if (newMethods.includes(m)) {
      if (newMethods.length > 1) {
        setNewMethods(newMethods.filter(item => item !== m));
      } else {
        showToast('At least one withdrawal method must be selected.', 'info');
      }
    } else {
      setNewMethods([...newMethods, m]);
    }
  };

  // General Metrics Summed up across all configured bots
  const overallTotalBots = bots.length;
  const activeBotsCount = bots.filter(b => b.status === 'active').length;
  const pausedBotsCount = overallTotalBots - activeBotsCount;

  let totalUsersSum = 0;
  let totalValidReferralsSum = 0;
  let totalRewardSum = 0;
  let totalWithdrawnSum = 0;

  Object.keys(botAnalytics).forEach(key => {
    const a = botAnalytics[key];
    if (a) {
      totalUsersSum += a.totalUsers || 0;
      totalValidReferralsSum += a.validReferrals || 0;
      totalRewardSum += a.totalRewardAmount || 0;
      totalWithdrawnSum += a.totalWithdrawnAmount || 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* 1. Header / Intro Block */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-extrabold text-white">Multi-Bot Earning System</h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xl font-semibold leading-relaxed">
            Create, deploy, and configure multiple independent Telegram Earning Bots simultaneously. Users register, share verified contacts, complete join requirements, refer friends, and request payouts on the dedicated bot parameters.
          </p>
        </div>
        <button
          onClick={handleSyncAllWebhooks}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-black tracking-wider uppercase text-white rounded-xl active:scale-[0.98] transition-all duration-300"
        >
          <RefreshCw className="w-4 h-4 text-orange-400" />
          <span>Sync Webhooks</span>
        </button>
      </div>

      {/* 2. System Dashboard Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Total Configured Bots</p>
            <h3 className="text-xl font-bold font-mono text-white mt-0.5">{overallTotalBots}</h3>
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 mt-0.5">
              <span className="text-emerald-400">● {activeBotsCount} Active</span>
              <span>● {pausedBotsCount} Paused</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Total Bot Users</p>
            <h3 className="text-xl font-bold font-mono text-white mt-0.5">{totalUsersSum}</h3>
            <p className="text-[9px] font-bold text-slate-400">Omni-Channel registrations</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Valid Referrals</p>
            <h3 className="text-xl font-bold font-mono text-white mt-0.5">{totalValidReferralsSum}</h3>
            <p className="text-[9px] font-bold text-slate-400">Total verified invites</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Total Paid Rewards</p>
            <h3 className="text-xl font-bold font-mono text-white mt-0.5">₹{totalRewardSum}</h3>
            <p className="text-[9px] font-bold text-slate-400">Referral & signup payouts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Connect a New Bot Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3 flex items-center gap-2.5">
              <Plus className="w-5 h-5 text-orange-500 animate-pulse" />
              <h2 className="text-sm font-black tracking-wider uppercase text-white">Connect New Earning Bot</h2>
            </div>

            <form onSubmit={handleConnectBot} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Telegram Bot Token</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 748392019:AAHfd7-sh38..."
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none transition-colors duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admin Group Chat ID (Withdrawal alerts)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. -100234589201"
                  value={newAdminChatId}
                  onChange={(e) => setNewAdminChatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors duration-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Referral Reward</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={newReferralReward}
                      onChange={(e) => setNewReferralReward(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Registration Bonus</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={newRegistrationBonus}
                      onChange={(e) => setNewRegistrationBonus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Min Withdrawal</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={newMinWithdrawal}
                      onChange={(e) => setNewMinWithdrawal(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Tax Deducted</label>
                  <div className="relative">
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">%</span>
                    <input
                      type="number"
                      required
                      value={newWithdrawalTax}
                      onChange={(e) => setNewWithdrawalTax(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Daily Ref Limit</label>
                  <input
                    type="number"
                    required
                    value={newDailyLimit}
                    onChange={(e) => setNewDailyLimit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ref Earning Cap</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={newEarningCap}
                      onChange={(e) => setNewEarningCap(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Supported Withdrawal Methods</label>
                <div className="flex flex-wrap gap-2">
                  {['UPI', 'REDEEM_CODE', 'ULTRA_PAY'].map((m) => {
                    const isSelected = newMethods.includes(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => toggleMethod(m)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase transition-all duration-300 ${
                          isSelected
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {m.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
              >
                <Bot className="w-4 h-4" />
                <span>{isConnecting ? 'Registering...' : 'Connect Earning Bot'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* 4. Connected Bots and Channel Management Panels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bots List */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-black tracking-wider uppercase text-white font-sans">Active Configurations ({bots.length})</h2>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading Bots...</span>
              </div>
            ) : bots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-wider border border-dashed border-slate-800 rounded-xl">
                No custom earning bots registered.
              </div>
            ) : (
              <div className="space-y-4">
                {bots.map((b) => {
                  const stats = botAnalytics[b.id] || { totalUsers: 0, validReferrals: 0, totalRewardAmount: 0, pendingWithdrawals: 0 };
                  const isSelected = selectedBot?.id === b.id;

                  const missingChannels = !b.channels || b.channels.length === 0;
                  const missingGroups = !b.groups || b.groups.length === 0;
                  const hasWarning = missingChannels || missingGroups;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBot(b)}
                      className={`p-4 rounded-xl transition-all duration-300 cursor-pointer border ${
                        isSelected
                          ? 'bg-slate-900 border-orange-500/40 shadow-lg shadow-orange-500/5'
                          : 'bg-slate-950/65 border-slate-900 hover:border-slate-800 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400">
                            <Bot className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white leading-none">{b.botName}</h3>
                              <span
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest leading-none ${
                                  b.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {b.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-1">@{b.botUsername}</p>
                          </div>
                        </div>

                        {/* Fast Toggle Action */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus(b)}
                            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                            title={b.status === 'active' ? 'Pause Bot' : 'Activate Bot'}
                          >
                            {b.status === 'active' ? (
                              <ToggleRight className="w-8 h-8 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Warnings / Configurations Missing */}
                      {hasWarning && (
                        <div className="mt-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-400 font-semibold flex items-center gap-2 animate-pulse">
                          <span>⚠️ Config incompleteness: </span>
                          {missingChannels && <span>Missing Channel targets. </span>}
                          {missingGroups && <span>Missing Community Groups. </span>}
                        </div>
                      )}

                      {/* Quick Stats Grid */}
                      <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-900 text-center font-mono text-[10px]">
                        <div>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Users</p>
                          <p className="text-white font-bold mt-0.5">{stats.totalUsers}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Ref (Valid)</p>
                          <p className="text-emerald-400 font-bold mt-0.5">{stats.validReferrals}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Withdrawn</p>
                          <p className="text-white font-bold mt-0.5">₹{stats.totalWithdrawnAmount}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Pending Wd</p>
                          <p className="text-orange-400 font-bold mt-0.5">{stats.pendingWithdrawals}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification Channel / Group Manager Panel */}
          {selectedBot && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <h2 className="text-sm font-black tracking-wider uppercase text-white font-sans">
                    Chat Target Verification: {selectedBot.botName}
                  </h2>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500">@{selectedBot.botUsername}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Channel Config */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-400 tracking-wider">
                    <Radio className="w-4 h-4 text-blue-400" />
                    <span>Telegram Channels</span>
                  </div>

                  <div className="space-y-2 p-4 bg-slate-950 rounded-xl border border-slate-900">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Chat ID</label>
                      <input
                        type="text"
                        placeholder="e.g. -10098472910"
                        value={newChannelChatId}
                        onChange={(e) => setNewChannelChatId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Invitation Link</label>
                      <input
                        type="text"
                        placeholder="e.g. https://t.me/MyChannel"
                        value={newChannelLink}
                        onChange={(e) => setNewChannelLink(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddChat('channel')}
                      disabled={isVerifyingChat}
                      className="w-full flex items-center justify-center gap-2.5 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all duration-300 disabled:opacity-50"
                    >
                      <span>Verify & Add Channel</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Configured Channels List */}
                  <div className="space-y-2">
                    {!selectedBot.channels || selectedBot.channels.length === 0 ? (
                      <p className="text-[10px] text-slate-500 font-bold uppercase text-center py-2">No verification channels configured.</p>
                    ) : (
                      selectedBot.channels.map((ch: any) => (
                        <div key={ch.chatId} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-900 rounded-xl text-xs">
                          <div>
                            <p className="font-bold text-white">{ch.name || 'Official Channel'}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ch.chatId} {ch.username}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteChat('channel', ch.chatId)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 active:scale-95 transition-all duration-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Group Config */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-400 tracking-wider">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>Telegram Community Groups</span>
                  </div>

                  <div className="space-y-2 p-4 bg-slate-950 rounded-xl border border-slate-900">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Chat ID</label>
                      <input
                        type="text"
                        placeholder="e.g. -10048291038"
                        value={newGroupChatId}
                        onChange={(e) => setNewGroupChatId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Invitation Link</label>
                      <input
                        type="text"
                        placeholder="e.g. https://t.me/MyCommunityGroup"
                        value={newGroupLink}
                        onChange={(e) => setNewGroupLink(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddChat('group')}
                      disabled={isVerifyingChat}
                      className="w-full flex items-center justify-center gap-2.5 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white hover:bg-purple-500 active:scale-95 transition-all duration-300 disabled:opacity-50"
                    >
                      <span>Verify & Add Group</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Configured Groups List */}
                  <div className="space-y-2">
                    {!selectedBot.groups || selectedBot.groups.length === 0 ? (
                      <p className="text-[10px] text-slate-500 font-bold uppercase text-center py-2">No verification groups configured.</p>
                    ) : (
                      selectedBot.groups.map((gr: any) => (
                        <div key={gr.chatId} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-900 rounded-xl text-xs">
                          <div>
                            <p className="font-bold text-white">{gr.name || 'Community Group'}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{gr.chatId} {gr.username}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteChat('group', gr.chatId)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 active:scale-95 transition-all duration-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
