import React, { useState, useEffect } from 'react';
import { AdminConfig, AIBroadcastItem, TelegramChannelItem } from '../types';
import { getTelegramChannels } from '../services/channelService';
import { TelegramDestinationManager } from './TelegramDestinationManager';
import {
  Sparkles,
  Key,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  Copy,
  Clock,
  Gift,
  Radio,
  AlertCircle,
  Bot,
  Zap,
  Check,
  ExternalLink,
  Calendar,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';

interface AIBroadcastViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AIBroadcastView: React.FC<AIBroadcastViewProps> = ({ config, showToast }) => {
  // 1. Gemini Key State
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'invalid'>('idle');
  const [connectionError, setConnectionError] = useState('');

  // 2. Broadcast Type & Redeem Code Inputs
  const [broadcastType, setBroadcastType] = useState<'redeem_code' | 'active_alert'>('redeem_code');
  const [redeemCodeInput, setRedeemCodeInput] = useState('ROY500');
  const [customInstructions, setCustomInstructions] = useState('');

  // Redeem Code Settings
  const [expiryTime, setExpiryTime] = useState('30 Mins');
  const [maxUses, setMaxUses] = useState<number>(500);
  const [remainingUses, setRemainingUses] = useState<number>(230);
  const [showLimitBadges, setShowLimitBadges] = useState(true);

  // 3. Schedule Broadcast State
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [countdownText, setCountdownText] = useState<string>('');

  // 4. Message Generation & Editing
  const [isGenerating, setIsGenerating] = useState(false);
  const [editableMessage, setEditableMessage] = useState('');

  // Inline Buttons State
  const botUsername = config.botUsername || 'RoyShareBot';
  const mainChannel = config.mainChannelUsername ? config.mainChannelUsername.replace(/^@/, '') : 'RoyShareOfficial';

  const [inlineButtons, setInlineButtons] = useState([
    {
      id: 'redeem_now',
      label: '🎁 Redeem Now',
      url: `https://t.me/${botUsername}?start=redeem_${redeemCodeInput}`,
      enabled: true,
    },
    {
      id: 'open_bot',
      label: '🤖 Open Bot',
      url: `https://t.me/${botUsername}`,
      enabled: true,
    },
    {
      id: 'join_channel',
      label: '📢 Join Channel',
      url: `https://t.me/${mainChannel}`,
      enabled: true,
    },
  ]);

  // 5. Test Broadcast State
  const [testTelegramId, setTestTelegramId] = useState<string>(config.adminTelegramId || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testApproved, setTestApproved] = useState(false);

  // 6. Telegram Destinations Selection
  const [destinations, setDestinations] = useState<TelegramChannelItem[]>([]);
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);

  // 7. Live Delivery Report
  const [isSending, setIsSending] = useState(false);
  const [lastDeliveryReport, setLastDeliveryReport] = useState<{
    totalSent: number;
    delivered: number;
    failed: number;
    successRate: number;
    telegramMessageId?: string | number;
    isTest?: boolean;
    isScheduled?: boolean;
    destinationResults?: Array<{
      id: string;
      displayName: string;
      username: string;
      chatId: string;
      type: 'channel' | 'group';
      success: boolean;
      error?: string;
    }>;
  } | null>(null);

  const [copiedCodeState, setCopiedCodeState] = useState(false);

  // 8. History Log
  const [historyList, setHistoryList] = useState<AIBroadcastItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch dynamic destinations from Firestore
  const fetchDestinations = async () => {
    setIsLoadingDestinations(true);
    try {
      let list = await getTelegramChannels();
      if (list.length === 0 && (config.mainChannelUsername || config.mainGroupUsername)) {
        list = [];
        if (config.mainChannelUsername) {
          list.push({
            id: 'channel_1',
            type: 'channel',
            displayName: 'Main Channel',
            username: config.mainChannelUsername,
            chatId: config.mainChannelUsername,
            required: true,
            active: true,
            position: 0,
            createdAt: new Date().toISOString(),
            status: 'verified',
          });
        }
        if (config.mainGroupUsername) {
          list.push({
            id: 'group_1',
            type: 'group',
            displayName: 'Main Group',
            username: config.mainGroupUsername,
            chatId: config.mainGroupUsername,
            required: true,
            active: true,
            position: 1,
            createdAt: new Date().toISOString(),
            status: 'verified',
          });
        }
      }

      setDestinations(list);
      const activeIds = list.filter((d) => d.active).map((d) => d.id);
      setSelectedDestinationIds(activeIds);
    } catch (err: any) {
      console.error('Error loading destinations for broadcast:', err);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  const handleToggleSelectAllDestinations = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedDestinationIds(destinations.map((d) => d.id));
    } else {
      setSelectedDestinationIds([]);
    }
  };

  const handleToggleDestination = (id: string) => {
    if (selectedDestinationIds.includes(id)) {
      setSelectedDestinationIds(selectedDestinationIds.filter((dId) => dId !== id));
    } else {
      setSelectedDestinationIds([...selectedDestinationIds, id]);
    }
  };

  // Channel fallback options from config
  const channelOption = config.mainChannelUsername ? `@${config.mainChannelUsername.replace(/^@/, '')}` : '';
  const groupOption = config.mainGroupUsername ? `@${config.mainGroupUsername.replace(/^@/, '')}` : '';

  // Initial Fetch
  useEffect(() => {
    fetchConfig();
    fetchHistory();
    fetchDestinations();
  }, []);

  // Update button URLs when redeem code or bot username changes
  useEffect(() => {
    setInlineButtons((prev) =>
      prev.map((btn) => {
        if (btn.id === 'redeem_now') {
          return { ...btn, url: `https://t.me/${botUsername}?start=redeem_${redeemCodeInput}` };
        }
        return btn;
      })
    );
  }, [redeemCodeInput, botUsername]);

  // Countdown timer effect for scheduled broadcast
  useEffect(() => {
    if (scheduleMode !== 'later' || !scheduledDateTime) {
      setCountdownText('');
      return;
    }

    const interval = setInterval(() => {
      const targetTime = new Date(scheduledDateTime).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setCountdownText('⏰ Scheduled time reached! Ready to send.');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`⏳ Scheduled in: ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduleMode, scheduledDateTime]);

  // Check for duplicate code in history
  const duplicateBroadcast = historyList.find(
    (item) =>
      broadcastType === 'redeem_code' &&
      item.type === 'redeem_code' &&
      item.redeemCode &&
      item.redeemCode.toUpperCase() === redeemCodeInput.trim().toUpperCase()
  );

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/ai-broadcast/config');
      const data = await res.json();
      if (data.success && data.geminiApiKey) {
        setGeminiKey(data.geminiApiKey);
        testKeyConnection(data.geminiApiKey);
      }
    } catch (err) {
      console.error('Failed to load Gemini API key config:', err);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/ai-broadcast/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistoryList(data.history);
      }
    } catch (err) {
      console.error('Failed to fetch broadcast history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveKey = async () => {
    if (!geminiKey.trim()) {
      showToast('Please enter a valid Gemini API Key', 'error');
      return;
    }
    setIsSavingKey(true);
    try {
      const res = await fetch('/api/ai-broadcast/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Gemini API Key saved successfully', 'success');
        testKeyConnection(geminiKey.trim());
      } else {
        showToast(data.error || 'Failed to save Gemini API key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving API key', 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  const testKeyConnection = async (keyToTest?: string) => {
    setIsTestingKey(true);
    setConnectionError('');
    try {
      const res = await fetch('/api/ai-broadcast/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: keyToTest || geminiKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('connected');
        showToast('✅ Gemini API Connected Successfully', 'success');
      } else {
        setConnectionStatus('invalid');
        setConnectionError(data.error || 'Invalid API Key');
        showToast(data.error || 'Gemini Connection Failed', 'error');
      }
    } catch (err: any) {
      setConnectionStatus('invalid');
      setConnectionError(err.message || 'Network error');
      showToast('Connection test failed', 'error');
    } finally {
      setIsTestingKey(false);
    }
  };

  // Generate AI Message
  const handleGenerateMessage = async () => {
    if (broadcastType === 'redeem_code' && !redeemCodeInput.trim()) {
      showToast('Please enter a Redeem Code', 'error');
      return;
    }

    setIsGenerating(true);
    setLastDeliveryReport(null);
    try {
      const res = await fetch('/api/ai-broadcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: broadcastType,
          redeemCode: redeemCodeInput.trim().toUpperCase(),
          customInstructions: customInstructions.trim(),
          apiKey: geminiKey.trim(),
          redeemSettings: {
            expiryTime,
            maxUses,
            remainingUses,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.variants) {
        let initialText = data.variants.variantA || data.variants.variantB || '';
        if (broadcastType === 'redeem_code' && showLimitBadges) {
          initialText += `\n\n⚠️ <b>Limited Code:</b> ${remainingUses} Uses Left!\n🔥 <b>Expires:</b> ${expiryTime}`;
        }
        setEditableMessage(initialText);
        showToast('✨ AI Message Generated Successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to generate message using Gemini API', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error calling AI generator', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Test Broadcast to Admin Bot
  const handleSendTestBroadcast = async () => {
    if (!editableMessage.trim()) {
      showToast('Cannot send an empty broadcast message', 'error');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/ai-broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: broadcastType,
          redeemCode: broadcastType === 'redeem_code' ? redeemCodeInput.trim().toUpperCase() : 'N/A',
          message: editableMessage.trim(),
          targetChat: testTelegramId || channelOption || groupOption,
          sentByAdmin: 'Admin (Test)',
          inlineButtons: inlineButtons.filter((b) => b.enabled),
          isTestSend: true,
          testTelegramId: testTelegramId.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestApproved(true);
        setLastDeliveryReport({
          totalSent: 1,
          delivered: 1,
          failed: 0,
          successRate: 100,
          telegramMessageId: data.telegramMessageId,
          isTest: true,
        });
        showToast('🧪 Test Broadcast Sent to Admin Bot!', 'success');
      } else {
        showToast(data.error || 'Failed to send test broadcast', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error sending test broadcast', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Send Live Broadcast
  const handleSendLiveBroadcast = async () => {
    if (!editableMessage.trim()) {
      showToast('Cannot send an empty broadcast message', 'error');
      return;
    }

    if (scheduleMode === 'later' && !scheduledDateTime) {
      showToast('Please select a Date & Time for scheduled broadcast', 'error');
      return;
    }

    setIsSending(true);
    setLastDeliveryReport(null);
    try {
      const targetDestinations = destinations.filter((d) => selectedDestinationIds.includes(d.id));

      const res = await fetch('/api/ai-broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: broadcastType,
          redeemCode: broadcastType === 'redeem_code' ? redeemCodeInput.trim().toUpperCase() : 'N/A',
          message: editableMessage.trim(),
          targetChat: channelOption || groupOption,
          selectedDestinations: targetDestinations,
          sentByAdmin: 'Admin',
          targetAudience: 'All Users',
          inlineButtons: inlineButtons.filter((b) => b.enabled),
          scheduleMode,
          scheduledFor: scheduledDateTime,
          redeemSettings: {
            expiryTime,
            maxUses,
            remainingUses,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.isScheduled) {
          showToast(`⏰ Broadcast Scheduled for ${new Date(scheduledDateTime).toLocaleString()}`, 'success');
          setLastDeliveryReport({
            totalSent: 0,
            delivered: 0,
            failed: 0,
            successRate: 100,
            isScheduled: true,
          });
        } else {
          showToast('🚀 Broadcast Sent Successfully to Telegram!', 'success');
          setLastDeliveryReport({
            totalSent: data.deliveryStats?.totalSent || targetDestinations.length || 1,
            delivered: data.deliveryStats?.delivered || targetDestinations.length || 1,
            failed: data.deliveryStats?.failed || 0,
            successRate: data.deliveryStats?.successRate || 100,
            telegramMessageId: data.telegramMessageId,
            destinationResults: data.destinationResults || [],
          });
        }
        fetchHistory();
      } else {
        showToast(data.error || 'Failed to send broadcast message to Telegram', 'error');
        if (data.destinationResults) {
          setLastDeliveryReport({
            totalSent: data.deliveryStats?.totalSent || 0,
            delivered: data.deliveryStats?.delivered || 0,
            failed: data.deliveryStats?.failed || 0,
            successRate: data.deliveryStats?.successRate || 0,
            destinationResults: data.destinationResults,
          });
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Network error sending broadcast', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string, toastLabel = 'Code copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    setCopiedCodeState(true);
    showToast(toastLabel, 'info');
    setTimeout(() => setCopiedCodeState(false), 2000);
  };

  const handleSendAgainFromHistory = (item: AIBroadcastItem) => {
    setBroadcastType(item.type);
    if (item.type === 'redeem_code' && item.redeemCode && item.redeemCode !== 'N/A') {
      setRedeemCodeInput(item.redeemCode);
    }
    setEditableMessage(item.message);
    setTestApproved(false);
    setLastDeliveryReport(null);
    showToast('Loaded message into Broadcast Preview', 'info');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-4 sm:space-y-6 box-border">
      {/* View Title */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              AI Redeem Code Broadcast
            </h1>
            <p className="text-xs text-slate-400">
              Clean mobile-first generator & broadcast station
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Gemini API Settings */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
              1
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Gemini API Settings</span>
            </h2>
          </div>

          {/* Connection Status Pill */}
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : connectionStatus === 'invalid'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Connected
              </>
            ) : connectionStatus === 'invalid' ? (
              <>
                <XCircle className="w-3.5 h-3.5 text-rose-400" /> Invalid Key
              </>
            ) : (
              <>Unconfigured</>
            )}
          </span>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300 block">
            Gemini API Key
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500 box-border"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={isSavingKey || !geminiKey.trim()}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                <span>Save Key</span>
              </button>

              <button
                type="button"
                onClick={() => testKeyConnection()}
                disabled={isTestingKey || !geminiKey.trim()}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTestingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Test Key</span>
              </button>
            </div>
          </div>

          {connectionError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{connectionError}</span>
            </p>
          )}
        </div>
      </div>

      {/* SECTION 2: Telegram Destinations (Add / Edit / Delete / Test) */}
      <div className="w-full max-w-full overflow-hidden box-border">
        <TelegramDestinationManager
          config={config}
          showToast={showToast}
          onDestinationsUpdated={fetchDestinations}
        />
      </div>

      {/* SECTION 3: Redeem Code Input */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
            3
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Redeem Code Settings</span>
          </h2>
        </div>

        {duplicateBroadcast && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Warning:</strong> Code "{redeemCodeInput.trim().toUpperCase()}" was already broadcasted.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Redeem Code
            </label>
            <input
              type="text"
              value={redeemCodeInput}
              onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
              placeholder="ROY500"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none focus:border-emerald-500 box-border"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Code Expiry Time
            </label>
            <select
              value={expiryTime}
              onChange={(e) => setExpiryTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 box-border"
            >
              <option value="15 Mins">⚡ 15 Minutes</option>
              <option value="30 Mins">🔥 30 Minutes</option>
              <option value="1 Hour">⏰ 1 Hour</option>
              <option value="6 Hours">🕒 6 Hours</option>
              <option value="24 Hours">📅 24 Hours</option>
              <option value="No Expiry">♾️ No Expiry</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Max / Remaining Uses
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                placeholder="Max"
                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 box-border"
              />
              <input
                type="number"
                value={remainingUses}
                onChange={(e) => setRemainingUses(Number(e.target.value))}
                placeholder="Left"
                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 box-border"
              />
            </div>
          </div>
        </div>

        {/* Preset Codes & Limit Badge Checkbox */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showLimitBadges}
              onChange={(e) => setShowLimitBadges(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
            />
            <span>Auto-append limit badges in message</span>
          </label>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
            {['ROY500', 'FREE100', 'WELCOME50', 'LUCKY888'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setRedeemCodeInput(code)}
                className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: Generate AI Message */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
            4
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Generate AI Broadcast Message</span>
          </h2>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1">
            Custom Instructions / Prompt Note (Optional)
          </label>
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Highlight 500 bonus points for first 50 claimers..."
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 box-border"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerateMessage}
          disabled={isGenerating}
          className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300" />
          )}
          <span>{isGenerating ? 'Generating AI Broadcast Message...' : '✨ Generate AI Message'}</span>
        </button>

        {/* Message Editor */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-slate-300 block">
            Generated Broadcast Message (Editable)
          </label>
          <textarea
            rows={5}
            value={editableMessage}
            onChange={(e) => setEditableMessage(e.target.value)}
            placeholder="AI message preview will appear here..."
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-sky-500 box-border"
          />
        </div>
      </div>

      {/* SECTION 5: Telegram Preview */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
            5
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <span>Telegram Live Preview</span>
          </h2>
        </div>

        {/* Mobile-style Telegram Preview Frame */}
        <div className="p-4 rounded-2xl bg-[#0b1329] border border-sky-500/30 shadow-inner space-y-3 w-full max-w-full overflow-hidden box-border">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white truncate">Roy Share Bot</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/20 shrink-0">
              HTML Format
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#131d38] text-xs text-slate-100 whitespace-pre-wrap leading-relaxed break-words font-sans">
            {editableMessage || 'Generated Telegram message preview will appear here...'}
          </div>

          {/* Inline Buttons Preview */}
          <div className="space-y-1.5 pt-1">
            {inlineButtons
              .filter((b) => b.enabled)
              .map((btn) => (
                <a
                  key={btn.id}
                  href={btn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700/90 text-sky-300 border border-sky-500/20 transition flex items-center justify-center gap-1.5 text-center truncate box-border"
                >
                  <span>{btn.label}</span>
                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                </a>
              ))}
          </div>

          {/* Quick Copy Redeem Code button */}
          {redeemCodeInput.trim() && (
            <button
              type="button"
              onClick={() =>
                copyToClipboard(redeemCodeInput.trim().toUpperCase(), `Code '${redeemCodeInput.trim().toUpperCase()}' copied!`)
              }
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 shadow-sm transition flex items-center justify-center gap-1.5"
            >
              {copiedCodeState ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>Copy Redeem Code ({redeemCodeInput.trim().toUpperCase()})</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 6: Send Test */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
            6
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Send Test Message</span>
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={testTelegramId}
              onChange={(e) => setTestTelegramId(e.target.value)}
              placeholder="Admin Telegram Chat ID e.g. -1001234567"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500 box-border"
            />

            <button
              type="button"
              onClick={handleSendTestBroadcast}
              disabled={isSendingTest || !editableMessage.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
            >
              {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Send Test to Admin Bot</span>
            </button>
          </div>

          {testApproved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Test broadcast verified on Admin Bot. Ready to send live.</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 7: Send Broadcast */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
              7
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Send Broadcast</span>
            </h2>
          </div>

          {/* Send to All checkbox toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={destinations.length > 0 && selectedDestinationIds.length === destinations.length}
              onChange={(e) => handleToggleSelectAllDestinations(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
            />
            <span className="font-bold">Send to All ({selectedDestinationIds.length})</span>
          </label>
        </div>

        {/* Schedule Mode Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setScheduleMode('now')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                scheduleMode === 'now' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Send Now</span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleMode('later')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                scheduleMode === 'later' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Later</span>
            </button>
          </div>

          {scheduleMode === 'later' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500 box-border"
              />
              {countdownText && (
                <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-500/10 p-2 rounded-lg">
                  {countdownText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Selected Destinations Chip Selector */}
        {isLoadingDestinations ? (
          <p className="text-xs text-slate-400 flex items-center gap-2 py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" /> Loading destinations...
          </p>
        ) : destinations.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {destinations.map((dest) => {
              const isChecked = selectedDestinationIds.includes(dest.id);
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => handleToggleDestination(dest.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    isChecked
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 pointer-events-none"
                  />
                  <span className="truncate max-w-[140px]">{dest.displayName}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No Telegram destinations configured yet. Add them in Section 2 above.</p>
        )}

        {/* Delivery Report Card */}
        {lastDeliveryReport && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{lastDeliveryReport.isScheduled ? '⏰ Broadcast Scheduled' : '🚀 Delivery Report'}</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-400">
                {lastDeliveryReport.delivered} / {lastDeliveryReport.totalSent} Sent ({lastDeliveryReport.successRate}%)
              </span>
            </div>

            {lastDeliveryReport.destinationResults && (
              <div className="space-y-1 pt-1 border-t border-emerald-500/20">
                {lastDeliveryReport.destinationResults.map((dest, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 truncate mr-2">{dest.displayName}</span>
                    <span className={dest.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {dest.success ? '✅ Delivered' : '❌ Failed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleSendLiveBroadcast}
          disabled={isSending || !editableMessage.trim() || selectedDestinationIds.length === 0}
          className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : scheduleMode === 'later' ? (
            <Calendar className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>
            {scheduleMode === 'later'
              ? '⏰ Confirm & Schedule Broadcast'
              : `🚀 Send Broadcast to ${selectedDestinationIds.length} Destination(s)`}
          </span>
        </button>
      </div>

      {/* SECTION 8: Broadcast History */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
              8
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Broadcast History</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            disabled={isLoadingHistory}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            title="Refresh History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {historyList.length === 0 ? (
          <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
            No broadcast history recorded yet.
          </div>
        ) : (
          <div>
            {/* Mobile Cards List (Visible on Mobile) */}
            <div className="space-y-3 sm:hidden">
              {historyList.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(item.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {item.redeemCode && item.redeemCode !== 'N/A' && (
                    <div className="font-mono font-bold text-amber-400 text-xs">
                      Code: {item.redeemCode}
                    </div>
                  )}

                  <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                    {item.redeemCode && item.redeemCode !== 'N/A' && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.redeemCode!, `Copied code ${item.redeemCode}`)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy Code
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSendAgainFromHistory(item)}
                      className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Load & Send
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden sm:block overflow-x-auto w-full max-w-full">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Message</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {item.redeemCode || 'N/A'}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-300" title={item.message}>
                        {item.message}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.status === 'Success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.redeemCode && item.redeemCode !== 'N/A' && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.redeemCode!, `Copied code ${item.redeemCode}`)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                              title="Copy Code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSendAgainFromHistory(item)}
                            className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Load & Send</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
