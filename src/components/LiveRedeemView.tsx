import React, { useState, useEffect, useRef } from 'react';
import { Gift, Zap, ShieldCheck, Copy, Check, Clock, AlertTriangle, Sparkles, RefreshCw, ArrowLeft, Users, CheckCircle2, Camera, Heart } from 'lucide-react';

interface LiveEventData {
  id: string;
  status: 'active' | 'ended';
  eventStatus: 'WAITING_FOR_READY' | 'LIVE' | 'ENDED';
  unlocksAt: number;
  unlockTime: number;
  unlockAt: number;
  expiresAt: number;
  maxUses: number;
  claimedCount: number;
  remainingCodesCount: number;
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
  summaryStats?: {
    totalParticipants: number;
    successfulClaims: number;
    remainingCodes: number;
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

  // Claim & Copy states
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimedCode, setClaimedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showCopyToast, setShowCopyToast] = useState<boolean>(false);
  const [claimStatusMsg, setClaimStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Screenshot Upload states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  // Auto-generate fallback Telegram ID if not in Telegram WebApp
  useEffect(() => {
    if (!telegramId) {
      const genId = 'user_' + Math.floor(100000 + Math.random() * 900000);
      setTelegramId(genId);
      localStorage.setItem('roy_user_id', genId);
    }
  }, [telegramId]);

  // Expand Telegram WebApp if available
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        if (typeof tg.expand === 'function') {
          tg.expand();
        }
      }
    } catch (e) {}
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
    if (!eventData || eventExpired || eventData.eventStatus !== 'LIVE') return;

    const timer = setInterval(() => {
      const now = Date.now();
      const targetTime = eventData.unlockAt || eventData.unlockTime || eventData.unlocksAt || now;
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setRemainingSeconds(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [eventData, eventExpired]);

  // Handle Claim Button Press
  const handleClaimCode = async () => {
    if (remainingSeconds > 0) {
      setClaimStatusMsg({ type: 'error', text: '⏳ Countdown has not finished yet!' });
      return;
    }

    setIsClaiming(true);
    setClaimStatusMsg(null);

    try {
      const res = await fetch('/api/live-event/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramId,
          telegramId: telegramId,
          userName: userName,
        }),
      });

      const data = await res.json();

      if (data.success && data.code) {
        setClaimedCode(data.code);
        setClaimStatusMsg({ type: 'success', text: '🎉 Code Claimed Successfully!' });
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

  // STEP 5: Copy Code with Telegram Mini App Clipboard API & Toast Animation
  const handleCopyCode = () => {
    if (!claimedCode) return;

    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && typeof tg.copyTextToClipboard === 'function') {
        tg.copyTextToClipboard(claimedCode);
      } else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(claimedCode);
      }
    } catch (e) {
      try {
        navigator.clipboard.writeText(claimedCode);
      } catch (err) {}
    }

    setCopied(true);
    setShowCopyToast(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);

    setTimeout(() => {
      setShowCopyToast(false);
    }, 3500);
  };

  // STEP 6 & 7: Screenshot Upload Handler
  const handleScreenshotSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full text-xs font-bold text-amber-400 shadow-lg shadow-amber-500/10 ml-auto">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>ROY WALLET LIVE</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-md my-auto flex flex-col items-center text-center z-10 py-6 space-y-6">

        {/* STEP 5, 6, 7, 8: CLAIM SCREEN (When Code Unlocked & Claimed) */}
        {claimedCode ? (
          <div className="w-full bg-slate-900/95 border border-amber-500/40 rounded-3xl p-6 shadow-2xl shadow-amber-500/20 backdrop-blur-md space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Center Premium Card */}
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>

              <div className="space-y-1">
                <div className="text-3xl mb-1">🎉</div>
                <h2 className="text-2xl font-black text-amber-300 tracking-tight">
                  Congratulations
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Your Redeem Code
                </p>
              </div>

              <div className="py-3 px-4 rounded-2xl bg-slate-950 border-2 border-amber-500/50 shadow-inner my-2">
                <code className="text-2xl sm:text-3xl font-mono font-black text-amber-300 tracking-widest select-all">
                  {claimedCode}
                </code>
              </div>

              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>
            </div>

            {/* Copy Code Button */}
            <button
              type="button"
              onClick={handleCopyCode}
              className={`w-full py-4 px-6 rounded-2xl text-base font-black transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-500/25'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-slate-950" />
                  <span>✅ Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-slate-950" />
                  <span>📋 Copy Code</span>
                </>
              )}
            </button>

            {/* Copy Toast Notification */}
            {showCopyToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-200 shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>✅ Code Copied Successfully</span>
              </div>
            )}

            {/* STEP 6 & 8: Screenshot Upload Section */}
            {uploadSuccess ? (
              <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/50 space-y-2 text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-base font-black text-emerald-300">
                  ✅ Screenshot Uploaded Successfully
                </h3>
                <p className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1">
                  <span>Thank You</span>
                  <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 inline-block" />
                </p>
                <p className="text-xs text-slate-400">
                  Your proof has been submitted.
                </p>
              </div>
            ) : (
              <div className="pt-2 space-y-3">
                <label
                  htmlFor="screenshot-upload-input"
                  className={`w-full py-4 px-4 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow-lg ${
                    isUploading
                      ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Uploading Screenshot to Telegram Proof Channel...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>📷 Upload Redemption Screenshot</span>
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
                  <p className="text-xs text-rose-400 font-bold">{uploadError}</p>
                )}
              </div>
            )}
          </div>
        ) : isFinished ? (
          /* EVENT FINISHED / OUT OF STOCK VIEW */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-5 text-center font-sans">
            <div className="text-slate-400 font-mono text-xs tracking-widest">
              ━━━━━━━━━━━━━━
            </div>

            <div className="space-y-1">
              <div className="text-3xl mb-1">🎉</div>
              <h2 className="text-2xl font-black text-amber-300">Event Finished</h2>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 font-mono text-xs text-left">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Total Participants</span>
                <span className="font-bold text-amber-400 text-sm">
                  {eventData?.summaryStats?.totalParticipants || eventData?.readyCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Successful Claims</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {eventData?.summaryStats?.successfulClaims || eventData?.claimedCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Remaining Codes</span>
                <span className="font-bold text-rose-400 text-sm">
                  {eventData?.summaryStats?.remainingCodes ?? 0}
                </span>
              </div>
            </div>

            <p className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1">
              <span>Thank you for participating</span>
              <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
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
          /* ACTIVE EVENT VIEW (STEP 2 & STEP 3 & STEP 4) */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 backdrop-blur-md space-y-6">
            
            {/* Title Header */}
            <div className="space-y-1">
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 flex items-center justify-center gap-2">
                <Gift className="w-6 h-6 text-amber-400 inline-block" />
                <span>LIVE REDEEM EVENT</span>
              </h1>
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
                ━━━━━━━━━━━━━━
              </span>
            </div>

            {/* STEP 2: ANIMATED COUNTDOWN STAGE (When remainingSeconds > 0) */}
            {remainingSeconds > 0 ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" /> Live Countdown
                  </span>
                  <span>Online: {eventData.onlineUsersCount}</span>
                </div>

                <p className="text-xs font-bold text-slate-300">
                  ⏳ Code unlocks in {remainingSeconds} seconds.
                </p>

                {/* Animated Synchronized Countdown Display */}
                <div className="relative py-3">
                  <div className="text-6xl sm:text-7xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 drop-shadow-lg transition-all duration-300 transform scale-105 animate-pulse">
                    {remainingSeconds}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest block mt-1">
                    seconds remaining
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Remaining Stock:</span>
                    <span className="text-amber-400 font-bold">
                      {eventData.remainingCodesCount} / {eventData.totalCodesCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server Status:</span>
                    <span className="text-sky-400 font-bold">🔒 Synchronized</span>
                  </div>
                </div>
              </div>
            ) : (
              /* STEP 3 & STEP 4: COUNTDOWN FINISHED -> SHOW MASKED CODE & "🎁 Claim Now" BUTTON */
              <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-amber-300 flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6 text-amber-400 animate-bounce" />
                    <span>🎉 Code Unlocked</span>
                  </h2>
                </div>

                {/* Masked Code Display */}
                <div className="py-3 px-4 rounded-2xl bg-slate-950 border-2 border-amber-500/40 shadow-inner">
                  <code className="text-2xl font-mono font-black tracking-widest text-amber-400/80 blur-[1px]">
                    {eventData.maskedCode || 'Roy***99'}
                  </code>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">
                    (Code is hidden until claimed)
                  </p>
                </div>

                {/* STEP 4: 🎁 Claim Now BUTTON */}
                <button
                  type="button"
                  onClick={handleClaimCode}
                  disabled={isClaiming}
                  className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-500/25 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Validating Claim...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping inline-block" />
                      <span>🎁 Claim Now</span>
                    </>
                  )}
                </button>

                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Stock Left: {eventData.remainingCodesCount}</span>
                  <span>Server Validated ✓</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim Status Error / Info Alert */}
        {claimStatusMsg && (
          <div
            className={`w-full p-3.5 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 ${
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
          <p className="text-xs text-rose-400 font-medium">{serverError}</p>
        )}
      </div>

      {/* Footer / Security Badge */}
      <div className="w-full max-w-md text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2 z-10 pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Server Validated • One Claim Per Telegram Account</span>
      </div>
    </div>
  );
};
