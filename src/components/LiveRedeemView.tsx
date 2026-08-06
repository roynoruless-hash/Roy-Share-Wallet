import React, { useState, useEffect } from 'react';
import { Gift, Zap, Copy, Check, Clock, AlertTriangle, Sparkles, RefreshCw, ArrowLeft, Camera, ShieldCheck, Film, BarChart2, History, TestTube, Radio, Award } from 'lucide-react';
import { LiveReplayModal } from './live-event/LiveReplayModal';
import { EventAnalyticsView } from './live-event/EventAnalyticsView';
import { UserRedeemHistory } from './live-event/UserRedeemHistory';
import { LiveNotificationCenter } from './live-event/LiveNotificationCenter';
import { SpectatorView } from './live-event/SpectatorView';
import { SeasonsView } from './live-event/SeasonsView';

interface LiveEventData {
  id: string;
  status: 'active' | 'ended';
  eventStatus: 'IDLE' | 'LIVE_COUNTDOWN' | 'UNLOCKED' | 'ENDED' | 'WAITING_FOR_READY' | 'WAITING_FOR_ADMIN' | 'RELEASED' | 'LIVE' | 'PAUSED' | 'LOCKED';
  isReleased?: boolean;
  isLocked?: boolean;
  isPaused?: boolean;
  isGhostMode?: boolean;
  unlocksAt: number;
  unlockTime: number;
  unlockAt: number;
  expiresAt: number;
  maxUses: number;
  claimedCount: number | string;
  remainingCodesCount: number | string;
  totalCodesCount: number;
  countdownSeconds: number;
  minReadyUsers: number;
  readyCount: number;
  isUserReady: boolean;
  onlineUsersCount: number;
  isUnlocked: boolean;
  code?: string;
  maskedCode?: string;
  userAlreadyClaimedCode?: string;
  screenshotUploadsCount?: number;
  userSecurityScore?: { score: number; badge: 'TRUSTED' | 'SUSPICIOUS' | 'HIGH_RISK'; factors: string[] };
  serverHealth?: {
    serverStatus: string;
    requestsPerSec: number;
    cpuLoad: string;
    memoryUsageMB: string;
    responseTimeMs: string;
    dbLatencyMs: string;
    firestoreStatus: string;
    telegramApiStatus: string;
    queueMetrics: { activeQueueLength: number; totalRequestsProcessed: number; isProcessing: boolean };
  } | null;
  activityFeed?: Array<{ id: string; time: string; text: string; icon: string }>;
  winnersTimeline?: Array<{
    rank: number;
    telegramId: string;
    userName: string;
    claimTime: string;
    claimedAt: number;
    typingSpeedSec: number;
    code: string;
    reward: number;
    score?: number;
    badge?: string;
  }>;
  summaryStats?: {
    eventDurationSec: number;
    totalParticipants: number;
    totalClaims: number | string;
    successfulClaims: number | string;
    remainingCodes: number | string;
    avgClaimTimeSec: number;
    fastestTypist?: any;
    goldenCodeWinner?: any;
  };
}

interface LiveRedeemViewProps {
  botUsername?: string;
  onClose?: () => void;
}

