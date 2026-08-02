import React, { useState, useEffect } from 'react';
import { Gift, Zap, ShieldCheck, Copy, Check, Clock, AlertTriangle, Sparkles, RefreshCw, ArrowLeft, Users, CheckCircle2 } from 'lucide-react';

interface LiveEventData {
  id: string;
  status: 'active' | 'ended';
  eventStatus: 'WAITING_FOR_READY' | 'LIVE' | 'ENDED';
  unlocksAt: number;
  unlockTime: number;
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
  userAlreadyClaimedCode?: string;
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
  
  // Countdown states
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [eventExpired, setEventExpired] = useState<boolean>(false);

  // User details
  const [userHandle, setUserHandle] = useState<string>(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        return u.username ? `@${u.username}` : String(u.id);
      }
    } catch (e) {}
    return localStorage.getItem('roy_user_id') || '';
  });

  const [userPhone, setUserPhone] = useState<string>(() => {
    return localStorage.getItem('roy_user_phone') || '';
  });

  // Ready state
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isSubmittingReady, setIsSubmittingReady] = useState<boolean>(false);

  // Claim states
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimedCode, setClaimedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [claimStatusMsg, setClaimStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Ensure user ID exists in localStorage
  useEffect(() => {
    if (!userHandle) {
      const genId = 'user_' + Math.floor(100000 + Math.random() * 900000);
      setUserHandle(genId);
      localStorage.setItem('roy_user_id', genId);
    }
  }, [userHandle]);

  // Heartbeat & status polling (every 2s)
  const fetchActiveEvent = async () => {
    try {
      const queryId = encodeURIComponent(userHandle || 'anon');
      const res = await fetch(`/api/live-event/active?userId=${queryId}&telegramId=${queryId}`);
      const data = await res.json();

      if (data.success && data.activeEvent) {
        const ev: LiveEventData = data.activeEvent;
        setEventData(ev);
        setServerError('');

        const now = Date.now();

        if (ev.isUserReady) {
          setIsReady(true);
        }

        if (ev.userAlreadyClaimedCode) {
          setClaimedCode(ev.userAlreadyClaimedCode);
        }

        const effectiveUnlockTime = ev.unlockTime || ev.unlocksAt || now;
        const unlockDiff = Math.max(0, Math.ceil((effectiveUnlockTime - now) / 1000));
        setRemainingSeconds(unlockDiff);

        if (ev.eventStatus === 'LIVE' && now >= effectiveUnlockTime) {
          setIsUnlocked(true);
        } else {
          setIsUnlocked(false);
        }

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
    const interval = setInterval(fetchActiveEvent, 2000); // 2s live refresh
    return () => clearInterval(interval);
  }, [userHandle]);

  // Smooth local countdown timer
  useEffect(() => {
    if (!eventData || eventExpired || eventData.eventStatus !== 'LIVE') return;

    const timer = setInterval(() => {
      const now = Date.now();
      const targetTime = eventData.unlockTime || eventData.unlocksAt;
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setRemainingSeconds(diff);

      if (now >= targetTime) {
        setIsUnlocked(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [eventData, eventExpired]);

  // Handle "I'M READY" button click
  const handleReadyClick = async () => {
    if (!userHandle) return;

    setIsSubmittingReady(true);
    try {
      const res = await fetch('/api/live-event/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userHandle,
          telegramId: userHandle,
          phone: userPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsReady(true);
        fetchActiveEvent();
      } else {
        setClaimStatusMsg({ type: 'error', text: data.error || 'Failed to submit ready status' });
      }
    } catch (err: any) {
      setClaimStatusMsg({ type: 'error', text: err.message || 'Network error submitting ready status' });
    } finally {
      setIsSubmittingReady(false);
    }
  };

  // Handle claim code
  const handleClaimCode = async () => {
    if (!isUnlocked) {
      setClaimStatusMsg({ type: 'error', text: '⏳ Countdown has not finished yet!' });
      return;
    }

    if (userPhone) {
      localStorage.setItem('roy_user_phone', userPhone);
    }

    setIsClaiming(true);
    setClaimStatusMsg(null);

    try {
      const res = await fetch('/api/live-event/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userHandle,
          telegramId: userHandle,
          phone: userPhone,
          deviceId: `device_${userHandle}`,
        }),
      });

      const data = await res.json();

      if (data.success && data.code) {
        setClaimedCode(data.code);
        setClaimStatusMsg({ type: 'success', text: '🎉 Code Claimed Successfully!' });
      } else {
        const errorText = data.error || 'Failed to claim code';
        setClaimStatusMsg({ type: 'error', text: errorText });
        if (errorText.includes('ended')) {
          setEventExpired(true);
        }
      }
    } catch (err: any) {
      setClaimStatusMsg({ type: 'error', text: err.message || 'Network error claiming code' });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyCode = () => {
    if (!claimedCode) return;
    navigator.clipboard.writeText(claimedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
          <Gift className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-sm font-semibold text-slate-300 animate-pulse">
          Connecting to Roy Wallet Live Redeem System...
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

      {/* Main Container */}
      <div className="w-full max-w-md my-auto flex flex-col items-center text-center z-10 py-6 space-y-6">
        {/* Banner Title */}
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
            ━━━━━━━━━━━━━━
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 flex items-center justify-center gap-2">
            <Gift className="w-7 h-7 text-amber-400 inline-block" />
            <span>LIVE REDEEM EVENT</span>
          </h1>
          <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase block">
            ━━━━━━━━━━━━━━
          </span>
        </div>

        {/* Case 1: Code Already Claimed Successfully */}
        {claimedCode ? (
          <div className="w-full bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur-md space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-emerald-300">🎉 Your Redeem Code</h2>
              <p className="text-xs text-slate-400 mt-1">Copy and redeem inside Roy Wallet Bot instantly!</p>
            </div>

            <div className="bg-slate-950 border-2 border-emerald-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner">
              <code className="text-xl sm:text-2xl font-mono font-black tracking-widest text-emerald-300 select-all">
                {claimedCode}
              </code>

              <button
                type="button"
                onClick={handleCopyCode}
                className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center justify-center shadow-md active:scale-95"
                title="Tap to copy"
              >
                {copied ? <Check className="w-5 h-5 text-slate-950" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
              <span>📋 Tap button above to copy code.</span>
            </p>
          </div>
        ) : isFinished ? (
          /* Case 2: MANDATED EVENT END SCREEN (#5) */
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
              <span>Thank you for participating ❤️</span>
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
          /* Case 3: Active Event View */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 backdrop-blur-md space-y-6">
            
            {/* STEP 1: READY SYSTEM - User must press "🟢 I'M READY" */}
            {!isReady ? (
              <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Users className="w-8 h-8 text-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white">Join the Live Event</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Press <span className="text-emerald-400 font-bold">🟢 I'M READY</span> below to confirm your spot for code unlock!
                  </p>
                </div>

                {/* Ready Status Bar */}
                {eventData.minReadyUsers > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Ready Requirement:</span>
                      <span className="text-amber-400 font-bold">
                        {eventData.readyCount} / {eventData.minReadyUsers} Users
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((eventData.readyCount || 0) / (eventData.minReadyUsers || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 🟢 I'M READY BUTTON */}
                <button
                  type="button"
                  onClick={handleReadyClick}
                  disabled={isSubmittingReady}
                  className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingReady ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Updating Status...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-950 animate-ping inline-block" />
                      <span>🟢 I'M READY</span>
                    </>
                  )}
                </button>
              </div>
            ) : eventData.eventStatus === 'WAITING_FOR_READY' ? (
              /* Waiting for Minimum Ready Users */
              <div className="space-y-4 py-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-bounce">
                  <Clock className="w-7 h-7 text-amber-400" />
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>You are Ready!</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-200 pt-2">Waiting for Participants</h2>
                  <p className="text-xs text-slate-400">
                    Countdown starts as soon as minimum ready threshold is met!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Ready Users:</span>
                    <span className="text-amber-400 font-extrabold text-sm">
                      {eventData.readyCount} / {eventData.minReadyUsers}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((eventData.readyCount || 0) / (eventData.minReadyUsers || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : !isUnlocked ? (
              /* Countdown Stage */
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready ✓
                  </span>
                  <span>Online: {eventData.onlineUsersCount}</span>
                </div>

                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Code Unlocks In</span>
                </span>

                {/* Countdown Display */}
                <div className="relative py-2">
                  <div className="text-6xl sm:text-7xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 drop-shadow-lg transition-all duration-300 transform scale-105 animate-pulse">
                    {remainingSeconds}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest block mt-1">
                    seconds remaining
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Remaining Codes:</span>
                    <span className="text-amber-400 font-bold">
                      {eventData.remainingCodesCount} / {eventData.totalCodesCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-sky-400 font-bold">🔒 Synchronized Countdown</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Unlocked Stage: Ready to Claim */
              <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-emerald-400 flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-400 animate-bounce" />
                    <span>🎁 Code is Ready!</span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Tap the claim button below instantly to get your unused code!
                  </p>
                </div>

                {/* Optional Mobile Number Input for Anti-Cheat Verification */}
                <div className="text-left space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 block">
                    📱 Mobile Number (Anti-Cheat Security Check):
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="e.g. +1234567890 (optional)"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* CLAIM BUTTON */}
                <button
                  type="button"
                  onClick={handleClaimCode}
                  disabled={isClaiming}
                  className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Verifying Anti-Cheat...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping inline-block" />
                      <span>🟢 Claim Code</span>
                    </>
                  )}
                </button>

                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Stock Left: {eventData.remainingCodesCount}</span>
                  <span>Server Verified ✓</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Alert Message */}
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

      {/* Footer / Anti-Cheat Badge */}
      <div className="w-full max-w-md text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2 z-10 pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Anti-Cheat Protected • One Unused Code Per Unique User</span>
      </div>
    </div>
  );
};
