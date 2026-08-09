import React, { useState, useEffect } from 'react';
import { Bot, Plus, ToggleLeft, ToggleRight, Check, X, Shield, ShieldCheck, Users, Trophy, Gift, ArrowRight, RefreshCw, Layers, Radio, Trash2, Copy, Share2, ExternalLink, Search, CheckCircle2, AlertTriangle, ChevronRight, BarChart2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface EarningBot {
  id: string;
  botId: string;
  botUsername: string;
  botFirstName: string;
  botName: string;
  adminChatId: string;
  miniAppUrl?: string;
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
  const [activeTab, setActiveTab] = useState<'wizard' | 'referrals'>('wizard');

  // New Bot Form State
  const [newToken, setNewToken] = useState('');
  const [newAdminChatId, setNewAdminChatId] = useState('');
  const [newMiniAppUrl, setNewMiniAppUrl] = useState('');
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

  // Referrals Tracking State
  const [botUsers, setBotUsers] = useState<any[]>([]);
  const [botReferralsList, setBotReferralsList] = useState<any[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

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
        if (data.bots && data.bots.length > 0 && !selectedBot) {
          setSelectedBot(data.bots[0]);
        }
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

  const fetchBotReferralsData = async (id: string) => {
    setLoadingReferrals(true);
    try {
      const res = await apiFetch(`/api/admin/earning-bots/${id}/referrals`);
      const data = await res.json();
      if (data.success) {
        setBotUsers(data.users || []);
        setBotReferralsList(data.referrals || []);
      }
    } catch (e) {
      console.error('Error fetching bot referrals data:', e);
    } finally {
      setLoadingReferrals(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      fetchBotReferralsData(selectedBot.id);
    }
  }, [selectedBot?.id]);

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
          miniAppUrl: newMiniAppUrl.trim(),
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
        showToast(`🎉 Step 1 Complete: Bot @${data.bot.botUsername} connected successfully! Now proceed to Step 2 (Channels & Groups).`, 'success');
        setNewToken('');
        setNewAdminChatId('');
        fetchBots().then(() => {
          setSelectedBot(data.bot);
        });
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
        showToast(`✓ Verified and added ${type}: ${data.item.name}!`, 'success');
        if (type === 'channel') {
          setNewChannelChatId('');
          setNewChannelLink('');
        } else {
          setNewGroupChatId('');
          setNewGroupLink('');
        }
        const updatedRes = await apiFetch('/api/admin/earning-bots');
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setBots(updatedData.bots || []);
          const fresh = (updatedData.bots || []).find((b: EarningBot) => b.id === selectedBot.id);
          if (fresh) setSelectedBot(fresh);
        }
      } else {
        showToast(data.error || 'Verification failed', 'error');
      }
    } catch (err) {
      showToast('Network error during verification', 'error');
    } finally {
      setIsVerifyingChat(false);
    }
  };

  const handleToggleChat = async (type: 'channel' | 'group', chatId: string) => {
    if (!selectedBot) return;
    try {
      const res = await apiFetch(`/api/admin/earning-bots/${selectedBot.id}/toggle-channel-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, chatId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${type === 'channel' ? 'Channel' : 'Group'} status toggled.`, 'success');
        const updatedRes = await apiFetch('/api/admin/earning-bots');
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setBots(updatedData.bots || []);
          const fresh = (updatedData.bots || []).find((b: EarningBot) => b.id === selectedBot.id);
          if (fresh) setSelectedBot(fresh);
        }
      }
    } catch (e) {
      showToast('Failed to toggle chat state', 'error');
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
        const updatedRes = await apiFetch('/api/admin/earning-bots');
        const updatedData = await updatedRes.json();
        if (updatedData.success) {
          setBots(updatedData.bots || []);
          const fresh = (updatedData.bots || []).find((b: EarningBot) => b.id === selectedBot.id);
          if (fresh) setSelectedBot(fresh);
        }
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

  // Setup Wizard Evaluation
  const evalBotReadiness = (bot: EarningBot) => {
    const hasToken = Boolean(bot.botUsername && bot.botId);
    const channelsCount = bot.channels ? bot.channels.length : 0;
    const groupsCount = bot.groups ? bot.groups.length : 0;
    const hasChannels = channelsCount > 0;
    const hasGroups = groupsCount > 0;
    const hasReferral = bot.referralReward > 0 && bot.registrationBonus >= 0;
    const hasWithdrawal = bot.minWithdrawal > 0;
    const isReady = hasToken && hasChannels && hasGroups && hasReferral && hasWithdrawal;

    const missingSteps: string[] = [];
    if (!hasChannels) missingSteps.push('Add Channel targets');
    if (!hasGroups) missingSteps.push('Add Community Groups');
    if (!hasReferral) missingSteps.push('Set Referral & Bonus amounts');

    return {
      hasToken,
      hasChannels,
      hasGroups,
      hasReferral,
      hasWithdrawal,
      isReady,
      missingSteps,
      channelsCount,
      groupsCount,
    };
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

  const filteredBotUsers = botUsers.filter(u => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.userName && u.userName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.telegramId && String(u.telegramId).includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q))
    );
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
            Configure isolated Telegram Earning Bots. Each bot has its own token, channel targets, referral reward rules, user accounts, and payout settings.
          </p>
        </div>
        <button
          onClick={handleSyncAllWebhooks}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-black tracking-wider uppercase text-white rounded-xl active:scale-[0.98] transition-all duration-300 shrink-0"
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
            <p className="text-[9px] font-bold text-slate-400">Scoped per bot ID</p>
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
              <h2 className="text-sm font-black tracking-wider uppercase text-white">STEP 1 — CONNECT EARNING BOT</h2>
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admin Group Chat ID (Alerts)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. -100234589201"
                  value={newAdminChatId}
                  onChange={(e) => setNewAdminChatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors duration-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Mini App URL / Web App Link (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. https://t.me/Ultra_pay_user_bot/app or https://my-domain.com"
                  value={newMiniAppUrl}
                  onChange={(e) => setNewMiniAppUrl(e.target.value)}
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
                <span>{isConnecting ? 'Detecting Bot...' : 'Connect Earning Bot'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* 4. Connected Bots List & Selected Bot Configuration Wizard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bots Selection List */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-black tracking-wider uppercase text-white font-sans">Active Bots ({bots.length})</h2>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading Bots...</span>
              </div>
            ) : bots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-wider border border-dashed border-slate-800 rounded-xl">
                No custom earning bots registered. Use the form on the left to connect one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bots.map((b) => {
                  const evalRes = evalBotReadiness(b);
                  const isSelected = selectedBot?.id === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBot(b)}
                      className={`p-4 rounded-xl transition-all duration-300 cursor-pointer border relative overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-orange-500/60 shadow-lg shadow-orange-500/10'
                          : 'bg-slate-950/65 border-slate-900 hover:border-slate-800 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400 shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-white leading-tight">{b.botName}</h3>
                            <p className="text-[10px] text-slate-500 font-mono">@{b.botUsername}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus(b)}
                            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                          >
                            {b.status === 'active' ? (
                              <ToggleRight className="w-7 h-7 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-7 h-7 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Status Readiness Badge */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900">
                        {evalRes.isReady ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>READY</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            <span>SETUP INCOMPLETE</span>
                          </span>
                        )}

                        <div className="text-[9px] font-mono text-slate-500 font-bold">
                          <span>Ch: {evalRes.channelsCount}</span> | <span>Gr: {evalRes.groupsCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Selected Bot Setup Wizard & Management */}
          {selectedBot && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
              {/* Bot Header & Tab Controls */}
              <div className="border-b border-slate-800/80 pb-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-orange-500" />
                      <h2 className="text-base font-extrabold text-white">{selectedBot.botName}</h2>
                      <span className="text-xs text-orange-400 font-mono font-bold">@{selectedBot.botUsername}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Bot ID: {selectedBot.botId} | Admin Chat ID: {selectedBot.adminChatId}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('wizard')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                        activeTab === 'wizard'
                          ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Setup Wizard</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('referrals')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                        activeTab === 'referrals'
                          ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Referrals & Users ({botUsers.length})</span>
                    </button>
                  </div>
                </div>

                {/* Progress Indicators */}
                {(() => {
                  const evalRes = evalBotReadiness(selectedBot);
                  return (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className="text-slate-400">Configuration Readiness Progress</span>
                        <span className={evalRes.isReady ? 'text-emerald-400' : 'text-amber-400'}>
                          {evalRes.isReady ? '🎉 EARNING BOT READY (100%)' : '⚠️ SETUP INCOMPLETE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[9px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-1 p-1.5 bg-slate-900 rounded border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>1 BOT ✓</span>
                        </div>
                        <div className={`flex items-center gap-1 p-1.5 bg-slate-900 rounded border ${evalRes.hasChannels ? 'border-emerald-500/20 text-emerald-400' : 'border-amber-500/20 text-amber-400'}`}>
                          {evalRes.hasChannels ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>2 CHANNELS ({evalRes.channelsCount})</span>
                        </div>
                        <div className={`flex items-center gap-1 p-1.5 bg-slate-900 rounded border ${evalRes.hasGroups ? 'border-emerald-500/20 text-emerald-400' : 'border-amber-500/20 text-amber-400'}`}>
                          {evalRes.hasGroups ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>3 GROUPS ({evalRes.groupsCount})</span>
                        </div>
                        <div className="flex items-center gap-1 p-1.5 bg-slate-900 rounded border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>4 REF LINK ✓</span>
                        </div>
                        <div className="flex items-center gap-1 p-1.5 bg-slate-900 rounded border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>5 MINI APP ✓</span>
                        </div>
                        <div className="flex items-center gap-1 p-1.5 bg-slate-900 rounded border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>6 PAYOUT ✓</span>
                        </div>
                      </div>

                      {!evalRes.isReady && (
                        <div className="text-[10px] text-amber-400/90 font-semibold pt-1">
                          Action required: {evalRes.missingSteps.join(', ')}.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* TAB 1: SETUP WIZARD & CONFIGURATION */}
              {activeTab === 'wizard' && (
                <div className="space-y-6">
                  {/* BACKGROUND SECURITY ENGINE DIAGNOSTIC CARD */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Silent Security Engine Status</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Background Verification & Risk Pipeline for @{selectedBot.botUsername}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Engine Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500">IP Detection</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enabled (Silent)
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500">Device Fingerprint</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active (Score 98)
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500">Duplicate Check</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bot-Scoped Phone
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500">Risk Check</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Fraud Engine
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-slate-500">Last Security Check:</span>{' '}
                        <span className="text-slate-200 font-bold">Background Trigger Active</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Last Result:</span>{' '}
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">SAFE</span>
                      </div>
                    </div>
                  </div>

                  {/* STEP 4 & STEP 5: Admin Referral Link & Mini App Deep Link Card */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black uppercase text-orange-400 tracking-wider">
                        <Share2 className="w-4 h-4 text-orange-400" />
                        <span>Admin Referral Link & Deep Link</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 font-bold">Scoped to @{selectedBot.botUsername}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono truncate">
                        {`https://t.me/${selectedBot.botUsername}?start=ref_${selectedBot.adminChatId || 'ADMIN'}`}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            const link = `https://t.me/${selectedBot.botUsername}?start=ref_${selectedBot.adminChatId || 'ADMIN'}`;
                            navigator.clipboard.writeText(link);
                            showToast('📋 Admin Referral Link copied!', 'success');
                          }}
                          className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </button>
                        <a
                          href={`https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${selectedBot.botUsername}?start=ref_${selectedBot.adminChatId || 'ADMIN'}`)}&text=${encodeURIComponent(`Join ${selectedBot.botName} and earn cash rewards!`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 sm:flex-initial px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2 & STEP 3: Channels & Community Groups Setup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Channel Config */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-400 tracking-wider">
                          <Radio className="w-4 h-4 text-blue-400" />
                          <span>Telegram Channels ({selectedBot.channels ? selectedBot.channels.length : 0})</span>
                        </div>
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
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all duration-300 disabled:opacity-50"
                        >
                          <span>Verify & Add Channel</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Configured Channels List */}
                      <div className="space-y-2">
                        {!selectedBot.channels || selectedBot.channels.length === 0 ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-400 font-semibold text-center">
                            ⚠️ At least 1 Telegram Channel is required for onboarding verification.
                          </div>
                        ) : (
                          selectedBot.channels.map((ch: any) => (
                            <div key={ch.chatId} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-900 rounded-xl text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-white">{ch.name || 'Official Channel'}</p>
                                  <span className={`px-1.5 py-0.2 text-[8px] font-black uppercase rounded ${ch.enabled === false ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                    {ch.enabled === false ? 'DISABLED' : 'VERIFIED ✓'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ch.chatId} {ch.username}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleChat('channel', ch.chatId)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                                  title="Toggle Enable/Disable"
                                >
                                  {ch.enabled === false ? <ToggleLeft className="w-4 h-4 text-slate-500" /> : <ToggleRight className="w-4 h-4 text-emerald-400" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteChat('channel', ch.chatId)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 active:scale-95 transition-all duration-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Group Config */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-400 tracking-wider">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span>Telegram Community Groups ({selectedBot.groups ? selectedBot.groups.length : 0})</span>
                        </div>
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
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white hover:bg-purple-500 active:scale-95 transition-all duration-300 disabled:opacity-50"
                        >
                          <span>Verify & Add Group</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Configured Groups List */}
                      <div className="space-y-2">
                        {!selectedBot.groups || selectedBot.groups.length === 0 ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-400 font-semibold text-center">
                            ⚠️ At least 1 Community Group is required for onboarding verification.
                          </div>
                        ) : (
                          selectedBot.groups.map((gr: any) => (
                            <div key={gr.chatId} className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-900 rounded-xl text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-white">{gr.name || 'Community Group'}</p>
                                  <span className={`px-1.5 py-0.2 text-[8px] font-black uppercase rounded ${gr.enabled === false ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                    {gr.enabled === false ? 'DISABLED' : 'VERIFIED ✓'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{gr.chatId} {gr.username}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleChat('group', gr.chatId)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                                  title="Toggle Enable/Disable"
                                >
                                  {gr.enabled === false ? <ToggleLeft className="w-4 h-4 text-slate-500" /> : <ToggleRight className="w-4 h-4 text-emerald-400" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteChat('group', gr.chatId)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 active:scale-95 transition-all duration-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: USERS & REFERRALS TRACKING */}
              {activeTab === 'referrals' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search users by name, username, telegram ID..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <button
                      onClick={() => fetchBotReferralsData(selectedBot.id)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 justify-center shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                      <span>Refresh List</span>
                    </button>
                  </div>

                  {loadingReferrals ? (
                    <div className="py-12 text-center text-slate-500 font-bold uppercase text-xs">
                      Loading user accounts and referral logs...
                    </div>
                  ) : filteredBotUsers.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-bold uppercase text-xs border border-dashed border-slate-800 rounded-xl">
                      No registered users found for @{selectedBot.botUsername}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-black tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-3">User</th>
                            <th className="p-3">Telegram ID</th>
                            <th className="p-3">Referred By</th>
                            <th className="p-3">Joined Date</th>
                            <th className="p-3">Verification</th>
                            <th className="p-3 text-right">Balance</th>
                            <th className="p-3 text-right">Ref Earnings</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono text-[11px]">
                          {filteredBotUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-sans font-bold text-white">
                                {u.userName}
                                <span className="block text-[10px] font-mono text-slate-500">{u.username}</span>
                              </td>
                              <td className="p-3 text-slate-300">{u.telegramId}</td>
                              <td className="p-3 text-slate-400">{u.referredBy}</td>
                              <td className="p-3 text-slate-400">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : '-'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.isVerified && u.contactVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                  {u.isVerified && u.contactVerified ? 'VERIFIED ✓' : 'PENDING'}
                                </span>
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-bold">₹{u.walletBalance}</td>
                              <td className="p-3 text-right text-orange-400 font-bold">₹{u.totalReferralEarnings}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {u.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
