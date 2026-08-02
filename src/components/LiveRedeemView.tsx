import React, { useState, useEffect, useRef } from 'react';
import { Gift, Zap, ShieldCheck, Copy, Check, Clock, AlertTriangle, Sparkles, RefreshCw, ArrowLeft } from 'lucide-react';

interface LiveEventData {
  id: string;
  status: 'active' | 'ended';
  unlocksAt: number;
  expiresAt: number;
  maxUses: number;
  claimedCount: number;
  countdownSeconds: number;
  isUnlocked: boolean;
  code?: string;
  userAlreadyClaimedCode?: string;
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

  // User details for claiming
  const [userHandle, setUserHandle] = useState<string>(() => {
    try {
      // Try fetching from Telegram WebApp SDK if available
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        return u.username ? `@${u.username}` : String(u.id);
      }
    } catch (e) {}
    return '';
  });

  // Claim states
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimedCode, setClaimedCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [claimStatusMsg, setClaimStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Poll active event status from server
  const fetchActiveEvent = async () => {
    try {
      const res = await fetch('/api/live-event/active');
      const data = await res.json();

      if (data.success && data.activeEvent) {
        const ev: LiveEventData = data.activeEvent;
        setEventData(ev);
        setServerError('');

        const now = Date.now();

        if (ev.userAlreadyClaimedCode) {
          setClaimedCode(ev.userAlreadyClaimedCode);
        }

        // Calculate countdown
        const unlockDiff = Math.max(0, Math.ceil((ev.unlocksAt - now) / 1000));
        setRemainingSeconds(unlockDiff);

        if (now >= ev.unlocksAt) {
          setIsUnlocked(true);
        } else {
          setIsUnlocked(false);
        }

        if (now > ev.expiresAt || ev.status === 'ended') {
          setEventExpired(true);
        } else {
          setEventExpired(false);
        }
      } else {
        setEventData(null);
        if (data.message) {
          setServerError(data.message);
        } else {
          setServerError('⌛ This redeem event has ended.');
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch active live event:', err);
      setServerError('Network error fetching active event.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveEvent();
    const interval = setInterval(fetchActiveEvent, 3000); // Poll status every 3s
    return () => clearInterval(interval);
  }, []);

  // Local 1-second interval ticker for smooth countdown animation
  useEffect(() => {
    if (!eventData || eventExpired) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((eventData.unlocksAt - now) / 1000));
      setRemainingSeconds(diff);

      if (now >= eventData.unlocksAt) {
        setIsUnlocked(true);
      }

      if (now >= eventData.expiresAt) {
        setEventExpired(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [eventData, eventExpired]);

  // Handle claim action
  const handleClaimCode = async () => {
    if (!isUnlocked) {
      setClaimStatusMsg({ type: 'error', text: '⏳ Countdown has not finished yet!' });
      return;
    }

    const finalUserId = userHandle.trim() || 'webapp_user_' + Math.floor(Math.random() * 1000000);

    setIsClaiming(true);
    setClaimStatusMsg(null);

    try {
      const res = await fetch('/api/live-event/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: finalUserId,
          telegramId: finalUserId,
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
          Connecting to Live Redeem Event...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-gradient-to-tr from-amber-500/20 via-orange-500/10 to-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

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
          <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
            ━━━━━━━━━━━━━━
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 flex items-center justify-center gap-2">
            <Gift className="w-7 h-7 text-amber-400 inline-block" />
            <span>LIVE REDEEM EVENT</span>
          </h1>
          <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
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

            {/* Code Display Box */}
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
        ) : eventExpired || (eventData && eventData.claimedCount >= eventData.maxUses) ? (
          /* Case 2: Event Expired or Stock Out */
          <div className="w-full bg-slate-900/90 border border-rose-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>

            <h2 className="text-lg font-bold text-rose-300">
              {eventData && eventData.claimedCount >= eventData.maxUses
                ? '❌ All redeem codes have already been claimed.'
                : '⌛ This redeem event has ended.'}
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed">
              Stay tuned in our official channel for the next Live Redeem Event notification!
            </p>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
            >
              🤖 Return to Bot
            </a>
          </div>
        ) : !eventData ? (
          /* Case 3: No Active Event */
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Clock className="w-7 h-7 text-slate-400" />
            </div>

            <h2 className="text-base font-bold text-slate-300">⌛ This redeem event has ended.</h2>
            <p className="text-xs text-slate-400">
              No live redeem event is running right now. Open our Telegram Channel to get notified when the next event starts!
            </p>
          </div>
        ) : (
          /* Case 4: Active Event with Live Countdown or Ready to Claim */
          <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 backdrop-blur-md space-y-6">
            {!isUnlocked ? (
              /* Countdown Stage */
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Code Unlocks In</span>
                </span>

                {/* Big Animated Countdown Number */}
                <div className="relative py-4">
                  <div className="text-6xl sm:text-7xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 drop-shadow-lg transition-all duration-300 transform scale-105 animate-pulse">
                    {remainingSeconds}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest block mt-2">
                    seconds remaining
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Available Stock:</span>
                    <span className="text-amber-400 font-bold">
                      {eventData.maxUses - eventData.claimedCount} / {eventData.maxUses}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-sky-400 font-bold">🔒 Locked (Countdown Active)</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Keep this screen open. The claim button will unlock automatically when the countdown reaches 0.
                </p>
              </div>
            ) : (
              /* Ready Stage: Countdown Reached 0 */
              <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-emerald-400 flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-400 animate-bounce" />
                    <span>🎁 Code is Ready!</span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Tap the claim button below instantly to get your code.
                  </p>
                </div>

                {/* Optional Telegram Handle Input for guest users */}
                {!userHandle && (
                  <div className="text-left space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      Telegram Username / ID:
                    </label>
                    <input
                      type="text"
                      value={userHandle}
                      onChange={(e) => setUserHandle(e.target.value)}
                      placeholder="e.g. @username or Telegram ID"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Claim Button */}
                <button
                  type="button"
                  onClick={handleClaimCode}
                  disabled={isClaiming}
                  className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/25 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Verifying Availability...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping inline-block" />
                      <span>🟢 Claim Code</span>
                    </>
                  )}
                </button>

                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Stock Left: {eventData.maxUses - eventData.claimedCount}</span>
                  <span>Server Verified</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim Status Alert Message */}
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

      {/* Footer / Trust Badge */}
      <div className="w-full max-w-md text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2 z-10 pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        <span>Server-Verified Countdown & Instant Redeem System</span>
      </div>
    </div>
  );
};
