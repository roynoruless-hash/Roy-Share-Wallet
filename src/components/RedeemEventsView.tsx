import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Play,
  Edit,
  Copy,
  BarChart3,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Send,
  Lock,
  Unlock,
  Pause,
  StopCircle,
  AlertTriangle,
  Trophy,
  Download,
  Share2,
  Archive,
  UserCheck,
  ShieldCheck,
  Zap,
  Radio,
  Eye,
} from 'lucide-react';
import { AdminConfig } from '../types';

interface RedeemCodeItem {
  id: string;
  code: string;
  prize: number;
  uses: number;
  maxUses: number;
  expiryMinutes: number;
  createdAt: string;
  status: 'Waiting' | 'Running' | 'Ended' | 'Expired';
  isGolden?: boolean;
  isFlash?: boolean;
}

interface RedeemEventsViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RedeemEventsView: React.FC<RedeemEventsViewProps> = ({ config, showToast }) => {
  // Navigation sub-view mode: 'manager' | 'wizard' | 'live' | 'winners'
  const [activeView, setActiveView] = useState<'manager' | 'wizard' | 'live' | 'winners'>('manager');

  // Redeem Codes State
  const [codes, setCodes] = useState<RedeemCodeItem[]>([]);

  // Selected Code for Live/Winners
  const [activeCode, setActiveCode] = useState<RedeemCodeItem>({
    id: '',
    code: '',
    prize: 0,
    uses: 0,
    maxUses: 0,
    expiryMinutes: 0,
    createdAt: '',
    status: 'Waiting',
  });

