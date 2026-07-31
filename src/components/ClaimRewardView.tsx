import React, { useState, useEffect } from 'react';
import { generateDeviceFingerprint, DeviceFingerprintData, getLocalStorageId } from '../utils/fingerprint';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Gift,
  MapPin,
  RefreshCw,
  Award,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface ClaimRewardViewProps {
  botUsername?: string;
}

export const ClaimRewardView: React.FC<ClaimRewardViewProps> = ({
  botUsername = 'RoyShareWalletBot',
}) => {
  const [token, setToken] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>('Checking Device...');
  const [status, setStatus] = useState<
    'loading' | 'permission' | 'permission_failed' | 'verifying' | 'success' | 'rejected' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  const [claimResult, setClaimResult] = useState<any>(null);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const extractedToken = searchParams.get('token') || '';
    setToken(extractedToken);

    if (extractedToken) {
      runInitialLoadingFlow(extractedToken);
    } else {
      setStatus('error');
      setErrorMessage('No reward claim token provided in URL.');
    }
  }, []);

  // Step 1: Loading verification animation
  const runInitialLoadingFlow = async (tok: string) => {
    try {
      setStatus('loading');
      setProgress(0);
      setLoadingText('Checking Security...');

      // Pre-fetch token details to validate it exists and hasn't been used
      const tokenResPromise = fetch(`/api/milestones/claim-token-info?token=${encodeURIComponent(tok)}`).then((r) => r.json());

      await delay(200);
      setProgress(25);
      setLoadingText('Checking Device...');

      await delay(250);
      setProgress(50);
      setLoadingText('Checking Referral...');

      await delay(250);
      setProgress(75);
      setLoadingText('Checking Reward...');

      const tokenJson = await tokenResPromise;

      await delay(200);
      setProgress(100);
      await delay(150);

      if (!tokenJson.success) {
        setStatus('error');
        setErrorMessage(tokenJson.error || 'Invalid or expired reward claim token.');
        return;
      }

      setTokenDetails(tokenJson.tokenData);

      if (tokenJson.tokenData.used) {
        setStatus('error');
        setErrorMessage('This reward claim link has already been used. Link is single-use only.');
        return;
      }

      if (tokenJson.tokenData.isExpired) {
        setStatus('error');
        setErrorMessage('This reward claim link has expired (10 minute limit). Please request a new milestone from the bot.');
        return;
      }

      // Transition to Permission request
      setStatus('permission');
    } catch (err: any) {
      console.error('Error during initial claim loading:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Network error checking reward claim token.');
    }
  };

  // Step 2: Request Geolocation
  const handleAllowPermission = () => {
    if (!navigator.geolocation) {
      setStatus('permission_failed');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        // Geolocation allowed -> submit claim
        executeClaimSubmission(coords);
      },
      (error) => {
        console.warn('Geolocation denied:', error);
        setStatus('permission_failed');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Step 3: Fingerprinting and Submission
  const executeClaimSubmission = async (coords: { latitude: number; longitude: number; accuracy: number }) => {
    try {
      setStatus('verifying');

      // Generate fingerprint
      const fpData = await generateDeviceFingerprint();
      const localStorageId = getLocalStorageId();

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || 'Unknown';

      const response = await fetch('/api/milestones/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceFingerprint: fpData.hash,
          localStorageId,
          locationPermissionStatus: 'granted',
          locationCoords: coords,
          timezone,
          platform,
        }),
      });

      const json = await response.json();

      if (json.success) {
        setClaimResult(json);
        setStatus('success');
      } else {
        setStatus('rejected');
        setRejectReason(json.reason || 'Same Device Detected');
      }
    } catch (err: any) {
      console.error('Error executing milestone claim:', err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred while claiming reward.');
    }
  };

  const handleBackToTelegram = () => {
    const tgUrl = `https://t.me/${botUsername.replace(/^@/, '')}`;
    const tg = (window as any).Telegram;
    if (tg?.WebApp?.close) {
      try {
        tg.WebApp.close();
      } catch (e) {
        window.location.href = tgUrl;
      }
    } else {
      window.location.href = tgUrl;
    }
  };

  const circumference = 2 * Math.PI * 38;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* Premium Neon Glow Backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(59,130,246,0.15)] relative z-10 space-y-6">
        
        {/* Top Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-xs font-semibold text-blue-400 tracking-wide uppercase shadow-sm">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Device Verification Portal
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white bg-gradient-to-r from-white via-slate-100 to-blue-300 bg-clip-text text-transparent">
            Claim Milestone Reward
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Secure verification engine. Each milestone claim requires hardware and geolocation audits to prevent fraud.
          </p>
        </div>

        {/* 1. LOADING PROGRESS */}
        {status === 'loading' && (
          <div className="space-y-6 py-2">
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-slate-800"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-blue-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
                <span className="text-3xl font-black text-white tracking-tight">{progress}%</span>
                <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">STAGES</span>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-blue-400 flex items-center justify-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingText}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Running hardware profiles, local persistence verification and reward status...
              </p>
            </div>
          </div>
        )}

        {/* 2. REQUEST GEOLOCATION SCREEN */}
        {status === 'permission' && tokenDetails && (
          <div className="space-y-6 py-2 animate-fade-in text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-inner">
              <Gift className="w-8 h-8 text-blue-400" />
            </div>

            <div className="space-y-3 bg-slate-950/50 rounded-2xl p-4 border border-slate-800">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Unclaimed Reward</p>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-blue-400">₹{tokenDetails.rewardAmount}</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Milestone Reached: <span className="text-white font-bold">{tokenDetails.requiredReferrals} Referrals</span>
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-500/30 text-[10px] font-bold uppercase text-blue-400">
                  {tokenDetails.rewardType}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                To confirm this claim is legitimate and belongs to a single physical device, we require location verification.
              </p>
              <button
                onClick={handleAllowPermission}
                id="btn-allow-verification"
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-[0_4px_20px_rgba(59,130,246,0.3)] transition duration-200 uppercase flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Allow Verification
              </button>
            </div>
          </div>
        )}

        {/* 3. PERMISSION FAIL SCREEN */}
        {status === 'permission_failed' && (
          <div className="space-y-6 py-2 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">❌ Claim Rejected</h3>
              <p className="text-xs text-rose-400 font-semibold bg-rose-950/40 border border-rose-950 py-2 rounded-xl">
                Location Permission Denied
              </p>
              <p className="text-xs text-slate-400 leading-relaxed px-2">
                This verification requires active browser location access. If denied, claims cannot be completed to prevent multi-device spoofing.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAllowPermission}
                className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Permission
              </button>
              <button
                onClick={handleBackToTelegram}
                className="w-full py-3 px-6 rounded-2xl border border-slate-800 text-slate-400 font-bold text-xs uppercase hover:bg-slate-900 transition"
              >
                Close Verification
              </button>
            </div>
          </div>
        )}

        {/* 4. SUBMITTING SECURITY CHECK */}
        {status === 'verifying' && (
          <div className="space-y-6 py-6 text-center">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-md font-semibold text-white animate-pulse">Running Device Audit...</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Validating WebGL profiles, browser hash signatures, local storage state, and timezone details.
              </p>
            </div>
          </div>
        )}

        {/* 5. SUCCESS SCREEN */}
        {status === 'success' && claimResult && (
          <div className="space-y-6 py-2 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-scale-in">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">🎉 Claim Successful!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verification checks succeeded. Your device is verified as clean and unique.
              </p>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-5 border border-emerald-500/30 space-y-3 text-left">
              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Credited Reward</span>
                <span className="text-emerald-400 font-black text-sm">₹{claimResult.rewardAmount || tokenDetails?.rewardAmount}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Reward Type</span>
                <span className="text-slate-200 font-bold uppercase">{claimResult.rewardType || tokenDetails?.rewardType}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Status</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Wallet Credited
                </span>
              </div>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition"
            >
              Return to Telegram Bot
            </button>
          </div>
        )}

        {/* 6. FRAUD DETECTED REJECTION SCREEN */}
        {status === 'rejected' && (
          <div className="space-y-6 py-2 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center mx-auto text-rose-500">
              <XCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-rose-500">❌ Reward Rejected</h3>
              
              <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-4 text-center my-3 space-y-1">
                <p className="text-[10px] font-bold text-rose-400 tracking-wider uppercase">Reason</p>
                <p className="text-sm font-black text-white leading-tight">
                  {rejectReason === 'Self Referral is not allowed.' 
                    ? 'Self Referral is not allowed.' 
                    : 'Same Device Detected'}
                </p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed px-2">
                Your wallet remains active and usable. However, this specific milestone claim was denied to protect ecosystem security rules.
              </p>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm uppercase transition"
            >
              Back to Bot
            </button>
          </div>
        )}

        {/* 7. GENERAL ERROR SCREEN */}
        {status === 'error' && (
          <div className="space-y-6 py-2 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-slate-850 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Link Verification Error</h3>
              <p className="text-xs text-slate-400 leading-relaxed px-2">
                {errorMessage || 'This verification link is invalid, expired, or has already been used.'}
              </p>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3 px-6 rounded-2xl border border-slate-800 text-slate-400 font-bold text-xs uppercase hover:bg-slate-900 transition"
            >
              Return to Bot
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
