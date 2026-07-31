import React, { useState, useEffect } from 'react';
import { generateDeviceFingerprint, DeviceFingerprintData, getLocalStorageId } from '../utils/fingerprint';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Globe,
  Cpu,
  Send,
  AlertTriangle,
  Lock,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface ReferralVerifyViewProps {
  tokenParam?: string;
  botUsername?: string;
}

export const ReferralVerifyView: React.FC<ReferralVerifyViewProps> = ({
  tokenParam,
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
  const [fingerprintData, setFingerprintData] = useState<DeviceFingerprintData | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'granted' | 'denied'>('denied');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    // Extract token from prop or search params
    const searchParams = new URLSearchParams(window.location.search);
    const extractedToken = tokenParam || searchParams.get('token') || '';
    setToken(extractedToken);

    if (extractedToken) {
      runInitialLoadingFlow(extractedToken);
    } else {
      setStatus('error');
      setErrorMessage('No referral verification token provided in URL.');
    }
  }, [tokenParam]);

  // Step 1: Initial Loading with Circular Progress Ring (0% -> 100%)
  const runInitialLoadingFlow = async (tok: string) => {
    try {
      setStatus('loading');
      setProgress(0);
      setLoadingText('Checking Device...');

      // Fetch token info from backend to validate existence & age
      const tokenResPromise = fetch(`/api/referral/token-info?token=${encodeURIComponent(tok)}`).then(r => r.json());

      // Smooth progress increments with text updates
      await delay(200);
      setProgress(20);
      setLoadingText('Checking Security...');

      await delay(250);
      setProgress(40);
      setLoadingText('Checking Referral...');

      await delay(250);
      setProgress(60);
      setLoadingText('Preparing Verification...');

      const tokenJson = await tokenResPromise;

      await delay(250);
      setProgress(80);

      if (!tokenJson.success) {
        setStatus('error');
        setErrorMessage(tokenJson.error || 'Invalid or expired referral verification token.');
        return;
      }

      setTokenDetails(tokenJson.tokenData);

      if (tokenJson.tokenData.isExpired) {
        setStatus('error');
        setErrorMessage('Referral verification link has expired (10 minute limit). Please request a new link.');
        return;
      }

      if (tokenJson.tokenData.status === 'verified') {
        setProgress(100);
        setStatus('success');
        return;
      }

      if (tokenJson.tokenData.status === 'rejected') {
        setProgress(100);
        setStatus('rejected');
        setRejectReason(
          tokenJson.tokenData.rejectReason ||
            'Self referrals or multiple Telegram accounts on the same device are not allowed.'
        );
        return;
      }

      await delay(200);
      setProgress(100);
      await delay(150);

      // Transition to PERMISSION SCREEN
      setStatus('permission');
    } catch (err: any) {
      console.error('Error during initial verification loading:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Network error checking referral verification token.');
    }
  };

  // Step 2: Request Geolocation Permission
  const handleAllowPermission = () => {
    if (!navigator.geolocation) {
      // Fallback if browser doesn't support geolocation
      setLocationPermissionStatus('denied');
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
        setLocationPermissionStatus('granted');
        setLocationCoords(coords);
        // Proceed immediately to Device Check & Server Verification
        executeDeviceVerification(coords);
      },
      (error) => {
        console.warn('Geolocation permission denied or error:', error);
        setLocationPermissionStatus('denied');
        setStatus('permission_failed');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Step 3 & 4: Collect Device Fingerprint & Submit Anti-Fraud Request
  const executeDeviceVerification = async (coords: { latitude: number; longitude: number; accuracy: number }) => {
    try {
      setStatus('verifying');

      const fpData = await generateDeviceFingerprint();
      setFingerprintData(fpData);
      const localStorageId = getLocalStorageId();

      const response = await fetch('/api/referral/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceFingerprint: fpData.hash,
          localStorageId,
          locationPermissionStatus: 'granted',
          locationCoords: coords,
          rawSignals: fpData.components,
        }),
      });

      const json = await response.json();

      if (json.success) {
        setStatus('success');
      } else {
        setStatus('rejected');
        setRejectReason(
          json.message ||
            'Self referrals or multiple Telegram accounts on the same device are not allowed.'
        );
      }
    } catch (err: any) {
      console.error('Error executing device verification:', err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred during device verification.');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Background Neon Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-6 sm:p-8 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-xs font-semibold text-cyan-400 tracking-wide uppercase shadow-sm">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Roy Share Anti-Fraud Engine
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
            Referral Verification
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Device fingerprinting active to prevent self-referrals and account duplication.
          </p>
        </div>

        {/* 1. LOADING STATE WITH CIRCULAR PROGRESS INDICATOR */}
        {status === 'loading' && (
          <div className="space-y-6 animate-fade-in py-2">
            {/* Circular Progress Container */}
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                {/* Animated Cyan Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="text-cyan-400 transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * progress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>

              {/* Center Percentage & Status Label */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-white tracking-tight font-mono">
                  {progress}%
                </span>
                <span className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase mt-1">
                  Checking
                </span>
              </div>
            </div>

            {/* Dynamic Loading Text */}
            <div className="text-center space-y-1">
              <div className="text-sm font-bold text-cyan-300 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{loadingText}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Evaluating device signals & security tokens...
              </p>
            </div>
          </div>
        )}

        {/* 2. PERMISSION REQUEST SCREEN */}
        {status === 'permission' && (
          <div className="space-y-6 animate-scale-up py-2">
            <div className="p-6 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-cyan-100 flex items-center justify-center gap-2">
                  🔒 Device Verification Required
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  For security we need permission to verify your device.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-left text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-medium">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Browser Location Access</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Verification checks your browser location signal to confirm device authenticity and prevent duplicate referral links.
                </p>
              </div>
            </div>

            <button
              onClick={handleAllowPermission}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.99] text-white text-sm font-bold transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 border border-cyan-400/30"
            >
              <ShieldCheck className="w-4 h-4" />
              Allow Verification
            </button>
          </div>
        )}

        {/* 3. PERMISSION DENIED SCREEN */}
        {status === 'permission_failed' && (
          <div className="space-y-6 animate-scale-up py-2">
            <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <XCircle className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-rose-200">
                  ❌ Verification Failed
                </h2>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  Location permission is required to verify your referral.
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-left text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-rose-400 font-bold">PERMISSION_DENIED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reward Status:</span>
                  <span className="text-slate-400 font-semibold">Not Approved</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleAllowPermission}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {/* 4. DEVICE VERIFYING SCREEN */}
        {status === 'verifying' && (
          <div className="space-y-6 animate-fade-in py-8 text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Analyzing Device Signals...</h2>
              <p className="text-xs text-slate-400">Verifying browser fingerprint and anti-fraud rules...</p>
            </div>
          </div>
        )}

        {/* 5. REJECTED / SELF REFERRAL DETECTED SCREEN */}
        {status === 'rejected' && (
          <div className="space-y-6 animate-scale-up py-2">
            <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <ShieldAlert className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-rose-200 flex items-center justify-center gap-2">
                  🚫 Same Device Detected
                </h2>
                <p className="text-xs text-rose-300/90 leading-relaxed font-semibold">
                  Self referrals are not allowed.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Your wallet can still be used normally, but referral reward has been rejected.
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-left text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-rose-400 font-bold">REJECTED</span>
                </div>
                {rejectReason && (
                  <div className="text-[10px] text-rose-300 pt-1 border-t border-slate-800/60 leading-tight">
                    {rejectReason}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-slate-700 shadow-md"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* 6. SUCCESS SCREEN */}
        {status === 'success' && (
          <div className="space-y-6 animate-scale-up py-2">
            <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-emerald-200 flex items-center justify-center gap-2">
                  ✅ Device Verified
                </h2>
                <p className="text-xs text-emerald-300 font-bold">
                  Referral Approved Successfully
                </p>
                <p className="text-xs text-slate-300">
                  Reward Added.
                </p>
              </div>

              {tokenDetails && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left text-[11px] text-slate-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Referred User:</span>
                    <span className="text-slate-200 font-semibold">{tokenDetails.referredName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">UID:</span>
                    <span className="text-cyan-400 font-semibold">#{tokenDetails.referredUid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification:</span>
                    <span className="text-emerald-400 font-bold">APPROVED ✓</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.99] text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <Send className="w-4 h-4" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* 7. ERROR / LINK EXPIRED SCREEN */}
        {status === 'error' && (
          <div className="space-y-6 py-2">
            <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-lg font-bold text-amber-200">Verification Link Issue</h2>
              <p className="text-xs text-amber-300/80 leading-relaxed">{errorMessage}</p>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-[10px] text-slate-500 border-t border-slate-800/80 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-cyan-500/70" />
            <span>Telegram In-App Browser</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-cyan-500/70" />
            <span>Secure Fingerprint V2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
