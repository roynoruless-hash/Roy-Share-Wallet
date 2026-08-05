import React, { useState, useEffect } from 'react';
import { AdminConfig, AIBroadcastItem, TelegramChannelItem, TelegramApiLogEntry, BroadcastCategoryReports } from '../types';
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
  AlertCircle,
  Bot,
  Zap,
  Check,
  Eye,
  EyeOff,
  ShieldAlert,
  Terminal,
  FileText,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Trophy,
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
  const [expiryTime, setExpiryTime] = useState('15 Minutes');
  const [maxUses, setMaxUses] = useState<number>(500);
  const [remainingUses, setRemainingUses] = useState<number>(230);
  const [showLimitBadges, setShowLimitBadges] = useState(true);

  // 3. Message Generation & Editing
  const [isGenerating, setIsGenerating] = useState(false);
  const [editableMessage, setEditableMessage] = useState(
    `🎁 Redeem Code is Live!\n\nCode:\n<code>ROY500</code>\n\n⏰ Valid: 15 Minutes\n👤 First Come First Serve\n\nClaim now and don't forget to share your screenshot.`
  );

  // 4. Send Section Destination Checkboxes
  const [sendToBot, setSendToBot] = useState(true);
  const [sendToMainChannel, setSendToMainChannel] = useState(true);
  const [sendToMainGroup, setSendToMainGroup] = useState(true);
  const [sendToAdditionalChannels, setSendToAdditionalChannels] = useState(true);

  // Destinations from Firestore
  const [destinations, setDestinations] = useState<TelegramChannelItem[]>([]);
  const [selectedAdditionalChannelIds, setSelectedAdditionalChannelIds] = useState<string[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);

  // Test & Broadcast States
  const [testTelegramId, setTestTelegramId] = useState<string>(config.adminTelegramId || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testApproved, setTestApproved] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copiedCodeState, setCopiedCodeState] = useState(false);

  // Delivery Report & Live Progress
  const [broadcastProgress, setBroadcastProgress] = useState<{
    isBroadcasting: boolean;
    isRetrying: boolean;
    current: number;
    total: number;
    statusText: string;
    sent: number;
    failed: number;
    blocked: number;
    timeTaken: string;
    failedUsers: Array<{ id: string; telegramId: string; name: string; error?: string }>;
    categoryReports?: BroadcastCategoryReports;
    apiLogs?: TelegramApiLogEntry[];
    overallStatus?: 'Success' | 'Partial Success' | 'Failed';
    completed: boolean;
    broadcastRecordId?: string;
  } | null>(null);

  // Telegram API Log Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activeLogTitle, setActiveLogTitle] = useState('Telegram API Log');
  const [activeLogs, setActiveLogs] = useState<TelegramApiLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'bot' | 'channels'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const openApiLogModal = (logs: TelegramApiLogEntry[] = [], title: string = 'Telegram API Log') => {
    setActiveLogs(logs || []);
    setActiveLogTitle(title);
    setLogFilter('all');
    setLogSearchQuery('');
    setExpandedLogId(null);
    setLogModalOpen(true);
  };

  const [lastDeliveryReport, setLastDeliveryReport] = useState<{
    totalSent: number;
    delivered: number;
    failed: number;
    successRate: number;
    destinationResults?: Array<{
      displayName: string;
      success: boolean;
      error?: string;
    }>;
  } | null>(null);

  // History Log
  const [historyList, setHistoryList] = useState<AIBroadcastItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Live Redeem Event States (Phase 2)
  const [liveCodeInput, setLiveCodeInput] = useState('ROY500');
  const [liveMultiCodesText, setLiveMultiCodesText] = useState('');
  const [useMultiCodes, setUseMultiCodes] = useState(false);
  const [liveMinReadyUsers, setLiveMinReadyUsers] = useState<number>(0);
  const [liveCountdownSec, setLiveCountdownSec] = useState(10);
  const [liveMaxUses, setLiveMaxUses] = useState(100);
  const [liveDurationMin, setLiveDurationMin] = useState(15);
  const [liveSendToChannel, setLiveSendToChannel] = useState(true);
  const [liveSendToGroups, setLiveSendToGroups] = useState(true);
  const [liveSendToUsers, setLiveSendToUsers] = useState(false);
  const [liveMiniAppUrl, setLiveMiniAppUrl] = useState('https://t.me/Roy_wallett_bot/roy_share_wallet?startapp=live_event');
  const [isStartingLiveEvent, setIsStartingLiveEvent] = useState(false);
  const [activeLiveEvent, setActiveLiveEvent] = useState<any>(null);
  const [lastBroadcastSummary, setLastBroadcastSummary] = useState<any>(null);

  const fetchLiveEvent = async () => {
    try {
      const res = await fetch('/api/live-event/active?userId=admin');
      const data = await res.json();
      if (data.success && data.activeEvent) {
        setActiveLiveEvent(data.activeEvent);
        if (data.activeEvent.broadcastResult) {
          setLastBroadcastSummary(data.activeEvent.broadcastResult);
        }
      } else {
        setActiveLiveEvent(null);
      }
    } catch (err) {
      console.error('Failed to fetch active live event:', err);
    }
  };

  useEffect(() => {
    fetchLiveEvent();
    const timer = setInterval(fetchLiveEvent, 2000); // 2s live refresh for admin dashboard
    return () => clearInterval(timer);
  }, []);

  const handleStartLiveEvent = async () => {
    let finalCodesPayload: string[] | string = liveCodeInput.trim().toUpperCase();

    if (useMultiCodes) {
      if (!liveMultiCodesText.trim()) {
        showToast('Please enter at least one redeem code in the multi-code box', 'error');
        return;
      }
      finalCodesPayload = liveMultiCodesText
        .split(/[\n,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      if ((finalCodesPayload as string[]).length === 0) {
        showToast('No valid redeem codes provided in list', 'error');
        return;
      }
    } else {
      if (!liveCodeInput.trim()) {
        showToast('Please enter a Redeem Code for the Live Event', 'error');
        return;
      }
    }

    setIsStartingLiveEvent(true);
    setLastBroadcastSummary(null);

    try {
      const res = await fetch('/api/live-event/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: typeof finalCodesPayload === 'string' ? finalCodesPayload : finalCodesPayload[0],
          codesInput: finalCodesPayload,
          maxUses: useMultiCodes && Array.isArray(finalCodesPayload) ? finalCodesPayload.length : liveMaxUses,
          minReadyUsers: liveMinReadyUsers,
          countdownSeconds: liveCountdownSec,
          durationMinutes: liveDurationMin,
          sendToChannel: liveSendToChannel,
          sendToGroups: liveSendToGroups,
          sendToUsers: liveSendToUsers,
          miniAppUrl: liveMiniAppUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.broadcastSummary) {
          setLastBroadcastSummary(data.broadcastSummary);
        }
        showToast('🚀 Live Redeem Event Started & Countdown Synchronized!', 'success');
        fetchLiveEvent();
      } else {
        showToast(data.error || 'Failed to start live redeem event', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error starting live event', 'error');
    } finally {
      setIsStartingLiveEvent(false);
    }
  };

  const handleEndLiveEvent = async () => {
    try {
      const res = await fetch('/api/live-event/end', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Live Redeem Event ended', 'info');
        setActiveLiveEvent(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Error ending live event', 'error');
    }
  };

  const [isReleasingCode, setIsReleasingCode] = useState(false);
  const [isPausingEvent, setIsPausingEvent] = useState(false);

  const handleReleaseLiveEvent = async () => {
    setIsReleasingCode(true);
    try {
      const res = await fetch('/api/live-event/release', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🔓 Redeem Code Released! Input box enabled in Mini App.', 'success');
        fetchLiveEvent();
      } else {
        showToast(data.error || 'Failed to release redeem code', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error releasing redeem code', 'error');
    } finally {
      setIsReleasingCode(false);
    }
  };

  const handlePauseLiveEvent = async () => {
    setIsPausingEvent(true);
    try {
      const res = await fetch('/api/live-event/pause', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Live Redeem Event status updated', 'info');
        fetchLiveEvent();
      } else {
        showToast(data.error || 'Failed to pause/resume event', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating event status', 'error');
    } finally {
      setIsPausingEvent(false);
    }
  };

  const [isEmergencyLocking, setIsEmergencyLocking] = useState(false);

  const handleEmergencyLockLiveEvent = async () => {
    setIsEmergencyLocking(true);
    try {
      const res = await fetch('/api/live-event/emergency-lock', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🚨 Emergency Lock Activated! Inputs & submissions frozen.', 'error');
        fetchLiveEvent();
      } else {
        showToast(data.error || 'Failed to activate emergency lock', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error triggering emergency lock', 'error');
    } finally {
      setIsEmergencyLocking(false);
    }
  };

  const handleExportPNG = () => {
    const winners = activeLiveEvent?.winnersTimeline || [];
    const stats = activeLiveEvent?.summaryStats || {};
    const content = `🏆 LIVE REDEEM EVENT WINNER TIMELINE 🏆\n\n` +
      `Event ID: ${activeLiveEvent?.id || 'N/A'}\n` +
      `Duration: ${stats.eventDurationSec || 0} seconds\n` +
      `Total Participants: ${stats.totalParticipants || 0}\n` +
      `Total Claims: ${stats.totalClaims || 0}\n` +
      `Average Claim Time: ${stats.avgClaimTimeSec || 0}s\n\n` +
      `----------------------------------------\n` +
      `WINNERS:\n` +
      `----------------------------------------\n` +
      winners.map((w: any) => `#${w.rank} ${w.userName} (@${w.telegramId}) - Time: ${w.claimTime} | Speed: ${w.typingSpeedSec}s | Prize: ${w.reward} pts`).join('\n');

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `event_winner_timeline_${activeLiveEvent?.id || Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('📄 Winner Timeline exported as text/summary file!', 'success');
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleShareToTelegram = () => {
    const winners = (activeLiveEvent?.winnersTimeline || []).slice(0, 10);
    const stats = activeLiveEvent?.summaryStats || {};
    const message = `🏆 LIVE EVENT RESULT TIMELINE 🏆\n\n` +
      `📊 Event Summary:\n` +
      `⏱ Duration: ${stats.eventDurationSec || 0}s\n` +
      `👥 Total Participants: ${stats.totalParticipants || 0}\n` +
      `🎁 Total Claims: ${stats.totalClaims || 0}\n` +
      `⚡ Avg Speed: ${stats.avgClaimTimeSec || 0}s\n\n` +
      `🏅 WINNERS:\n` +
      winners.map((w: any) => `${w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : '🏅'} #${w.rank} ${w.userName} (@${w.telegramId}) - ${w.typingSpeedSec}s speed (${w.reward} pts)`).join('\n') +
      `\n\nCongratulations to all winners! 🎉`;

    setEditableMessage(message);
    setBroadcastType('custom_text');
    showToast('✈️ Result summary copied into Broadcast Composer! Scroll down to Send.', 'info');
  };

  // Fetch dynamic destinations from Firestore
  const fetchDestinations = async () => {
    setIsLoadingDestinations(true);
    try {
      const list = await getTelegramChannels();
      setDestinations(list);
      const activeIds = list.filter((d) => d.active).map((d) => d.id);
      setSelectedAdditionalChannelIds(activeIds);
    } catch (err: any) {
      console.error('Error loading destinations for broadcast:', err);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  // Initial Fetch
  useEffect(() => {
    fetchConfig();
    fetchHistory();
    fetchDestinations();
    fetchLiveEvent();

    const interval = setInterval(fetchLiveEvent, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update default message if code changes
  useEffect(() => {
    if (broadcastType === 'redeem_code' && redeemCodeInput.trim()) {
      const code = redeemCodeInput.trim().toUpperCase();
      setEditableMessage(
        `🎁 Redeem Code is Live!\n\nCode:\n<code>${code}</code>\n\n⏰ Valid: ${expiryTime}\n👤 First Come First Serve\n\nClaim now and don't forget to share your screenshot.`
      );
    }
  }, [redeemCodeInput, expiryTime, broadcastType]);

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
        body: JSON.stringify({ apiKey: (keyToTest || geminiKey).trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('invalid');
        setConnectionError(data.error || 'Gemini API Key validation failed.');
      }
    } catch (err: any) {
      setConnectionStatus('invalid');
      setConnectionError(err.message || 'Network error checking Gemini key');
    } finally {
      setIsTestingKey(false);
    }
  };

  // Generate AI Message (Returns ONLY final Telegram-ready message)
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
      if (res.ok && data.success) {
        const cleanMessage = data.message || data.variants?.variantA || '';
        setEditableMessage(cleanMessage);
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
          targetChat: testTelegramId || config.adminTelegramId || config.adminChatId,
          sentByAdmin: 'Admin (Test)',
          isTestSend: true,
          testTelegramId: (testTelegramId || config.adminTelegramId || '').trim(),
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

  // Send Live Broadcast to Checked Destinations & All Registered Users
  const handleSendLiveBroadcast = async () => {
    if (!editableMessage.trim()) {
      showToast('Cannot send an empty broadcast message', 'error');
      return;
    }

    if (!sendToBot && !sendToMainChannel && !sendToMainGroup && selectedAdditionalChannelIds.length === 0) {
      showToast('Please select at least one destination checkbox above', 'error');
      return;
    }

    setIsSending(true);
    setLastDeliveryReport(null);

    try {
      const broadcastRecordId = `bc_${Date.now()}`;
      const startTime = Date.now();

      // Collect channel destinations from selection
      const selectedChannelDests = destinations.filter(d => selectedAdditionalChannelIds.includes(d.id));

      // Call server backend broadcast route with full category flags
      const res = await fetch('/api/ai-broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: broadcastType,
          redeemCode: broadcastType === 'redeem_code' ? redeemCodeInput.trim().toUpperCase() : 'N/A',
          message: editableMessage.trim(),
          sentByAdmin: 'Admin',
          targetAudience: 'Selected Destinations',
          destinationCategoryFlags: {
            sendToBot,
            sendToMainChannel,
            sendToMainGroup,
            sendToAdditionalChannels: selectedAdditionalChannelIds.length > 0,
          },
          selectedDestinations: selectedChannelDests.map(d => ({
            id: d.id,
            displayName: d.displayName,
            chatId: d.chatId || (d.username ? `@${d.username.replace(/^@/, '')}` : ''),
            type: d.type,
          })),
        }),
      });

      const data = await res.json();
      const finalTimeTaken = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      if (data) {
        const catReports: BroadcastCategoryReports = data.categoryReports || {
          botUsers: { selected: sendToBot, sent: 0, failed: 0, blocked: 0, total: 0 },
          mainChannel: { selected: sendToMainChannel, target: config.mainChannelUsername || 'N/A', sent: 0, failed: 0 },
          mainGroup: { selected: sendToMainGroup, target: config.mainGroupUsername || 'N/A', sent: 0, failed: 0 },
          additionalChannels: { selected: selectedAdditionalChannelIds.length > 0, total: selectedChannelDests.length, sent: 0, failed: 0, channelsList: [] },
        };

        const logs: TelegramApiLogEntry[] = data.apiLogs || [];
        const totalTargets = data.report?.totalUsers ?? 0;
        const sentCount = data.report?.sent ?? 0;
        const failedCount = data.report?.failed ?? 0;
        const blockedCount = data.report?.blocked ?? 0;
        const statusVal: 'Success' | 'Partial Success' | 'Failed' = data.status || (failedCount === 0 && sentCount > 0 ? 'Success' : sentCount > 0 ? 'Partial Success' : 'Failed');

        setBroadcastProgress({
          isBroadcasting: false,
          isRetrying: false,
          current: totalTargets,
          total: totalTargets,
          statusText: statusVal === 'Success' ? 'Success' : statusVal === 'Partial Success' ? 'Partial Success' : 'Failed',
          sent: sentCount,
          failed: failedCount,
          blocked: blockedCount,
          timeTaken: finalTimeTaken,
          failedUsers: data.failedUsers || [],
          categoryReports: catReports,
          apiLogs: logs,
          overallStatus: statusVal,
          completed: true,
          broadcastRecordId,
        });

        if (statusVal === 'Success') {
          showToast('🟢 Broadcast Completed Successfully - All Telegram API calls succeeded!', 'success');
        } else if (statusVal === 'Partial Success') {
          showToast('⚠️ Broadcast Completed with Partial Success - Some Telegram API calls failed', 'error');
        } else {
          showToast('❌ Broadcast Failed - Telegram API returned errors', 'error');
        }
      } else {
        showToast('Failed to receive broadcast response', 'error');
      }

      fetchHistory();
    } catch (err: any) {
      showToast(err.message || 'Network error sending broadcast', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Retry failed users
  const handleRetryFailedUsers = async (targetFailedList?: Array<{ id: string; telegramId: string; name: string; error?: string }>, recordId?: string) => {
    const listToRetry = targetFailedList || broadcastProgress?.failedUsers || [];
    if (listToRetry.length === 0) {
      showToast('No failed users to retry', 'info');
      return;
    }

    showToast(`Retrying ${listToRetry.length} failed user(s)...`, 'info');
    const startTime = Date.now();

    let retrySent = 0;
    let retryBlocked = 0;
    const stillFailedUsers: Array<{ id: string; telegramId: string; name: string; error?: string }> = [];

    setBroadcastProgress((prev) =>
      prev
        ? {
            ...prev,
            isRetrying: true,
            statusText: `Retrying 0/${listToRetry.length}`,
          }
        : null
    );

    for (let i = 0; i < listToRetry.length; i++) {
      const u = listToRetry[i];
      setBroadcastProgress((prev) =>
        prev
          ? {
              ...prev,
              statusText: `Retrying ${i + 1}/${listToRetry.length}`,
            }
          : null
      );

      try {
        await new Promise((resolve) => setTimeout(resolve, 35));

        const res = await fetch('/api/ai-broadcast/send-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: u.telegramId,
            message: editableMessage.trim(),
          }),
        });
        const data = await res.json();

        if (data.success) {
          retrySent++;
        } else if (data.isBlocked) {
          retryBlocked++;
        } else {
          stillFailedUsers.push({
            ...u,
            error: data.error || 'Retry failed',
          });
        }
      } catch (err: any) {
        stillFailedUsers.push({
          ...u,
          error: err.message || 'Retry network error',
        });
      }
    }

    setBroadcastProgress((prev) => {
      if (!prev) return null;
      const newSent = prev.sent + retrySent;
      const newBlocked = prev.blocked + retryBlocked;
      const newFailed = stillFailedUsers.length;
      const elapsedSeconds = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      fetch('/api/ai-broadcast/save-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recordId || prev.broadcastRecordId || `bc_${Date.now()}`,
          type: broadcastType,
          redeemCode: broadcastType === 'redeem_code' ? redeemCodeInput.trim().toUpperCase() : 'N/A',
          message: editableMessage.trim(),
          sentByAdmin: 'Admin',
          targetAudience: 'All Registered Users',
          status: 'Completed',
          totalUsers: prev.total,
          sent: newSent,
          failed: newFailed,
          blocked: newBlocked,
          timeTaken: elapsedSeconds,
          failedUsers: stillFailedUsers,
          timestamp: new Date().toISOString(),
        }),
      }).then(() => fetchHistory());

      return {
        ...prev,
        isRetrying: false,
        sent: newSent,
        blocked: newBlocked,
        failed: newFailed,
        failedUsers: stillFailedUsers,
        statusText: stillFailedUsers.length === 0 ? 'All Retries Succeeded' : 'Retry Completed',
      };
    });

    if (stillFailedUsers.length === 0) {
      showToast('🎉 All retried messages delivered successfully!', 'success');
    } else {
      showToast(`Retry finished. Delivered: ${retrySent}, Still Failed: ${stillFailedUsers.length}`, 'info');
    }
  };

  const copyToClipboard = (text: string, toastMsg: string) => {
    navigator.clipboard.writeText(text);
    showToast(toastMsg, 'info');
    setCopiedCodeState(true);
    setTimeout(() => setCopiedCodeState(false), 2000);
  };

  const handleSendAgainFromHistory = (item: AIBroadcastItem) => {
    if (item.redeemCode && item.redeemCode !== 'N/A') {
      setRedeemCodeInput(item.redeemCode);
      setBroadcastType('redeem_code');
    } else {
      setBroadcastType('active_alert');
    }
    setEditableMessage(item.message);
    showToast('Loaded message into generator', 'info');
  };

  const now = Date.now();
  const effectiveUnlockTime = activeLiveEvent?.unlockAt || activeLiveEvent?.unlockTime || activeLiveEvent?.unlocksAt || now;
  const countdownSec = Math.max(0, Math.ceil((effectiveUnlockTime - now) / 1000));
  const countdownText = activeLiveEvent?.eventStatus === 'WAITING_FOR_READY'
    ? 'Waiting'
    : countdownSec > 0
    ? `${countdownSec}s Left`
    : 'Unlocked';

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden box-border font-sans text-slate-100">
      {/* SECTION 1: Gemini API Key Config */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3 box-border">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
              1
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Gemini AI Engine Settings</span>
            </h2>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : connectionStatus === 'invalid'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Connected
              </>
            ) : connectionStatus === 'invalid' ? (
              <>
                <XCircle className="w-3 h-3 text-rose-400" /> Invalid Key
              </>
            ) : (
              <>Unconfigured</>
            )}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Gemini API Key</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500 box-border"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={isSavingKey || !geminiKey.trim()}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                <span>Save Key</span>
              </button>

              <button
                type="button"
                onClick={() => testKeyConnection()}
                disabled={isTestingKey || !geminiKey.trim()}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTestingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Test Key</span>
              </button>
            </div>
          </div>

          {connectionError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{connectionError}</span>
            </p>
          )}
        </div>
      </div>

      {/* SECTION 2: Redeem Code Settings */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3 box-border">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
            2
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Redeem Code Settings</span>
          </h2>
        </div>

        {duplicateBroadcast && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Warning:</strong> Code "{redeemCodeInput.trim().toUpperCase()}" was already broadcasted.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Redeem Code</label>
            <input
              type="text"
              value={redeemCodeInput}
              onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
              placeholder="ROY500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none focus:border-emerald-500 box-border"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Code Expiry Time</label>
            <select
              value={expiryTime}
              onChange={(e) => setExpiryTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 box-border"
            >
              <option value="15 Minutes">⚡ 15 Minutes</option>
              <option value="30 Minutes">🔥 30 Minutes</option>
              <option value="1 Hour">⏰ 1 Hour</option>
              <option value="6 Hours">🕒 6 Hours</option>
              <option value="24 Hours">📅 24 Hours</option>
              <option value="No Expiry">♾️ No Expiry</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Max / Remaining Uses</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                placeholder="Max"
                className="w-1/2 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 box-border"
              />
              <input
                type="number"
                value={remainingUses}
                onChange={(e) => setRemainingUses(Number(e.target.value))}
                placeholder="Left"
                className="w-1/2 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 box-border"
              />
            </div>
          </div>
        </div>

        {/* Code Presets */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
          <span className="text-[11px] text-slate-400">Presets:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['CUDU4NHW1EAVSCGV', 'ROY500', 'FREE100', 'WELCOME50'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setRedeemCodeInput(code)}
                className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2.5: Live Redeem Event Launcher */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 shadow-xl space-y-4 box-border">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
              ⚡
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Live Redeem Event System</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Broadcasts start message to channel WITHOUT revealing code. Users claim inside bot after countdown.
              </p>
            </div>
          </div>

          {activeLiveEvent ? (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>LIVE EVENT ACTIVE</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              No Active Event
            </span>
          )}
        </div>

        {/* Live Active Event Monitor & Real-time Admin Dashboard */}
        {activeLiveEvent ? (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-400">Active Live Redeem Event</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow ${
                    activeLiveEvent.isLocked || activeLiveEvent.eventStatus === 'LOCKED'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      : activeLiveEvent.eventStatus === 'RELEASED' || activeLiveEvent.isReleased
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      : activeLiveEvent.eventStatus === 'PAUSED' || activeLiveEvent.isPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : activeLiveEvent.eventStatus === 'ENDED'
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : activeLiveEvent.eventStatus === 'WAITING_FOR_ADMIN' || activeLiveEvent.eventStatus === 'WAITING_FOR_READY'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  }`}>
                    {activeLiveEvent.isLocked || activeLiveEvent.eventStatus === 'LOCKED' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>🔴 LOCKED</span>
                      </>
                    ) : activeLiveEvent.eventStatus === 'RELEASED' || activeLiveEvent.isReleased ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>⚡ RELEASED</span>
                      </>
                    ) : activeLiveEvent.eventStatus === 'PAUSED' || activeLiveEvent.isPaused ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>⛔ PAUSED</span>
                      </>
                    ) : activeLiveEvent.eventStatus === 'ENDED' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>🏁 ENDED</span>
                      </>
                    ) : activeLiveEvent.eventStatus === 'WAITING_FOR_ADMIN' || activeLiveEvent.eventStatus === 'WAITING_FOR_READY' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        <span>🟡 WAITING</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>🟢 LIVE</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {activeLiveEvent.id}
                  </span>
                </div>
              </div>

              {/* 5 ADMIN DASHBOARD CONTROL BUTTONS */}
              <div className="flex items-center flex-wrap gap-2 ml-auto">
                {/* 🚀 Start Live Event Status Badge / Active */}
                <button
                  type="button"
                  disabled={true}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 opacity-80"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>🚀 Live Event Active</span>
                </button>

                {/* 🔓 Release Redeem Code */}
                <button
                  type="button"
                  onClick={handleReleaseLiveEvent}
                  disabled={isReleasingCode || activeLiveEvent.isReleased || activeLiveEvent.eventStatus === 'RELEASED' || activeLiveEvent.isLocked}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                    activeLiveEvent.isReleased || activeLiveEvent.eventStatus === 'RELEASED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-not-allowed opacity-80'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black'
                  }`}
                >
                  {isReleasingCode ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>🔓 Release Redeem Code</span>
                  )}
                </button>

                {/* ⛔ Pause Event */}
                <button
                  type="button"
                  onClick={handlePauseLiveEvent}
                  disabled={isPausingEvent || activeLiveEvent.isLocked}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isPausingEvent ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{activeLiveEvent.eventStatus === 'PAUSED' ? '▶️ Resume Event' : '⛔ Pause Event'}</span>
                  )}
                </button>

                {/* 🚨 Emergency Lock */}
                <button
                  type="button"
                  onClick={handleEmergencyLockLiveEvent}
                  disabled={isEmergencyLocking || activeLiveEvent.isLocked || activeLiveEvent.eventStatus === 'LOCKED'}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-lg ${
                    activeLiveEvent.isLocked || activeLiveEvent.eventStatus === 'LOCKED'
                      ? 'bg-red-950/60 text-red-400 border border-red-800 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-500 text-white border border-red-400 animate-pulse'
                  }`}
                >
                  {isEmergencyLocking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>🚨 Emergency Lock</span>
                  )}
                </button>

                {/* 🛑 End Event */}
                <button
                  type="button"
                  onClick={handleEndLiveEvent}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🛑 End Event</span>
                </button>
              </div>
            </div>

            {/* EMERGENCY LOCK ALERT BANNER IF LOCKED */}
            {(activeLiveEvent.isLocked || activeLiveEvent.eventStatus === 'LOCKED') && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-200 text-xs font-bold flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400 animate-bounce" />
                  <div>
                    <span className="block font-black text-sm text-red-300">🚨 EVENT TEMPORARILY LOCKED BY ADMIN</span>
                    <span className="text-[11px] text-red-400/90 font-mono">All redeem input boxes and code claims are frozen across all Mini Apps.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePauseLiveEvent}
                  className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-xs transition cursor-pointer shadow"
                >
                  ▶️ Unlock & Resume
                </button>
              </div>
            )}

            {/* REAL-TIME DASHBOARD METRICS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 font-mono text-xs">
              {/* Ready Users Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Ready Users</span>
                <div className="text-amber-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.readyCount || 0} / {activeLiveEvent.minReadyUsers || 0}
                </div>
                <span className="text-[9px] text-slate-500 block">
                  {activeLiveEvent.minReadyUsers > 0 ? `${Math.min(100, Math.round(((activeLiveEvent.readyCount || 0)/(activeLiveEvent.minReadyUsers))*100))}% Ready` : 'No min limit'}
                </span>
              </div>

              {/* Online Users Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Online Users</span>
                <div className="text-sky-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.onlineUsersCount || 0}
                </div>
                <span className="text-[9px] text-slate-500 block">Live heartbeat</span>
              </div>

              {/* Countdown Status Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Countdown</span>
                <div className={`font-black text-xs sm:text-sm ${countdownSec > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {countdownText}
                </div>
                <span className="text-[9px] text-slate-500 block">
                  {countdownSec > 0 ? 'Timer ticking' : 'Unlocked'}
                </span>
              </div>

              {/* Remaining Codes Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Remaining</span>
                <div className="text-emerald-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.remainingCodesCount ?? 0}
                </div>
                <span className="text-[9px] text-slate-500 block">Stock left</span>
              </div>

              {/* Claimed Codes Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Claimed Codes</span>
                <div className="text-indigo-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.claimedCount || 0} / {activeLiveEvent.totalCodesCount || activeLiveEvent.maxUses}
                </div>
                <span className="text-[9px] text-slate-500 block">Unique claims</span>
              </div>

              {/* Screenshot Proofs Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">Proofs Uploaded</span>
                <div className="text-pink-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.screenshotUploadsCount || 0}
                </div>
                <span className="text-[9px] text-slate-500 block">Shared screenshot</span>
              </div>

              {/* Claim Requests / Sec Metric */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block uppercase">Requests / Sec</span>
                <div className="text-rose-400 font-black text-sm sm:text-base">
                  {activeLiveEvent.requestsPerSecond ?? 0} RPS
                </div>
                <span className="text-[9px] text-slate-500 block">5s moving avg</span>
              </div>
            </div>

            {/* LIVE ACTIVITY FEED */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ⚡ Live Event Activity Feed (2s Auto-Refresh):
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {(activeLiveEvent.activityFeed || []).length} Events
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-xs">
                {activeLiveEvent.activityFeed && activeLiveEvent.activityFeed.length > 0 ? (
                  activeLiveEvent.activityFeed.slice(-15).reverse().map((item: any, idx: number) => (
                    <div key={item.id || idx} className="p-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm">{item.icon || '⚡'}</span>
                        <span className="text-slate-200 font-medium">{item.text}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">{item.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-center text-slate-500 text-xs italic">Waiting for live activities...</div>
                )}
              </div>
            </div>

            {/* WINNER TIMELINE & RESULT REPORT */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    Winner Timeline & Event Results ({activeLiveEvent.winnersTimeline?.length || 0})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                  >
                    📷 PNG
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                  >
                    📄 PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleShareToTelegram}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow"
                  >
                    ✈️ Share to Telegram
                  </button>
                </div>
              </div>

              {/* Summary Stats Badges */}
              {activeLiveEvent.summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <span className="font-bold text-amber-300">{activeLiveEvent.summaryStats.eventDurationSec || 0}s</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total Claims</span>
                    <span className="font-bold text-emerald-300">{activeLiveEvent.summaryStats.totalClaims || 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Avg Claim Time</span>
                    <span className="font-bold text-sky-300">{activeLiveEvent.summaryStats.avgClaimTimeSec || 0}s</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fastest Typist</span>
                    <span className="font-bold text-indigo-300 truncate block">
                      {activeLiveEvent.summaryStats.fastestTypist?.userName || 'N/A'} ({activeLiveEvent.summaryStats.fastestTypist?.typingSpeedSec || 0}s)
                    </span>
                  </div>
                </div>
              )}

              {/* Winners Timeline List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                {activeLiveEvent.winnersTimeline && activeLiveEvent.winnersTimeline.length > 0 ? (
                  activeLiveEvent.winnersTimeline.map((winner: any) => (
                    <div key={winner.rank} className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                          winner.rank === 1 ? 'bg-amber-400 text-slate-950' : winner.rank === 2 ? 'bg-slate-300 text-slate-950' : winner.rank === 3 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-300'
                        }`}>
                          #{winner.rank}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-slate-200 block truncate">{winner.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">@{winner.telegramId} • Code: {winner.code}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-emerald-400 font-black block">+{winner.reward} pts</span>
                        <span className="text-[10px] text-slate-400 font-mono block">{winner.typingSpeedSec}s • {winner.claimTime}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 text-xs italic">
                    No claims recorded yet. Winners will appear in real time once codes are claimed.
                  </div>
                )}
              </div>
            </div>

            {/* Anti-Cheat Activity Block Log */}
            {activeLiveEvent.antiCheatLogs && activeLiveEvent.antiCheatLogs.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/30 space-y-2">
                <div className="flex justify-between items-center text-xs text-rose-400 font-bold">
                  <span>🛡️ Anti-Cheat Blocks Log ({activeLiveEvent.failedClaimsCount || activeLiveEvent.antiCheatLogs.length}):</span>
                  <span className="text-[10px] font-mono text-slate-400">Auto blocked duplicates</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300">
                  {activeLiveEvent.antiCheatLogs.map((log: any, idx: number) => (
                    <div key={log.id || idx} className="p-1.5 rounded bg-slate-950 border border-slate-800/80 flex justify-between items-center gap-2">
                      <span className="text-rose-300 font-bold">{log.reason}</span>
                      <span className="text-slate-400 truncate max-w-[120px]">User: {log.telegramId}</span>
                      <span className="text-slate-500 text-[9px] shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
              <span>Status: {activeLiveEvent.isUnlocked ? '🟢 Unlocked & Claimable' : activeLiveEvent.eventStatus === 'WAITING_FOR_READY' ? '⏳ Waiting for Minimum Ready Users' : '🔒 Countdown Active'}</span>
              <span className="text-amber-400 font-mono font-bold">Live Dashboard Active (2s refresh)</span>
            </div>
          </div>
        ) : (
          /* Form to launch new event (Phase 2 Form) */
          <div className="space-y-4">
            {/* Multi Code Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 block">Multi Code Upload Mode</span>
                <span className="text-[10px] text-slate-400 block">
                  Upload multiple unique codes (1, 10, 50, 100, 1000). Each claimant gets one unused code.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMultiCodes}
                  onChange={(e) => setUseMultiCodes(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Redeem Codes Input Section */}
            {useMultiCodes ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-400 block">
                  Multiple Redeem Codes (Paste 1 - 1000 codes, separated by newline or comma):
                </label>
                <textarea
                  value={liveMultiCodesText}
                  onChange={(e) => setLiveMultiCodesText(e.target.value)}
                  placeholder="ROY100_A1&#10;ROY100_A2&#10;ROY100_A3&#10;ROY100_A4"
                  rows={4}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>
                    Detected Codes:{' '}
                    <strong className="text-amber-400">
                      {liveMultiCodesText.split(/[\n,]+/).filter((c) => c.trim()).length}
                    </strong>
                  </span>
                  <span>Each successful user receives 1 unique code.</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Single Redeem Code</label>
                  <input
                    type="text"
                    value={liveCodeInput}
                    onChange={(e) => setLiveCodeInput(e.target.value.toUpperCase())}
                    placeholder="ROY500"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Total Uses / Stock</label>
                  <input
                    type="number"
                    value={liveMaxUses}
                    onChange={(e) => setLiveMaxUses(Number(e.target.value))}
                    placeholder="100"
                    min={1}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Configurable Ready Requirement & Timers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Minimum Ready Users</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={liveMinReadyUsers}
                    onChange={(e) => setLiveMinReadyUsers(Number(e.target.value))}
                    placeholder="e.g. 20"
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  {[0, 20, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLiveMinReadyUsers(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                        liveMinReadyUsers === preset
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {preset === 0 ? 'None' : preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Countdown (Seconds)</label>
                <input
                  type="number"
                  value={liveCountdownSec}
                  onChange={(e) => setLiveCountdownSec(Number(e.target.value))}
                  placeholder="10"
                  min={1}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={liveDurationMin}
                  onChange={(e) => setLiveDurationMin(Number(e.target.value))}
                  placeholder="15"
                  min={1}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Custom Mini App Link Option */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Mini App URL (Deep Link)
              </label>
              <input
                type="text"
                value={liveMiniAppUrl}
                onChange={(e) => setLiveMiniAppUrl(e.target.value)}
                placeholder="https://t.me/Roy_wallett_bot/roy_share_wallet?startapp=live_event"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400 font-mono block mt-1">
                Enter your custom mini app link or leave default.
              </span>
            </div>

            {/* Broadcast Destination Options */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                📢 Broadcast Announcement Destinations
              </label>
              <div className="flex items-center flex-wrap gap-4 text-xs font-bold text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={liveSendToChannel}
                    onChange={(e) => setLiveSendToChannel(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>✓ Telegram Channel</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={liveSendToGroups}
                    onChange={(e) => setLiveSendToGroups(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>✓ Telegram Groups</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={liveSendToUsers}
                    onChange={(e) => setLiveSendToUsers(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>All Bot Users</span>
                </label>
              </div>
            </div>

            {/* Broadcast Summary Report if available */}
            {lastBroadcastSummary && (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 font-mono text-xs space-y-1">
                <div className="text-emerald-400 font-bold flex items-center justify-between">
                  <span>Broadcast Complete</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">✓ Completed</span>
                </div>
                <div className="text-slate-300 grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                  <div>Users Sent: <span className="text-amber-300 font-bold">{lastBroadcastSummary.usersSent}</span></div>
                  <div>Channel: <span className="text-emerald-300 font-bold">{lastBroadcastSummary.channel}</span></div>
                  <div>Groups: <span className="text-emerald-300 font-bold">{lastBroadcastSummary.groups}</span></div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartLiveEvent}
              disabled={isStartingLiveEvent}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isStartingLiveEvent ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Announcement & Waiting for Completion...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>🚀 Start Live Redeem Event</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* SECTION 3: Generate AI Message */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3 box-border">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
            3
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Message Generation</span>
          </h2>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1">
            Custom Instructions / Note (Optional)
          </label>
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Include note to share screenshot..."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500 box-border"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerateMessage}
          disabled={isGenerating}
          className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300" />
          )}
          <span>{isGenerating ? 'Generating AI Message...' : '✨ Generate AI Message'}</span>
        </button>

        {/* Message Editor */}
        <div className="space-y-1 pt-1">
          <label className="text-xs font-bold text-slate-300 block">Edit Telegram Message</label>
          <textarea
            rows={6}
            value={editableMessage}
            onChange={(e) => setEditableMessage(e.target.value)}
            placeholder="Telegram message content..."
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-sky-500 box-border font-sans"
          />
        </div>
      </div>

      {/* SECTION 4: Telegram Live Preview (Message ONLY, NO fake buttons) */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3 box-border">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
            4
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <span>Telegram Live Preview</span>
          </h2>
        </div>

        {/* Clean Telegram Preview Box (Message ONLY, NO fake buttons) */}
        <div className="p-4 rounded-2xl bg-[#0b1329] border border-sky-500/30 shadow-inner space-y-2.5 w-full max-w-full overflow-hidden box-border">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white truncate">{config.botUsername || 'Roy Share Bot'}</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/20 shrink-0">
              Preview Mode
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#131d38] text-xs text-slate-100 whitespace-pre-wrap leading-relaxed break-words font-sans">
            {editableMessage || 'Telegram message preview will appear here...'}
          </div>

          {/* Quick Copy Redeem Code button */}
          {redeemCodeInput.trim() && (
            <button
              type="button"
              onClick={() =>
                copyToClipboard(redeemCodeInput.trim().toUpperCase(), `Code '${redeemCodeInput.trim().toUpperCase()}' copied!`)
              }
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              {copiedCodeState ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Code ({redeemCodeInput.trim().toUpperCase()})</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 5: Manage Telegram Destinations (Unchanged as required) */}
      <div className="w-full max-w-full overflow-hidden box-border">
        <TelegramDestinationManager
          config={config}
          showToast={showToast}
          onDestinationsUpdated={fetchDestinations}
        />
      </div>

      {/* SECTION 6: Send Section (Checkboxes + Send Test + Send Broadcast) */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 box-border">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
            5
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Send Section</span>
          </h2>
        </div>

        {/* Destination Selection Checkboxes */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Select Target Destinations:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* ☑ Send to Telegram Bot */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <input
                type="checkbox"
                checked={sendToBot}
                onChange={(e) => setSendToBot(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">☑ Send to Telegram Bot</span>
                <span className="text-[10px] text-slate-400 block truncate">Direct bot users / admin bot</span>
              </div>
            </label>

            {/* ☑ Send to Main Channel */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <input
                type="checkbox"
                checked={sendToMainChannel}
                onChange={(e) => setSendToMainChannel(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">☑ Send to Main Channel</span>
                <span className="text-[10px] text-sky-400 font-mono block truncate">
                  @{config.mainChannelUsername ? config.mainChannelUsername.replace(/^@/, '') : 'Main Channel'}
                </span>
              </div>
            </label>

            {/* ☑ Send to Main Group */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <input
                type="checkbox"
                checked={sendToMainGroup}
                onChange={(e) => setSendToMainGroup(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">☑ Send to Main Group</span>
                <span className="text-[10px] text-indigo-400 font-mono block truncate">
                  @{config.mainGroupUsername ? config.mainGroupUsername.replace(/^@/, '') : 'Main Group'}
                </span>
              </div>
            </label>

            {/* ☑ Send to Additional Channels */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <input
                type="checkbox"
                checked={sendToAdditionalChannels}
                onChange={(e) => setSendToAdditionalChannels(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">☑ Send to Additional Channels</span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {destinations.length} configured in Destination Manager
                </span>
              </div>
            </label>
          </div>

          {/* Sub-list of Additional Channels if checked */}
          {sendToAdditionalChannels && destinations.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 mt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                <span>Additional Channels ({selectedAdditionalChannelIds.length}/{destinations.length}):</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedAdditionalChannelIds.length === destinations.length) {
                      setSelectedAdditionalChannelIds([]);
                    } else {
                      setSelectedAdditionalChannelIds(destinations.map((d) => d.id));
                    }
                  }}
                  className="text-sky-400 hover:underline font-bold"
                >
                  {selectedAdditionalChannelIds.length === destinations.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {destinations.map((dest) => {
                  const isChecked = selectedAdditionalChannelIds.includes(dest.id);
                  return (
                    <label
                      key={dest.id}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAdditionalChannelIds(selectedAdditionalChannelIds.filter((id) => id !== dest.id));
                          } else {
                            setSelectedAdditionalChannelIds([...selectedAdditionalChannelIds, dest.id]);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer"
                      />
                      <span className="truncate max-w-[130px]">{dest.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live Broadcast Progress & Final Report Card */}
        {broadcastProgress && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            {/* Header / Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="font-bold text-white flex items-center gap-2 text-xs sm:text-sm">
                <Zap className={`w-4 h-4 ${broadcastProgress.isBroadcasting || broadcastProgress.isRetrying ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                <span>
                  {broadcastProgress.isBroadcasting
                    ? 'Live Broadcasting in Progress...'
                    : broadcastProgress.isRetrying
                    ? 'Retrying Failed Users...'
                    : 'Broadcast Final Report'}
                </span>
              </span>

              <span className="font-mono font-bold text-sky-400 text-xs">
                {broadcastProgress.statusText}
              </span>
            </div>

            {/* Live Progress Bar */}
            {(broadcastProgress.isBroadcasting || broadcastProgress.isRetrying) && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-500 h-2.5 rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((broadcastProgress.current / Math.max(1, broadcastProgress.total)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Progress: {Math.round((broadcastProgress.current / Math.max(1, broadcastProgress.total)) * 100)}%</span>
                  <span>
                    Sending {broadcastProgress.current}/{broadcastProgress.total}
                  </span>
                </div>
              </div>
            )}

            {/* Final Report Grid / Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Users</span>
                <span className="text-sm font-bold font-mono text-white">{broadcastProgress.total}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Sent</span>
                <span className="text-sm font-bold font-mono text-emerald-300">{broadcastProgress.sent}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">Failed</span>
                <span className="text-sm font-bold font-mono text-rose-300">{broadcastProgress.failed}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Blocked</span>
                <span className="text-sm font-bold font-mono text-amber-300">{broadcastProgress.blocked}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-sky-400 block">Time Taken</span>
                <span className="text-sm font-bold font-mono text-sky-300">{broadcastProgress.timeTaken}</span>
              </div>
            </div>

            {/* Categorized Destinations Breakdown */}
            {broadcastProgress.categoryReports && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Destination Breakdown</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    broadcastProgress.overallStatus === 'Success'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : broadcastProgress.overallStatus === 'Partial Success'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {broadcastProgress.overallStatus === 'Success' && '✔ SUCCESS (100% Succeeded)'}
                    {broadcastProgress.overallStatus === 'Partial Success' && '⚠️ PARTIAL SUCCESS (Some Failed)'}
                    {broadcastProgress.overallStatus === 'Failed' && '❌ FAILED (All Selected Failed)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Bot Users */}
                  {broadcastProgress.categoryReports.botUsers?.selected && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-sky-400" /> Bot Users</span>
                        <span className="font-mono text-[11px] text-emerald-400">
                          {broadcastProgress.categoryReports.botUsers.sent} Sent
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                        <span>Total: {broadcastProgress.categoryReports.botUsers.total}</span>
                        <span className="text-emerald-400">Sent: {broadcastProgress.categoryReports.botUsers.sent}</span>
                        <span className="text-rose-400">Failed: {broadcastProgress.categoryReports.botUsers.failed}</span>
                        <span className="text-amber-400">Blocked: {broadcastProgress.categoryReports.botUsers.blocked}</span>
                      </div>
                    </div>
                  )}

                  {/* Main Channel */}
                  {broadcastProgress.categoryReports.mainChannel?.selected && (
                    <div className={`p-2.5 rounded-lg border space-y-1 ${
                      broadcastProgress.categoryReports.mainChannel.sent > 0
                        ? 'bg-emerald-950/20 border-emerald-800/40'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-200">Main Channel</span>
                        <span className={`font-mono text-[11px] ${
                          broadcastProgress.categoryReports.mainChannel.sent > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {broadcastProgress.categoryReports.mainChannel.sent > 0 ? '✔ Sent' : '❌ Failed'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        Target: {broadcastProgress.categoryReports.mainChannel.target}
                      </div>
                      {broadcastProgress.categoryReports.mainChannel.error && (
                        <div className="text-[10px] text-rose-300 font-mono bg-rose-950/40 p-1 rounded border border-rose-800/50">
                          Error: {broadcastProgress.categoryReports.mainChannel.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Group */}
                  {broadcastProgress.categoryReports.mainGroup?.selected && (
                    <div className={`p-2.5 rounded-lg border space-y-1 ${
                      broadcastProgress.categoryReports.mainGroup.sent > 0
                        ? 'bg-emerald-950/20 border-emerald-800/40'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-200">Main Group</span>
                        <span className={`font-mono text-[11px] ${
                          broadcastProgress.categoryReports.mainGroup.sent > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {broadcastProgress.categoryReports.mainGroup.sent > 0 ? '✔ Sent' : '❌ Failed'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        Target: {broadcastProgress.categoryReports.mainGroup.target}
                      </div>
                      {broadcastProgress.categoryReports.mainGroup.error && (
                        <div className="text-[10px] text-rose-300 font-mono bg-rose-950/40 p-1 rounded border border-rose-800/50">
                          Error: {broadcastProgress.categoryReports.mainGroup.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Channels */}
                  {broadcastProgress.categoryReports.additionalChannels?.selected && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span>Additional Channels</span>
                        <span className="font-mono text-[11px]">
                          <span className="text-emerald-400">{broadcastProgress.categoryReports.additionalChannels.sent} Sent</span> / <span className="text-rose-400">{broadcastProgress.categoryReports.additionalChannels.failed} Failed</span>
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Total Channels: {broadcastProgress.categoryReports.additionalChannels.total}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Final Status Indicator & Action */}
            {broadcastProgress.completed && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className={`text-xs font-bold flex items-center gap-1.5 ${
                  broadcastProgress.overallStatus === 'Success'
                    ? 'text-emerald-400'
                    : broadcastProgress.overallStatus === 'Partial Success'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}>
                  {broadcastProgress.overallStatus === 'Success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : broadcastProgress.overallStatus === 'Partial Success' ? (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>
                    {broadcastProgress.overallStatus === 'Success' && 'Completed Successfully (All destinations received message)'}
                    {broadcastProgress.overallStatus === 'Partial Success' && 'Completed with Partial Success (Some destinations failed)'}
                    {broadcastProgress.overallStatus === 'Failed' && 'Broadcast Failed (All destinations failed)'}
                  </span>
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {broadcastProgress.apiLogs && broadcastProgress.apiLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openApiLogModal(broadcastProgress.apiLogs, 'Broadcast Telegram API Log')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      <span>View Telegram API Log ({broadcastProgress.apiLogs.length})</span>
                    </button>
                  )}

                  {broadcastProgress.failed > 0 && broadcastProgress.failedUsers && broadcastProgress.failedUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRetryFailedUsers()}
                      disabled={broadcastProgress.isRetrying}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${broadcastProgress.isRetrying ? 'animate-spin' : ''}`} />
                      <span>Retry Failed ({broadcastProgress.failedUsers.length})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons: Send Test & Send Broadcast */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleSendTestBroadcast}
            disabled={isSendingTest || !editableMessage.trim()}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Send Test</span>
          </button>

          <button
            type="button"
            onClick={handleSendLiveBroadcast}
            disabled={isSending || (broadcastProgress?.isBroadcasting ?? false) || !editableMessage.trim()}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending || (broadcastProgress?.isBroadcasting ?? false) ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send Broadcast</span>
          </button>
        </div>
      </div>

      {/* SECTION 7: Broadcast History */}
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3 box-border">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
              6
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            title="Refresh History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {historyList.length === 0 ? (
          <div className="p-4 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
            No broadcast history recorded yet.
          </div>
        ) : (
          <div>
            {/* Mobile Cards List */}
            <div className="space-y-2.5 sm:hidden">
              {historyList.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
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
                        item.status === 'Completed' || item.status === 'Success'
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

                  {/* Stats Summary line */}
                  {(item.totalUsers !== undefined || item.sent !== undefined) && (
                    <div className="flex flex-wrap gap-x-2 text-[10px] font-mono text-slate-400 bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>Total: {item.totalUsers ?? 'N/A'}</span>
                      <span className="text-emerald-400">Sent: {item.sent ?? 0}</span>
                      <span className="text-rose-400">Failed: {item.failed ?? 0}</span>
                      <span className="text-amber-400">Blocked: {item.blocked ?? 0}</span>
                      {item.timeTaken && <span className="text-sky-400">Time: {item.timeTaken}</span>}
                    </div>
                  )}

                  <p className="text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    {item.failedUsers && item.failedUsers.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleRetryFailedUsers(item.failedUsers, item.id)}
                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/30"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry Failed ({item.failedUsers.length})
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendAgainFromHistory(item)}
                      className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Load Message
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto w-full max-w-full">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Message</th>
                    <th className="py-2.5 px-3">Stats</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {item.redeemCode || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-300" title={item.message}>
                        {item.message}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        {item.totalUsers !== undefined ? (
                          <span className="text-slate-300">
                            Total: {item.totalUsers} | <span className="text-emerald-400">Sent: {item.sent}</span> | <span className="text-rose-400">Fail: {item.failed}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.status === 'Completed' || item.status === 'Success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.apiLogs && item.apiLogs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openApiLogModal(item.apiLogs, `Telegram API Log - ${new Date(item.timestamp).toLocaleString()}`)}
                              className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="View Telegram API Log"
                            >
                              <Terminal className="w-3 h-3" />
                              <span>View Telegram API Log</span>
                            </button>
                          )}
                          {item.failedUsers && item.failedUsers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRetryFailedUsers(item.failedUsers, item.id)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="Retry failed recipients"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Retry ({item.failedUsers.length})</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSendAgainFromHistory(item)}
                            className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Load Message</span>
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

      {/* Telegram API Request & Response Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>{activeLogTitle}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {activeLogs.length} Calls
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real Telegram Bot API HTTP status codes and exact response payloads
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Controls Bar */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setLogFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    logFilter === 'all'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  All Logs ({activeLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('errors')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    logFilter === 'errors'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Errors Only ({activeLogs.filter(l => !l.ok).length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('bot')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    logFilter === 'bot'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Bot Users ({activeLogs.filter(l => l.category === 'Bot Users').length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('channels')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    logFilter === 'channels'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Channels & Groups ({activeLogs.filter(l => l.category !== 'Bot Users').length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter chat ID or error..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Logs List / Table */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {activeLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No Telegram API log entries recorded for this broadcast.</div>
              ) : (
                activeLogs
                  .filter((entry) => {
                    if (logFilter === 'errors' && entry.ok) return false;
                    if (logFilter === 'bot' && entry.category !== 'Bot Users') return false;
                    if (logFilter === 'channels' && entry.category === 'Bot Users') return false;
                    if (logSearchQuery.trim()) {
                      const q = logSearchQuery.toLowerCase();
                      return (
                        entry.chatId.toLowerCase().includes(q) ||
                        entry.destinationName.toLowerCase().includes(q) ||
                        (entry.errorDescription && entry.errorDescription.toLowerCase().includes(q))
                      );
                    }
                    return true;
                  })
                  .map((entry, idx) => {
                    const isExpanded = expandedLogId === (entry.id || `log_${idx}`);
                    return (
                      <div
                        key={entry.id || `log_${idx}`}
                        className={`p-3 rounded-xl border transition space-y-2 ${
                          entry.ok
                            ? 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                            : 'bg-rose-950/20 border-rose-800/40 hover:border-rose-700/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.ok ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              HTTP {entry.httpStatus}
                            </span>
                            <span className="font-bold text-slate-200 text-xs">
                              {entry.destinationName}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({entry.chatId})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
                              {entry.category}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Error notice banner if failed */}
                        {!entry.ok && (
                          <div className="p-2 rounded bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs font-mono flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Telegram Error: </span>
                              <span>{entry.errorDescription || 'API Request Failed'}</span>
                            </div>
                          </div>
                        )}

                        {/* Raw API Response JSON Expandable Block */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : (entry.id || `log_${idx}`))}
                            className="text-[11px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? 'Hide Raw Telegram Response Payload' : 'View Raw Telegram Response Payload'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto">
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                Method: <span className="text-sky-400">{entry.method}</span> | Target: <span className="text-amber-300">{entry.chatId}</span>
                              </div>
                              <pre className="whitespace-pre-wrap break-all text-emerald-400/90">
                                {JSON.stringify(entry.telegramResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activeLogs, null, 2));
                  showToast('Copied full Telegram API log to clipboard!', 'success');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Full Log JSON</span>
              </button>

              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