export const LiveRedeemView: React.FC<LiveRedeemViewProps> = ({
  botUsername = 'Roy_wallett_bot',
  onClose,
}) => {
  const [eventData, setEventData] = useState<LiveEventData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string>('');

  // Phase XII View Tabs & Modals
  const [activeTab, setActiveTab] = useState<'live' | 'spectator' | 'seasons' | 'analytics' | 'history'>('live');
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);

  const handleToggleSandbox = async () => {
    try {
      const res = await fetch('/api/live-event/sandbox-mode', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsSandboxMode(data.isSandbox);
        setClaimStatusMsg({ type: 'info', text: data.message });
      }
    } catch (err) {
      console.error('Failed to toggle sandbox mode:', err);
    }
  };

  // Countdown & Unlocked states
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10);
  const [eventExpired, setEventExpired] = useState<boolean>(false);

  // Telegram User Information
  const [telegramId, setTelegramId] = useState<string>(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        return String(tg.initDataUnsafe.user.id);
      }
    } catch (e) {}
    return localStorage.getItem('roy_user_id') || '';
  });

  const [userName, setUserName] = useState<string>(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        if (u.first_name) {
          return `${u.first_name} ${u.last_name || ''}`.trim();
        }
        if (u.username) return `@${u.username}`;
        return String(u.id);
      }
    } catch (e) {}
    return 'Telegram User';
  });

  // Handle Claim & Copy states
  const [inputCode, setInputCode] = useState<string>('');
  const [typingStartTime, setTypingStartTime] = useState<number | null>(null);
  const [pasteDetected, setPasteDetected] = useState<boolean>(false);
  const [typingSpeedResult, setTypingSpeedResult] = useState<number | null>(null);

  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isReadySubmitting, setIsReadySubmitting] = useState<boolean>(false);
  const [claimedCode, setClaimedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [claimStatusMsg, setClaimStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);

  // Synchronized Live Decryption Animation State
  const [unlockAnimProgress, setUnlockAnimProgress] = useState<number>(0);
  const [isDecryptingAnim, setIsDecryptingAnim] = useState<boolean>(false);
  const [animStepText, setAnimStepText] = useState<string>('🔒 Code Locked...');
  const [hasSeenUnlockAnim, setHasSeenUnlockAnim] = useState<boolean>(false);

  // Trigger typing notification to backend
  const notifyTypingToBackend = async () => {
    try {
      fetch('/api/live-event/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: telegramId, telegramId }),
      }).catch(() => {});
    } catch (e) {}
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setInputCode(val);
    if (!typingStartTime && val.length > 0) {
      setTypingStartTime(Date.now());
      notifyTypingToBackend();
    }
  };

  const handlePaste = () => {
    setPasteDetected(true);
  };

  // Screenshot Upload states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  // Zero-click Telegram WebApp authentication and initialization
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const isTelegramWebApp = Boolean(tg && (tg.initData || tg.initDataUnsafe?.user?.id));

      const urlParams = new URLSearchParams(window.location.search);
      const startParam = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || tg?.initDataUnsafe?.start_param || '';

      // Print exact runtime URL and routing details for Telegram diagnostics
      console.log('--- TELEGRAM MINI APP RUNTIME URL DIAGNOSTICS (LiveRedeemView.tsx) ---');
      console.log('1. Sent/Received TG Startapp URL Parameter (or start_param):', startParam || 'None');
      console.log('2. window.location.href:', window.location.href);
      console.log('3. window.location.origin:', window.location.origin);
      console.log('4. window.location.pathname:', window.location.pathname);
      const isOnRender = window.location.hostname.includes('onrender.com');
      const isAisDev = window.location.hostname.includes('ais-dev-');
      const isAisPre = window.location.hostname.includes('ais-pre-');
      console.log('5. Hostname Environment Classification:', isOnRender ? 'Render (https://roy-share-wallet.onrender.com)' : isAisDev ? 'AI Studio Dev (https://ais-dev-...)' : isAisPre ? 'AI Studio Pre (https://ais-pre-...)' : `Other Hostname: ${window.location.hostname}`);
      console.log('-----------------------------------------------------------------------');

      if (tg) {
        tg.ready();
        if (typeof tg.expand === 'function') {
          tg.expand();
        }
      }

      if (isTelegramWebApp) {
        console.log(`[WEBAPP_AUTH] Telegram WebApp detected via window.Telegram?.WebApp. initData present: ${Boolean(tg?.initData)}`);
        const user = tg?.initDataUnsafe?.user;
        const tgId = user?.id ? String(user.id) : (telegramId || localStorage.getItem('roy_user_id') || '');
        const name = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username ? `@${user.username}` : (userName || `User #${tgId}`));

        if (tgId && tgId !== telegramId) {
          setTelegramId(tgId);
          localStorage.setItem('roy_user_id', tgId);
        }
        if (name && name !== userName) {
          setUserName(name);
        }

        console.log(`[TELEGRAM_USER] User identified from WebApp initDataUnsafe:`, { telegramId: tgId, username: user?.username || '', firstName: user?.first_name || '', lastName: user?.last_name || '' });

        // Authenticate user in Firestore via backend API
        fetch('/api/webapp-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: tgId,
            username: user?.username || '',
            firstName: user?.first_name || '',
            lastName: user?.last_name || '',
            initData: tg?.initData || '',
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              console.log(`[AUTO_LOGIN_SUCCESS] Zero-click Telegram authentication successful in Firestore for Telegram ID: ${tgId}`);
            }
          })
          .catch((err) => console.error('[WEBAPP_AUTH] Zero-click auth error:', err));

        if (startParam.includes('live_event') || startParam === 'live_event' || !startParam) {
          console.log(`[ROUTE_WAITING_LOBBY] Immediately routing user to Waiting Lobby for startapp: ${startParam || 'live_event'}`);
        }
      } else {
        if (!telegramId) {
          const genId = 'user_' + Math.floor(100000 + Math.random() * 900000);
          setTelegramId(genId);
          localStorage.setItem('roy_user_id', genId);
        }
      }
    } catch (e) {
      console.warn('[WEBAPP_AUTH] Telegram WebApp init warning:', e);
    }
  }, []);

  // Poll event status every 2s
  const fetchActiveEvent = async () => {
    try {
      const queryId = encodeURIComponent(telegramId || 'anon');
      const res = await fetch(`/api/live-event/active?userId=${queryId}&telegramId=${queryId}`);
      const data = await res.json();

      if (data.success && data.activeEvent) {
        const ev: LiveEventData = data.activeEvent;
        setEventData(ev);
        setServerError('');

        const now = Date.now();

        if (ev.userAlreadyClaimedCode) {
          setClaimedCode(ev.userAlreadyClaimedCode);
        }

        const effectiveUnlockTime = ev.unlockAt || ev.unlockTime || ev.unlocksAt || now;
        const diff = Math.max(0, Math.ceil((effectiveUnlockTime - now) / 1000));
        setRemainingSeconds(diff);

        if (now > ev.expiresAt || ev.status === 'ended' || ev.eventStatus === 'ENDED') {
          setEventExpired(true);
        } else {
          setEventExpired(false);
        }
      } else {
        setEventData(null);
        setServerError(data.message || '⌛ This redeem event has ended.');
      }
    } catch (err: any) {
      console.error('Failed to fetch active live event:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveEvent();
    const interval = setInterval(fetchActiveEvent, 2000); // 2s real-time sync
    return () => clearInterval(interval);
  }, [telegramId]);

  // Smooth local timer ticker for synchronized countdown
  useEffect(() => {
    if (!eventData || eventExpired || (eventData.eventStatus !== 'LIVE_COUNTDOWN' && eventData.eventStatus !== 'LIVE')) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const targetTime = eventData.unlockAt || eventData.unlockTime || eventData.unlocksAt || now;
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setRemainingSeconds(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [eventData, eventExpired]);

  // Handle Synchronized Code Release Animation Sequence
  useEffect(() => {
    if (!eventData) return;

    const isReleasedNow = Boolean(eventData.isReleased || eventData.eventStatus === 'RELEASED');

    if (isReleasedNow && !hasSeenUnlockAnim && !isDecryptingAnim) {
      setIsDecryptingAnim(true);
      setUnlockAnimProgress(10);
      setAnimStepText('🔒 Code Locked...');

      const t1 = setTimeout(() => {
        setUnlockAnimProgress(30);
        setAnimStepText('Decrypting Secure Code...');
      }, 500);

      const t2 = setTimeout(() => {
        setUnlockAnimProgress(50);
        setAnimStepText('Decrypting Secure Code... (50%)');
      }, 1000);

      const t3 = setTimeout(() => {
        setUnlockAnimProgress(75);
        setAnimStepText('Decrypting Secure Code... (75%)');
      }, 1500);

      const t4 = setTimeout(() => {
        setUnlockAnimProgress(100);
        setAnimStepText('🔓 Code Released Successfully!');
      }, 2000);

      const t5 = setTimeout(() => {
        setIsDecryptingAnim(false);
        setHasSeenUnlockAnim(true);
        if (!typingStartTime) {
          setTypingStartTime(Date.now());
        }
      }, 2400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [eventData?.isReleased, eventData?.eventStatus, hasSeenUnlockAnim, isDecryptingAnim]);

  // Handle Submit "I'M READY" status
  const handleSubmitReady = async () => {
    setIsReadySubmitting(true);
    setClaimStatusMsg(null);

    try {
      const res = await fetch('/api/live-event/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramId,
          telegramId: telegramId,
          userName: userName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setClaimStatusMsg({ type: 'success', text: '🙋 Ready status submitted successfully! Waiting for more participants...' });
        // Immediately trigger local refresh
        fetchActiveEvent();
      } else {
        setClaimStatusMsg({ type: 'error', text: data.error || 'Failed to submit ready status.' });
      }
    } catch (err: any) {
      setClaimStatusMsg({ type: 'error', text: err.message || 'Network error submitting ready status.' });
    } finally {
      setIsReadySubmitting(false);
    }
  };

  // Handle Claim Button Press
  const handleClaimCode = async () => {
    if (!inputCode.trim()) {
      setClaimStatusMsg({ type: 'error', text: 'Please enter or paste the redeem code.' });
      return;
    }

    const finishTime = Date.now();
    const startTime = typingStartTime || finishTime;
    const computedSpeedSec = Math.max(0.01, Number(((finishTime - startTime) / 1000).toFixed(2)));
    setTypingSpeedResult(computedSpeedSec);

    setIsClaiming(true);
    setClaimStatusMsg(null);
    setQueueStatus('⏳ Entering Smart Queue...');

    try {
      const res = await fetch('/api/live-event/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramId,
          telegramId: telegramId,
          userName: userName,
          code: inputCode.trim(),
          typingSpeedSec: computedSpeedSec,
          pasteDetected: pasteDetected,
        }),
      });

      const data = await res.json();

      if (data.queueNumber) {
        setQueueStatus(`⚡ Queue #${data.queueNumber} Processed (Position: ${data.queuePosition || 0})`);
      }

      if (data.success) {
        setClaimedCode(data.code || inputCode.trim());
        setClaimStatusMsg({ type: 'success', text: `🎉 Code Claimed! Typing Speed: ${computedSpeedSec} sec (Queue #${data.queueNumber || 1})` });
      } else {
        const errorText = data.error || 'Failed to claim code';
        setClaimStatusMsg({ type: 'error', text: errorText });
        if (errorText.includes('ended') || errorText.includes('out of stock')) {
          setEventExpired(true);
        }
      }
    } catch (err: any) {
      setClaimStatusMsg({ type: 'error', text: err.message || 'Network error claiming code' });
    } finally {
      setIsClaiming(false);
    }
  };

  // Copy Code with Clipboard API
  const handleCopyCode = () => {
    if (!claimedCode) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(claimedCode);
      } else {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && typeof tg.copyTextToClipboard === 'function') {
          tg.copyTextToClipboard(claimedCode);
        }
      }
    } catch (e) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = claimedCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {}
    }

    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  // Screenshot Upload Handler
  const handleUploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const imageBase64 = reader.result as string;

        const res = await fetch('/api/live-event/upload-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: telegramId,
            telegramId: telegramId,
            userName: userName,
            code: claimedCode || 'ROY500',
            imageBase64,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setUploadSuccess(true);
        } else {
          setUploadError(data.error || 'Failed to upload screenshot proof.');
        }
        setIsUploading(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read image file.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading screenshot.');
      setIsUploading(false);
    }
  };

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  // CONDITIONAL congratulations SCREEN (Strictly nothing else)
  if (claimedCode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans select-none">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-3xl font-black text-amber-300">🎉 Congratulations</h1>
          
          <div className="py-5 px-6 rounded-2xl bg-slate-900 border-2 border-amber-500/50 my-4 shadow-xl">
            <span className="text-4xl font-mono font-black text-amber-400 tracking-widest select-all">
              {claimedCode}
            </span>
          </div>

          <div className="space-y-3">
            {/* Copy Code Button */}
            <button
              type="button"
              onClick={handleCopyCode}
              className={`w-full py-4 px-6 rounded-2xl text-base font-black transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-xl'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-xl'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-slate-950" />
                  <span>✅ Copied Successfully</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-slate-950" />
                  <span>📋 Copy Code</span>
                </>
              )}
            </button>

            {/* Screenshot Upload Section */}
            {uploadSuccess ? (
              <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/50 space-y-2 text-center animate-in fade-in duration-300">
                <h3 className="text-base font-black text-emerald-300">
                  ✅ Screenshot Uploaded Successfully
                </h3>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <label
                  htmlFor="screenshot-upload-input"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) {
                      handleUploadFile(file);
                    }
                  }}
                  className={`w-full py-6 px-4 rounded-2xl border text-base font-black flex flex-col items-center justify-center gap-2 cursor-pointer transition shadow-lg ${
                    isUploading
                      ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                      : isDragging
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 scale-[1.02]'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      <span>Uploading Screenshot to Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-amber-400" />
                      <span>📷 Drag & Drop or Click to Upload Screenshot</span>
                    </>
                  )}
                </label>

                <input
                  id="screenshot-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotSelect}
                  disabled={isUploading}
                  className="hidden"
                />

                {uploadError && (
                  <p className="text-xs text-rose-400 font-bold mt-2">{uploadError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
          <Gift className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-sm font-semibold text-slate-300 animate-pulse">
          Connecting to Roy Wallet Live Event...
        </p>
      </div>
    );
  }

  const isFinished = eventExpired || !eventData || eventData.eventStatus === 'ENDED' || eventData.remainingCodesCount <= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-gradient-to-tr from-amber-500/20 via-orange-500/10 to-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Top Header Bar with LiveNotificationCenter & Sandbox Mode toggle */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 pt-2 gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleToggleSandbox}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              isSandboxMode
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Admin Sandbox Test Mode"
          >
            <TestTube className="w-3.5 h-3.5" />
            <span>{isSandboxMode ? '🧪 Sandbox Active' : '🧪 Sandbox'}</span>
          </button>

          <button
            onClick={() => setIsReplayModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition shadow-lg"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>

          <LiveNotificationCenter telegramId={telegramId} />
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="w-full max-w-xl my-3 flex items-center justify-center p-1 rounded-2xl border border-slate-800 bg-slate-900/90 z-10 gap-1 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'live'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Live Arena</span>
        </button>

        <button
          onClick={() => setActiveTab('spectator')}
          className={`px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'spectator'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-red-500" />
          <span>Spectator</span>
        </button>

        <button
          onClick={() => setActiveTab('seasons')}
          className={`px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'seasons'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Seasons</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Tab Views */}
      {activeTab === 'spectator' ? (
        <div className="w-full max-w-2xl z-10 my-4">
          <SpectatorView
            eventData={eventData}
            onExitSpectator={() => setActiveTab('live')}
          />
        </div>
      ) : activeTab === 'seasons' ? (
        <div className="w-full max-w-3xl z-10 my-4">
          <SeasonsView />
        </div>
      ) : activeTab === 'analytics' ? (
        <div className="w-full max-w-4xl z-10 my-4">
          <EventAnalyticsView />
        </div>
      ) : activeTab === 'history' ? (
        <div className="w-full max-w-2xl z-10 my-4">
          <UserRedeemHistory telegramId={telegramId} />
        </div>
      ) : (
        /* Main Content Area: Live Arena */
        <div className="w-full max-w-md my-auto flex flex-col items-center text-center z-10 py-6 space-y-6">

        {isFinished ? (
          /* EVENT FINISHED / OUT OF STOCK VIEW WITH WINNERS TIMELINE */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-5 text-center font-sans">
            <div className="text-slate-400 font-mono text-xs tracking-widest">
              ━━━━━━━━━━━━━━
            </div>

            <div className="space-y-1">
              <div className="text-3xl mb-1">🎉</div>
              <h2 className="text-2xl font-black text-amber-300">Event Finished</h2>
              <p className="text-xs text-slate-400 font-mono">Official Winner Timeline & Results</p>
            </div>

            {/* Winner Timeline Cards */}
            {eventData?.winnersTimeline && eventData.winnersTimeline.length > 0 && (
              <div className="space-y-2 text-left font-mono text-xs max-h-56 overflow-y-auto pr-1">
                <span className="text-[10px] font-bold text-amber-400 block uppercase">🏆 Winner Timeline:</span>
                {eventData.winnersTimeline.map((winner: any) => (
                  <div key={winner.rank} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                        winner.rank === 1 ? 'bg-amber-400 text-slate-950' : winner.rank === 2 ? 'bg-slate-300 text-slate-950' : winner.rank === 3 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-300'
                      }`}>
                        #{winner.rank}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-200 block truncate">{winner.userName}</span>
                        <span className="text-[10px] text-slate-500 block">{winner.typingSpeedSec}s speed</span>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-black text-xs">+{winner.reward} pts</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1">
              <span>Thank you for participating</span>
            </p>

            <div className="text-slate-400 font-mono text-xs tracking-widest">
              ━━━━━━━━━━━━━━
            </div>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition shadow-lg"
            >
              🤖 Return to Roy Wallet Bot
            </a>
          </div>
        ) : (
          /* ACTIVE EVENT VIEW */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 backdrop-blur-md space-y-6">
            
            {/* Title Header */}
            <div className="space-y-1">
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 flex items-center justify-center gap-2">
                <Gift className="w-6 h-6 text-amber-400 inline-block animate-bounce" />
                <span>LIVE REDEEM EVENT</span>
              </h1>
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>
            </div>

            {/* GHOST MODE BANNER */}
            {eventData?.isGhostMode && (
              <div className="p-3.5 rounded-2xl bg-purple-950/80 border border-purple-500/50 text-purple-200 text-center text-xs font-mono font-bold space-y-0.5 shadow-xl">
                <span>👻 GHOST MODE ACTIVE</span>
                <p className="text-[10px] text-purple-300 font-normal">Statistics, rankings & claims are hidden until event ends.</p>
              </div>
            )}

            {/* SECURITY SCORE BADGE */}
            {eventData?.userSecurityScore && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-400 font-sans text-[11px]">🛡️ Your Security Score:</span>
                <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                  eventData.userSecurityScore.badge === 'TRUSTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : eventData.userSecurityScore.badge === 'SUSPICIOUS'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {eventData.userSecurityScore.score}/100 • {eventData.userSecurityScore.badge}
                </span>
              </div>
            )}

            {/* EMERGENCY LOCK ALERT BANNER */}
            {(eventData?.isLocked || eventData?.eventStatus === 'LOCKED') && (
              <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-500 text-red-200 text-center space-y-1 animate-pulse shadow-2xl">
                <div className="text-2xl">🚨</div>
                <h3 className="text-sm font-black text-red-300 uppercase">Event Temporarily Locked</h3>
                <p className="text-xs text-red-400 font-mono">Please wait for Admin.</p>
              </div>
            )}

            {/* LIVE WAITING LOBBY HUD */}
            <div className="grid grid-cols-3 gap-2 py-1 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 block uppercase font-sans">👥 Online</span>
                <span className="text-amber-400 font-black text-sm">{eventData?.onlineUsersCount || 1}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 block uppercase font-sans">🙋 Ready</span>
                <span className="text-emerald-400 font-black text-sm">{eventData?.readyCount || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 block uppercase font-sans">⏳ Status</span>
                <span className={`font-black text-xs ${
                  eventData?.isLocked || eventData?.eventStatus === 'LOCKED'
                    ? 'text-red-400'
                    : eventData?.isReleased || eventData?.eventStatus === 'RELEASED'
                    ? 'text-emerald-400'
                    : 'text-amber-400 animate-pulse'
                }`}>
                  {eventData?.isLocked || eventData?.eventStatus === 'LOCKED'
                    ? 'LOCKED'
                    : eventData?.isReleased || eventData?.eventStatus === 'RELEASED'
                    ? 'RELEASED'
                    : 'WAITING'}
                </span>
              </div>
            </div>

            {/* LIVE DECRYPTION ANIMATION CONSOLE */}
            {isDecryptingAnim ? (
              <div className="p-5 rounded-2xl bg-slate-950 border-2 border-emerald-500/60 font-mono space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-bold border-b border-slate-800 pb-2">
                  <span>🔓 DECRYPTION IN PROGRESS</span>
                  <span className="text-amber-400 font-black">{unlockAnimProgress}%</span>
                </div>

                <div className="space-y-1 text-left text-xs">
                  <div className="text-slate-300 font-bold text-center py-2">{animStepText}</div>
                  <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden border border-slate-800 my-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 h-full transition-all duration-300 ease-out"
                      style={{ width: `${unlockAnimProgress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                    <span>10%</span>
                    <span>30%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            ) : !(eventData?.isReleased || eventData?.eventStatus === 'RELEASED') ? (
              /* LOBBY / BEFORE RELEASE STATE */
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>⏳ Waiting for Admin to release redeem code...</span>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-400 block">Paste Redeem Code</label>
                  <input
                    type="text"
                    disabled={true}
                    placeholder="Waiting for Admin..."
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-500 font-mono text-center text-sm cursor-not-allowed select-none"
                  />
                  <button
                    type="button"
                    disabled={true}
                    className="w-full py-4 px-6 rounded-2xl text-base font-black bg-slate-800 text-slate-500 border border-slate-700/60 flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>Submit</span>
                  </button>
                </div>
              </div>
            ) : (
              /* RELEASED STATE -> INPUT ENABLED & TYPING SPEED MEASURED */
              <div className="space-y-4 py-2 animate-in fade-in zoom-in duration-300">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 animate-pulse">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>🔓 Redeem Code Released! Enter code below:</span>
                </div>

                {typingSpeedResult && (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-black flex items-center justify-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>⚡ Typing Speed: {typingSpeedResult.toFixed(2)} sec</span>
                  </div>
                )}

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-amber-300 block">Paste Redeem Code</label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    placeholder="ENTER REDEEM CODE"
                    disabled={isClaiming || Boolean(eventData?.isLocked || eventData?.eventStatus === 'LOCKED')}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border-2 border-amber-500/60 text-amber-300 font-mono font-bold text-center text-lg uppercase tracking-wider focus:outline-none focus:border-amber-400 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleClaimCode}
                    disabled={isClaiming || !inputCode.trim() || Boolean(eventData?.isLocked || eventData?.eventStatus === 'LOCKED')}
                    className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-500/20 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isClaiming ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Validating Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* LIVE SERVER HEALTH METRICS PANEL (Admin / Health HUD) */}
            {eventData?.serverHealth && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 font-mono text-[11px] shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    LIVE EVENT HEALTH (2s Sync)
                  </span>
                  <span className="text-[10px] text-slate-400">{eventData.serverHealth.serverStatus}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">⚡ Req / sec:</span>
                    <span className="text-amber-400 font-bold">{eventData.serverHealth.requestsPerSec} req/s</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">🔥 CPU Load:</span>
                    <span className="text-orange-400 font-bold">{eventData.serverHealth.cpuLoad}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">💾 Memory:</span>
                    <span className="text-cyan-400 font-bold">{eventData.serverHealth.memoryUsageMB}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">📡 Response / DB:</span>
                    <span className="text-emerald-400 font-bold">{eventData.serverHealth.responseTimeMs} / {eventData.serverHealth.dbLatencyMs}</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 flex justify-between pt-1 border-t border-slate-900">
                  <span>Firestore: {eventData.serverHealth.firestoreStatus}</span>
                  <span>Telegram: {eventData.serverHealth.telegramApiStatus}</span>
                </div>
              </div>
            )}

            {/* LIVE ACTIVITY TICKER FEED */}
            {eventData?.activityFeed && eventData.activityFeed.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-left space-y-1 font-mono text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">⚡ Live Activity Feed:</span>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {eventData.activityFeed.slice(-5).reverse().map((item: any, idx: number) => (
                    <div key={item.id || idx} className="flex items-center justify-between text-slate-300 gap-1.5">
                      <span className="truncate">{item.icon || '⚡'} {item.text}</span>
                      <span className="text-[9px] text-slate-500 shrink-0">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Queue Processing Status */}
      {queueStatus && (
        <div className="w-full max-w-md p-3 rounded-2xl text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center gap-2 mb-2 animate-pulse">
          <span>{queueStatus}</span>
        </div>
      )}

      {/* Claim Status Error / Info Alert */}
      {claimStatusMsg && (
        <div
          className={`w-full max-w-md p-3.5 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 mb-4 ${
            claimStatusMsg.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          }`}
        >
          {claimStatusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{claimStatusMsg.text}</span>
        </div>
      )}

      {serverError && !eventData && (
        <p className="text-xs text-rose-400 font-medium mb-4">{serverError}</p>
      )}

      {/* Footer / Security Badge */}
      <div className="w-full max-w-md text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2 z-10 pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Server Validated • One Claim Per Telegram Account</span>
      </div>

      {/* Live Event Replay Modal */}
      <LiveReplayModal
        isOpen={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
        eventId={eventData?.id}
      />
    </div>
  );
};
