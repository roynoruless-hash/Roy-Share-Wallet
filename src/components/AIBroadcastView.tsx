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
  AlertCircle,
  Bot,
  Zap,
  Check,
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
    completed: boolean;
    broadcastRecordId?: string;
  } | null>(null);

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

  // Live Redeem Event States
  const [liveCodeInput, setLiveCodeInput] = useState('ROY500');
  const [liveCountdownSec, setLiveCountdownSec] = useState(10);
  const [liveMaxUses, setLiveMaxUses] = useState(100);
  const [liveDurationMin, setLiveDurationMin] = useState(15);
  const [isStartingLiveEvent, setIsStartingLiveEvent] = useState(false);
  const [activeLiveEvent, setActiveLiveEvent] = useState<any>(null);

  const fetchLiveEvent = async () => {
    try {
      const res = await fetch('/api/live-event/active');
      const data = await res.json();
      if (data.success && data.activeEvent) {
        setActiveLiveEvent(data.activeEvent);
      } else {
        setActiveLiveEvent(null);
      }
    } catch (err) {
      console.error('Failed to fetch active live event:', err);
    }
  };

  const handleStartLiveEvent = async () => {
    if (!liveCodeInput.trim()) {
      showToast('Please enter a Redeem Code for the Live Event', 'error');
      return;
    }

    setIsStartingLiveEvent(true);
    try {
      const res = await fetch('/api/live-event/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: liveCodeInput.trim().toUpperCase(),
          maxUses: liveMaxUses,
          countdownSeconds: liveCountdownSec,
          durationMinutes: liveDurationMin,
          sendBroadcast: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🚀 Live Redeem Event Started & Broadcasted to Channel!', 'success');
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
      // 1. Fetch registered users from Firestore
      let registeredUsers: Array<{
        id: string;
        telegramId: string;
        name: string;
        banned: boolean;
      }> = [];

      if (sendToBot) {
        try {
          const userRes = await fetch('/api/ai-broadcast/users');
          const userData = await userRes.json();
          if (userData.success && Array.isArray(userData.users)) {
            registeredUsers = userData.users;
          }
        } catch (uErr) {
          console.error('Failed to load registered users:', uErr);
        }
      }

      // Filter active and blocked users
      const activeUsers = registeredUsers.filter(
        (u) => u.telegramId && String(u.telegramId).trim() && !u.banned
      );
      const initialBlockedUsers = registeredUsers.filter(
        (u) => !u.telegramId || !String(u.telegramId).trim() || u.banned
      );

      // Collect channel/group destinations
      const channelDestinations: Array<{
        id: string;
        displayName: string;
        chatId: string;
      }> = [];

      if (sendToMainChannel && config.mainChannelUsername) {
        const mainChan = config.mainChannelUsername.replace(/^@/, '');
        channelDestinations.push({
          id: 'main_channel_dest',
          displayName: 'Main Channel',
          chatId: `@${mainChan}`,
        });
      }

      if (sendToMainGroup && config.mainGroupUsername) {
        const mainGrp = config.mainGroupUsername.replace(/^@/, '');
        channelDestinations.push({
          id: 'main_group_dest',
          displayName: 'Main Group',
          chatId: `@${mainGrp}`,
        });
      }

      if (sendToAdditionalChannels && destinations.length > 0) {
        destinations.forEach((dest) => {
          if (selectedAdditionalChannelIds.includes(dest.id)) {
            const cleanUser = dest.username ? dest.username.replace(/^@/, '') : '';
            const isMainChan = config.mainChannelUsername && cleanUser === config.mainChannelUsername.replace(/^@/, '');
            const isMainGrp = config.mainGroupUsername && cleanUser === config.mainGroupUsername.replace(/^@/, '');

            if (!isMainChan && !isMainGrp) {
              const targetChat = dest.chatId || (dest.username ? `@${dest.username.replace(/^@/, '')}` : '');
              if (targetChat) {
                channelDestinations.push({
                  id: dest.id,
                  displayName: dest.displayName,
                  chatId: targetChat,
                });
              }
            }
          }
        });
      }

      // Build overall target queue
      const totalTargets = activeUsers.length + channelDestinations.length + initialBlockedUsers.length;

      if (totalTargets === 0) {
        showToast('No registered active users or destinations found to broadcast.', 'error');
        setIsSending(false);
        return;
      }

      const broadcastRecordId = `bc_${Date.now()}`;
      const startTime = Date.now();

      // Initialize live progress state
      let currentIdx = 0;
      let sentCount = 0;
      let failedCount = 0;
      let blockedCount = initialBlockedUsers.length;
      const failedUsersList: Array<{ id: string; telegramId: string; name: string; error?: string }> = [];

      setBroadcastProgress({
        isBroadcasting: true,
        isRetrying: false,
        current: blockedCount,
        total: totalTargets,
        statusText: `Sending ${blockedCount}/${totalTargets}`,
        sent: 0,
        failed: 0,
        blocked: blockedCount,
        timeTaken: '0.0s',
        failedUsers: [],
        completed: false,
        broadcastRecordId,
      });

      // A) Loop through Active Registered Users
      for (let i = 0; i < activeUsers.length; i++) {
        const user = activeUsers[i];
        currentIdx = i + 1 + initialBlockedUsers.length;

        setBroadcastProgress((prev) =>
          prev
            ? {
                ...prev,
                current: currentIdx,
                statusText: `Sending ${currentIdx}/${totalTargets}`,
              }
            : null
        );

        try {
          // Rate limit delay (~35ms per request = 28-30 msgs/sec)
          await new Promise((resolve) => setTimeout(resolve, 35));

          const res = await fetch('/api/ai-broadcast/send-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: user.telegramId,
              message: editableMessage.trim(),
            }),
          });
          const data = await res.json();

          if (data.success) {
            sentCount++;
          } else if (data.isBlocked) {
            blockedCount++;
          } else {
            failedCount++;
            failedUsersList.push({
              id: user.id,
              telegramId: user.telegramId,
              name: user.name || 'User',
              error: data.error || 'Send failed',
            });
          }
        } catch (err: any) {
          failedCount++;
          failedUsersList.push({
            id: user.id,
            telegramId: user.telegramId,
            name: user.name || 'User',
            error: err.message || 'Error sending message',
          });
        }

        const elapsedSeconds = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        setBroadcastProgress((prev) =>
          prev
            ? {
                ...prev,
                sent: sentCount,
                failed: failedCount,
                blocked: blockedCount,
                failedUsers: [...failedUsersList],
                timeTaken: elapsedSeconds,
              }
            : null
        );
      }

      // B) Loop through Channel / Group Destinations
      for (let j = 0; j < channelDestinations.length; j++) {
        const dest = channelDestinations[j];
        currentIdx = activeUsers.length + initialBlockedUsers.length + j + 1;

        setBroadcastProgress((prev) =>
          prev
            ? {
                ...prev,
                current: currentIdx,
                statusText: `Sending ${currentIdx}/${totalTargets}`,
              }
            : null
        );

        try {
          await new Promise((resolve) => setTimeout(resolve, 35));

          const res = await fetch('/api/ai-broadcast/send-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: dest.chatId,
              message: editableMessage.trim(),
            }),
          });
          const data = await res.json();

          if (data.success) {
            sentCount++;
          } else {
            failedCount++;
            failedUsersList.push({
              id: dest.id,
              telegramId: dest.chatId,
              name: dest.displayName,
              error: data.error || 'Channel send failed',
            });
          }
        } catch (err: any) {
          failedCount++;
          failedUsersList.push({
            id: dest.id,
            telegramId: dest.chatId,
            name: dest.displayName,
            error: err.message || 'Channel send error',
          });
        }

        const elapsedSeconds = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        setBroadcastProgress((prev) =>
          prev
            ? {
                ...prev,
                sent: sentCount,
                failed: failedCount,
                blocked: blockedCount,
                failedUsers: [...failedUsersList],
                timeTaken: elapsedSeconds,
              }
            : null
        );
      }

      const finalTimeTaken = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      // Complete progress update
      setBroadcastProgress({
        isBroadcasting: false,
        isRetrying: false,
        current: totalTargets,
        total: totalTargets,
        statusText: 'Completed',
        sent: sentCount,
        failed: failedCount,
        blocked: blockedCount,
        timeTaken: finalTimeTaken,
        failedUsers: failedUsersList,
        completed: true,
        broadcastRecordId,
      });

      // Save History to Firestore
      await fetch('/api/ai-broadcast/save-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: broadcastRecordId,
          type: broadcastType,
          redeemCode: broadcastType === 'redeem_code' ? redeemCodeInput.trim().toUpperCase() : 'N/A',
          message: editableMessage.trim(),
          sentByAdmin: 'Admin',
          targetAudience: 'All Registered Users',
          status: 'Completed',
          totalUsers: totalTargets,
          sent: sentCount,
          failed: failedCount,
          blocked: blockedCount,
          timeTaken: finalTimeTaken,
          failedUsers: failedUsersList,
          timestamp: new Date().toISOString(),
        }),
      });

      showToast('🚀 Broadcast Completed Successfully!', 'success');
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

        {/* Live Active Event Monitor Box */}
        {activeLiveEvent ? (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400">Active Event Code:</span>
                <code className="text-lg font-mono font-black text-amber-300 block">
                  {activeLiveEvent.code || 'HIDDEN'}
                </code>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block">Claims:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {activeLiveEvent.claimedCount} / {activeLiveEvent.maxUses}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">Countdown:</span>
                  <span className="text-amber-400 font-bold text-sm">
                    {activeLiveEvent.countdownSeconds}s
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEndLiveEvent}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition ml-auto"
              >
                🛑 End Event Now
              </button>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
              <span>Status: {activeLiveEvent.isUnlocked ? '🟢 Unlocked & Claimable' : '🔒 Countdown Active'}</span>
              <span>Auto Syncing with Server</span>
            </div>
          </div>
        ) : (
          /* Form to launch new event */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Redeem Code</label>
                <input
                  type="text"
                  value={liveCodeInput}
                  onChange={(e) => setLiveCodeInput(e.target.value.toUpperCase())}
                  placeholder="ROY500"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs sm:text-sm font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Countdown (Sec)</label>
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
                <label className="text-xs font-bold text-slate-300 block mb-1">Total Stock</label>
                <input
                  type="number"
                  value={liveMaxUses}
                  onChange={(e) => setLiveMaxUses(Number(e.target.value))}
                  placeholder="100"
                  min={1}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Expiry (Mins)</label>
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

            <button
              type="button"
              onClick={handleStartLiveEvent}
              disabled={isStartingLiveEvent}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isStartingLiveEvent ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Starting Event & Posting Channel Broadcast...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>🚀 Start Live Redeem Event & Broadcast to Channel</span>
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

            {/* Final Status Indicator & Action */}
            {broadcastProgress.completed && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Completed Successfully.</span>
                </span>

                {broadcastProgress.failed > 0 && broadcastProgress.failedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRetryFailedUsers()}
                    disabled={broadcastProgress.isRetrying}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${broadcastProgress.isRetrying ? 'animate-spin' : ''}`} />
                    <span>Retry Failed Users ({broadcastProgress.failedUsers.length})</span>
                  </button>
                )}
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
    </div>
  );
};