  // ----------------------------------------------------
  // WIZARD FORM STATE (5 STEPS)
  // ----------------------------------------------------
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizardCode, setWizardCode] = useState('ROY500');
  const [wizardPrize, setWizardPrize] = useState<number>(500);
  const [wizardLimit, setWizardLimit] = useState<number>(100);
  const [wizardExpiry, setWizardExpiry] = useState<number>(15);
  const [wizardIsGolden, setWizardIsGolden] = useState(true);
  const [wizardIsFlash, setWizardIsFlash] = useState(false);

  // Step 2: Destination
  const [destMainChannel, setDestMainChannel] = useState(true);
  const [destMainGroup, setDestMainGroup] = useState(true);
  const [destAdditional, setDestAdditional] = useState<string[]>(['group_deals', 'vip_channel']);

  // Step 3: Lobby Settings
  const [lobbyReadyLimit, setLobbyReadyLimit] = useState<number>(50);
  const [lobbyCountdown, setLobbyCountdown] = useState<number>(30);
  const [lobbyGhostMode, setLobbyGhostMode] = useState(false);
  const [lobbyClaimMode, setLobbyClaimMode] = useState<'FCFS' | 'Random' | 'Hybrid'>('FCFS');

  // ----------------------------------------------------
  // LIVE EVENT STATE
  // ----------------------------------------------------
  const [liveStatus, setLiveStatus] = useState<'RUNNING' | 'PAUSED' | 'LOCKED' | 'ENDED'>('RUNNING');
  const [liveReadyCount, setLiveReadyCount] = useState(0);
  const [liveOnlineCount, setLiveOnlineCount] = useState(0);
  const [liveWaitingCount, setLiveWaitingCount] = useState(0);
  const [liveClaimedCount, setLiveClaimedCount] = useState(0);
  const [liveRequestsPerSec, setLiveRequestsPerSec] = useState(0);
  const [liveActivityLogs, setLiveActivityLogs] = useState<Array<{ id: string; time: string; text: string; type: 'claim' | 'join' | 'system' }>>([]);

  // ----------------------------------------------------
  // WINNERS STATE
  // ----------------------------------------------------
  const [winners, setWinners] = useState<any[]>([]);

  const fetchCodesHistory = async () => {
    try {
      const res = await fetch('/api/live-event/history');
      const data = await res.json();
      if (data.success && data.history) {
        const mappedCodes = data.history.map((h: any) => ({
          id: h.id || h.eventId || `rc-${Date.now()}-${Math.random()}`,
          code: h.code || h.primaryCode || '',
          prize: h.prize || h.rewardAmount || 0,
          uses: h.claimedCount || 0,
          maxUses: h.totalCodesCount || h.maxUses || 0,
          expiryMinutes: h.durationMinutes || 15,
          createdAt: h.createdAt ? new Date(h.createdAt).toISOString().replace('T', ' ').substring(0, 16) : '',
          status: h.eventStatus === 'ENDED' ? 'Ended' : h.eventStatus === 'LOCKED' ? 'Expired' : 'Running',
          isGolden: h.isGolden || false,
          isFlash: h.isFlash || false,
        }));
        setCodes(mappedCodes);
        if (mappedCodes.length > 0 && !activeCode.code) {
          setActiveCode(mappedCodes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch codes history:', err);
    }
  };

  const fetchLiveEventStats = async () => {
    try {
      const res = await fetch('/api/live-event/active?userId=admin');
      const data = await res.json();
      if (data.success && data.activeEvent) {
        const ae = data.activeEvent;
        setLiveReadyCount(ae.readyCount || 0);
        setLiveOnlineCount(ae.onlineUsersCount || 0);
        setLiveWaitingCount(Math.max(0, (ae.onlineUsersCount || 0) - (ae.claimedCount || 0)));
        setLiveClaimedCount(ae.claimedCount || 0);
        setLiveRequestsPerSec(ae.requestsPerSecond || 0);
        setLiveStatus(ae.eventStatus || 'RUNNING');

        // Update activeCode with live parameters if matched
        setActiveCode((prev) => ({
          ...prev,
          code: ae.code || prev.code || '',
          prize: ae.prize || ae.rewardAmount || prev.prize || 0,
          uses: ae.claimedCount || 0,
          maxUses: ae.totalCodesCount || ae.maxUses || prev.maxUses || 0,
        }));

        if (ae.activityFeed && ae.activityFeed.length > 0) {
          const logs = ae.activityFeed.map((item: any) => ({
            id: item.id || `log-${Math.random()}`,
            time: item.time || new Date().toLocaleTimeString(),
            text: item.text || '',
            type: item.type || 'system'
          }));
          setLiveActivityLogs(logs);
        } else {
          setLiveActivityLogs([]);
        }

        if (ae.winnersTimeline && ae.winnersTimeline.length > 0) {
          const mappedWinners = ae.winnersTimeline.map((winner: any, index: number) => ({
            id: winner.uid || `winner-${index}`,
            rank: index + 1,
            name: winner.userName || winner.telegramId || 'User',
            username: winner.username || (winner.userName ? `@${winner.userName}` : `@User`),
            uid: winner.uid || '',
            claimTime: `${winner.typingSpeedSec || 0}s`,
            typingSpeed: `${winner.wpm || 0} WPM`,
            prize: winner.prize || ae.prize || 0,
            avatar: winner.avatar || '👑',
            status: winner.status || 'VERIFIED_HUMAN'
          }));
          setWinners(mappedWinners);
        } else {
          setWinners([]);
        }
      } else {
        setLiveReadyCount(0);
        setLiveOnlineCount(0);
        setLiveWaitingCount(0);
        setLiveClaimedCount(0);
        setLiveRequestsPerSec(0);
        setLiveActivityLogs([]);
        setWinners([]);
      }
    } catch (err) {
      console.error('Failed to fetch active live event metrics:', err);
    }
  };

  useEffect(() => {
    fetchCodesHistory();
    fetchLiveEventStats();
    const interval = setInterval(fetchLiveEventStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handlers for Code Actions
  const handleCreateNewCode = () => {
    setWizardStep(1);
    setActiveView('wizard');
  };

  const handleDuplicateCode = (item: RedeemCodeItem) => {
    const newCodeItem: RedeemCodeItem = {
      ...item,
      id: `rc-${Date.now()}`,
      code: `${item.code}_COPY`,
      uses: 0,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Waiting',
    };
    setCodes([newCodeItem, ...codes]);
    showToast(`Duplicated code ${newCodeItem.code}`, 'success');
  };

  const handleDeleteCode = (id: string) => {
    setCodes(codes.filter((c) => c.id !== id));
    showToast('Redeem code deleted', 'info');
  };

  const handleLaunchWizard = async () => {
    showToast('🚀 Broadcasting live event to Telegram and initializing...', 'info');

    try {
      const token = localStorage.getItem('adminSessionToken') || '';
      const payload = {
        code: wizardCode,
        maxUses: wizardLimit,
        minReadyUsers: lobbyReadyLimit,
        countdownSeconds: lobbyCountdown,
        durationMinutes: wizardExpiry,
        claimMode: lobbyClaimMode,
        sendToChannel: destMainChannel,
        sendToGroups: destMainGroup,
        miniAppUrl: window.location.origin,
      };

      const res = await fetch('/api/live-event/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({ success: true }));

      if (data.success !== false) {
        showToast('✅ Live event started successfully!', 'success');
        fetchCodesHistory();
        fetchLiveEventStats();
        setActiveView('live');
      } else {
        showToast(`❌ Error starting event: ${data.error || 'Failed'}`, 'error');
      }
    } catch (err: any) {
      showToast(`❌ Error starting event: ${err.message || 'Failed'}`, 'error');
    }
  };

  const handleReleaseCode = async () => {
    showToast('🔓 Releasing code to lobby...', 'info');
    try {
      const token = localStorage.getItem('adminSessionToken') || '';
      const res = await fetch('/api/live-event/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('🔓 Code released to lobby!', 'success');
        fetchLiveEventStats();
      } else {
        showToast(`❌ Error: ${data.error || 'Failed to release code'}`, 'error');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to release code'}`, 'error');
    }
  };

  const handleTogglePause = async () => {
    showToast('Updating event status...', 'info');
    try {
      const token = localStorage.getItem('adminSessionToken') || '';
      const res = await fetch('/api/live-event/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Event status updated!', 'success');
        fetchLiveEventStats();
      } else {
        showToast(`❌ Error: ${data.error || 'Failed to update event status'}`, 'error');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to update event status'}`, 'error');
    }
  };

  const handleEmergencyLock = async () => {
    showToast('🚨 Triggering Emergency Lock...', 'info');
    try {
      const token = localStorage.getItem('adminSessionToken') || '';
      const res = await fetch('/api/live-event/emergency-lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('🚨 Emergency Lock triggered!', 'error');
        fetchLiveEventStats();
      } else {
        showToast(`❌ Error: ${data.error || 'Failed to lock event'}`, 'error');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to lock event'}`, 'error');
    }
  };

  const handleEndLiveEvent = async () => {
    showToast('Ending active live event...', 'info');
    try {
      const token = localStorage.getItem('adminSessionToken') || '';
      const res = await fetch('/api/live-event/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Live Event Ended.', 'success');
        fetchLiveEventStats();
        setActiveView('winners');
      } else {
        showToast(`❌ Error: ${data.error || 'Failed to end live event'}`, 'error');
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to end live event'}`, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans">
      {/* View Header with Sub-navigation */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Redeem Events</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                LIVE LOBBY ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage code drops, launch 5-step wizards, control live lobby speeds, and export winners.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('manager')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeView === 'manager'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Manager
          </button>
          <button
            onClick={() => setActiveView('live')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeView === 'live'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Live Event
          </button>
          <button
            onClick={() => setActiveView('winners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeView === 'winners'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Winners
          </button>

          <button
            onClick={handleCreateNewCode}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 ml-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>NEW REDEEM EVENT</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. REDEEM CODE MANAGER VIEW */}
      {/* ---------------------------------------------------- */}
      {activeView === 'manager' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Active & Historical Redeem Codes ({codes.length})
            </h2>
            <button
              onClick={handleCreateNewCode}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-amber-500/30 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Redeem Code</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {codes.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition shadow-xl space-y-4 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-amber-400 tracking-wider">
                        {item.code}
                      </span>
                      {item.isGolden && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          GOLDEN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Created: {item.createdAt}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      item.status === 'Running'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                        : item.status === 'Waiting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Prize</span>
                    <span className="font-bold text-emerald-400">₹{item.prize}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Uses</span>
                    <span className="font-bold text-white">
                      {item.uses}/{item.maxUses}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Expiry</span>
                    <span className="font-bold text-sky-400">{item.expiryMinutes}m</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => {
                      setActiveCode(item);
                      setActiveView('live');
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center gap-1 border border-emerald-500/30 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Continue</span>
                  </button>
                  <button
                    onClick={() => handleDuplicateCode(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Duplicate Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveCode(item);
                      setActiveView('winners');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 transition"
                    title="View Analytics & Winners"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCode(item.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition"
                    title="Delete Code"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. CREATE EVENT WIZARD (5 STEPS) */}
      {/* ---------------------------------------------------- */}
      {activeView === 'wizard' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
          {/* Stepper Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Create Live Redeem Event Wizard
              </h2>
              <p className="text-xs text-slate-400">Step {wizardStep} of 5</p>
            </div>
            <button
              onClick={() => setActiveView('manager')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
            >
              Cancel
            </button>
          </div>

          {/* Step Progress Bar */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all ${
                  wizardStep >= step ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* STEP 1: Basic Information */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-fade-in max-w-xl mx-auto py-4">
              <h3 className="text-base font-bold text-amber-400">Step 1: Basic Information</h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Redeem Code</label>
                <input
                  type="text"
                  value={wizardCode}
                  onChange={(e) => setWizardCode(e.target.value.toUpperCase())}
                  placeholder="ROY500"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold text-base outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Prize Amount (₹)</label>
                  <input
                    type="number"
                    value={wizardPrize}
                    onChange={(e) => setWizardPrize(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Claim Limit (Users)</label>
                  <input
                    type="number"
                    value={wizardLimit}
                    onChange={(e) => setWizardLimit(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Expiry (Minutes)</label>
                <input
                  type="number"
                  value={wizardExpiry}
                  onChange={(e) => setWizardExpiry(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={wizardIsGolden}
                    onChange={(e) => setWizardIsGolden(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>Golden Code (Highlight)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={wizardIsFlash}
                    onChange={(e) => setWizardIsFlash(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>Flash Mode (High Speed)</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <span>Next: Destination</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Destination */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fade-in max-w-xl mx-auto py-4">
              <h3 className="text-base font-bold text-amber-400">Step 2: Broadcast Destination</h3>

              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <label className="flex items-center justify-between text-xs font-bold text-white cursor-pointer">
                  <span>Main Telegram Channel ({config.mainChannelUsername || '@RoyShareChannel'})</span>
                  <input
                    type="checkbox"
                    checked={destMainChannel}
                    onChange={(e) => setDestMainChannel(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-bold text-white cursor-pointer">
                  <span>Main Telegram Group ({config.mainGroupUsername || '@RoyShareGroup'})</span>
                  <input
                    type="checkbox"
                    checked={destMainGroup}
                    onChange={(e) => setDestMainGroup(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-300">Preview Receivers</span>
                <p className="text-amber-400 font-black text-lg">~14,250 Telegram Members</p>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <span>Next: Lobby Settings</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Lobby Settings */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-fade-in max-w-xl mx-auto py-4">
              <h3 className="text-base font-bold text-amber-400">Step 3: Lobby Settings</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Ready Limit (Users)</label>
                  <input
                    type="number"
                    value={lobbyReadyLimit}
                    onChange={(e) => setLobbyReadyLimit(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Countdown (Seconds)</label>
                  <input
                    type="number"
                    value={lobbyCountdown}
                    onChange={(e) => setLobbyCountdown(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Claim Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['FCFS', 'Random', 'Hybrid'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setLobbyClaimMode(mode)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        lobbyClaimMode === mode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <span>Next: Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Telegram Preview */}
          {wizardStep === 4 && (
            <div className="space-y-4 animate-fade-in max-w-xl mx-auto py-4">
              <h3 className="text-base font-bold text-amber-400">Step 4: Telegram Channel Preview</h3>

              {/* Telegram Post Card Preview */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Radio className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">Telegram Channel Broadcast Message</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-200 font-mono">
                  <p>🎁 <b>Redeem Event is LIVE!</b></p>
                  <p>Code: <code>{wizardCode}</code></p>
                  <p>💰 Prize: ₹{wizardPrize} | 👥 Limit: {wizardLimit} Users</p>
                  <p>⏰ Expiry: {wizardExpiry} Minutes</p>
                  <p className="text-slate-400">Tap below to enter the Waiting Lobby!</p>
                </div>
                <div className="pt-2">
                  <div className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs text-center shadow-lg cursor-pointer">
                    🚀 Open Roy Wallet Bot (Waiting Lobby)
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono text-center mt-1">
                    URL: https://t.me/{(config.botUsername || 'Roy_wallett_bot').replace(/^@/, '')}/roy_share_wallet?startapp=live_event
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(5)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <span>Next: Launch</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Launch */}
          {wizardStep === 5 && (
            <div className="space-y-6 animate-fade-in max-w-xl mx-auto py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-2xl">
                <Zap className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Ready to Launch Live Event!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Clicking below will send the channel message broadcast and start the waiting lobby for code <b>{wizardCode}</b>.
                </p>
              </div>

              <button
                onClick={handleLaunchWizard}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black text-base shadow-2xl shadow-amber-500/30 hover:scale-[1.02] transition"
              >
                🚀 Start Waiting Lobby
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. LIVE EVENT PAGE (ISOLATED SEPARATE VIEW) */}
      {/* ---------------------------------------------------- */}
      {activeView === 'live' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    Live Event: <span className="text-amber-400 font-mono">{activeCode.code}</span>
                  </h2>
                  <p className="text-xs text-slate-400">Prize: ₹{activeCode.prize} | FCFS Mode</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
                {liveStatus}
              </span>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ready Users</span>
                <span className="text-2xl font-black text-amber-400">{liveReadyCount}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Online Users</span>
                <span className="text-2xl font-black text-sky-400">{liveOnlineCount}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Claimed</span>
                <span className="text-2xl font-black text-emerald-400">
                  {activeCode.code ? `${liveClaimedCount}/${activeCode.maxUses}` : '0'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Requests / sec</span>
                <span className="text-2xl font-black text-purple-400">{liveRequestsPerSec} r/s</span>
              </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={handleReleaseCode}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <Unlock className="w-4 h-4" />
                <span>Release Code</span>
              </button>
              <button
                onClick={handleEmergencyLock}
                className="py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-2 border border-rose-500/30"
              >
                <Lock className="w-4 h-4" />
                <span>Emergency Lock</span>
              </button>
              <button
                onClick={handleTogglePause}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center gap-2 border border-slate-700"
              >
                <Pause className="w-4 h-4" />
                <span>Pause / Resume</span>
              </button>
              <button
                onClick={handleEndLiveEvent}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center gap-2 border border-slate-700"
              >
                <StopCircle className="w-4 h-4" />
                <span>End Event</span>
              </button>
            </div>

            {/* Live Activity Feed */}
            <div className="space-y-3 pt-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Activity Stream</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                {liveActivityLogs.length > 0 ? (
                  liveActivityLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">{log.text}</span>
                      <span className="text-slate-500 text-[10px]">{log.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-slate-500 font-bold">
                    Activity Feed: No activity yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. WINNER DASHBOARD (POST EVENT) */}
      {/* ---------------------------------------------------- */}
      {activeView === 'winners' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400" />
                <div>
                  <h2 className="text-lg font-black text-white">Winner Dashboard — {activeCode.code}</h2>
                  <p className="text-xs text-slate-400">Total Prize Pool Awarded: ₹{winners.length * activeCode.prize}</p>
                </div>
              </div>

              {/* Action Buttons: PNG, PDF, Telegram, Archive */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => showToast('PNG Exported!', 'success')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  onClick={() => showToast('PDF Exported!', 'success')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => showToast('Sent Winner Announcement to Telegram!', 'success')}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Telegram</span>
                </button>
                <button
                  onClick={() => showToast('Event Archived!', 'info')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
              </div>
            </div>

            {/* Winner Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {winners.map((winner) => (
                <div key={winner.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-amber-400">#{winner.rank}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {winner.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{winner.avatar}</span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{winner.name}</h4>
                      <p className="text-xs text-sky-400">{winner.username}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Claim Time</span>
                      <span className="font-mono text-white font-bold">{winner.claimTime}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Typing Speed</span>
                      <span className="font-mono text-amber-400 font-bold">{winner.typingSpeed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
