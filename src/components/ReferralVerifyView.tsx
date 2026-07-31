import React, { useState, useEffect } from 'react';
import { generateDeviceFingerprint, DeviceFingerprintData } from '../utils/fingerprint';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Globe,
  Cpu,
  ArrowRight,
  Send,
  AlertTriangle,
} from 'lucide-react';

interface ReferralVerifyViewProps {
  tokenParam?: string;
  botUsername?: string;
}

interface StepItem {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export const ReferralVerifyView: React.FC<ReferralVerifyViewProps> = ({
  tokenParam,
  botUsername = 'RoyShareWalletBot',
}) => {
  const [token, setToken] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [verifying, setVerifying] = useState<boolean>(true);
  const [status, setStatus] = useState<'loading' | 'success' | 'rejected' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  const [fingerprintData, setFingerprintData] = useState<DeviceFingerprintData | null>(null);

  const [steps, setSteps] = useState<StepItem[]>([
    { id: '1', label: 'Read Referral Token', status: 'pending' },
    { id: '2', label: 'Validate Telegram User', status: 'pending' },
    { id: '3', label: 'Detect Device Fingerprint', status: 'pending' },
    { id: '4', label: 'Read IP Address', status: 'pending' },
    { id: '5', label: 'Check Browser Fingerprint', status: 'pending' },
    { id: '6', label: 'Check Existing Referral History', status: 'pending' },
    { id: '7', label: 'Verify Eligibility', status: 'pending' },
  ]);

  useEffect(() => {
    // Extract token from prop or search params
    const searchParams = new URLSearchParams(window.location.search);
    const extractedToken = tokenParam || searchParams.get('token') || '';
    setToken(extractedToken);

    if (extractedToken) {
      runVerificationFlow(extractedToken);
    } else {
      setVerifying(false);
      setStatus('error');
      setErrorMessage('No referral verification token provided in URL.');
    }
  }, [tokenParam]);

  const updateStepStatus = (stepId: string, stepStatus: 'pending' | 'active' | 'completed' | 'failed') => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status: stepStatus } : step))
    );
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runVerificationFlow = async (tok: string) => {
    try {
      setVerifying(true);
      setStatus('loading');
      setProgress(5);

      // Step 1: Read Referral Token
      updateStepStatus('1', 'active');
      setProgress(15);
      await delay(350);

      const tokenRes = await fetch(`/api/referral/token-info?token=${encodeURIComponent(tok)}`);
      const tokenJson = await tokenRes.json();

      if (!tokenRes.ok || !tokenJson.success) {
        updateStepStatus('1', 'failed');
        setVerifying(false);
        setStatus('error');
        setErrorMessage(tokenJson.error || 'Invalid or expired referral verification token.');
        return;
      }

      setTokenDetails(tokenJson.tokenData);
      updateStepStatus('1', 'completed');
      setProgress(30);

      // Check if already verified or rejected
      if (tokenJson.tokenData.status === 'verified') {
        updateStepStatus('2', 'completed');
        updateStepStatus('3', 'completed');
        updateStepStatus('4', 'completed');
        updateStepStatus('5', 'completed');
        updateStepStatus('6', 'completed');
        updateStepStatus('7', 'completed');
        setProgress(100);
        setVerifying(false);
        setStatus('success');
        return;
      }

      if (tokenJson.tokenData.status === 'rejected') {
        updateStepStatus('2', 'completed');
        updateStepStatus('3', 'completed');
        updateStepStatus('4', 'completed');
        updateStepStatus('5', 'completed');
        updateStepStatus('6', 'failed');
        updateStepStatus('7', 'failed');
        setProgress(100);
        setVerifying(false);
        setStatus('rejected');
        setRejectReason(tokenJson.tokenData.rejectReason || 'Self referrals or multiple Telegram accounts on the same device are not allowed.');
        return;
      }

      // Step 2: Validate Telegram User
      updateStepStatus('2', 'active');
      setProgress(45);
      await delay(400);
      updateStepStatus('2', 'completed');

      // Step 3 & 4 & 5: Generate Device Fingerprint
      updateStepStatus('3', 'active');
      setProgress(60);
      await delay(300);

      const fpData = await generateDeviceFingerprint();
      setFingerprintData(fpData);
      updateStepStatus('3', 'completed');

      updateStepStatus('4', 'active');
      setProgress(72);
      await delay(250);
      updateStepStatus('4', 'completed');

      updateStepStatus('5', 'active');
      setProgress(82);
      await delay(250);
      updateStepStatus('5', 'completed');

      // Step 6 & 7: Send to Server for Anti-Fraud Verification
      updateStepStatus('6', 'active');
      setProgress(90);

      const verifyRes = await fetch('/api/referral/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tok,
          deviceFingerprint: fpData.hash,
          browserSignals: fpData.components,
        }),
      });

      const verifyJson = await verifyRes.json();
      updateStepStatus('6', verifyJson.success ? 'completed' : 'failed');

      updateStepStatus('7', 'active');
      setProgress(100);
      await delay(300);

      setVerifying(false);

      if (verifyJson.success) {
        updateStepStatus('7', 'completed');
        setStatus('success');
      } else {
        updateStepStatus('7', 'failed');
        setStatus('rejected');
        setRejectReason(
          verifyJson.message ||
            'Self referrals or multiple Telegram accounts on the same device are not allowed.'
        );
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setVerifying(false);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected network error occurred during verification.');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-indigo-400 tracking-wide uppercase shadow-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Roy Share Anti-Fraud System
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Referral Verification
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Device fingerprinting active to prevent self-referrals and account duplication.
          </p>
        </div>

        {/* LOADING STATE WITH CIRCULAR PROGRESS INDICATOR */}
        {status === 'loading' && (
          <div className="space-y-6 animate-fade-in">
            {/* Circular Progress Container */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
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
                {/* Animated Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="text-indigo-500 transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * progress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              {/* Inner Percentage & Spinner */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-white tracking-tight">
                  {progress}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                  Verifying
                </span>
              </div>
            </div>

            {/* Checklist Steps */}
            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2.5">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between text-xs transition-colors duration-200"
                >
                  <div className="flex items-center gap-2.5">
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {step.status === 'failed' && (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    {step.status === 'active' && (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                    )}
                    {step.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-900 shrink-0" />
                    )}
                    <span
                      className={`${
                        step.status === 'completed'
                          ? 'text-slate-200 font-medium'
                          : step.status === 'active'
                          ? 'text-indigo-300 font-semibold'
                          : step.status === 'failed'
                          ? 'text-rose-300 font-medium'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {step.status === 'completed' && (
                    <span className="text-[10px] font-mono text-emerald-400/90 font-bold uppercase tracking-wider">
                      ✓ OK
                    </span>
                  )}
                  {step.status === 'active' && (
                    <span className="text-[10px] font-mono text-indigo-400 font-bold animate-pulse">
                      Checking...
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center text-[11px] text-slate-500">
              Please wait while we validate your eligibility...
            </div>
          </div>
        )}

        {/* REJECTED / REJECTION POPUP CARD (REQUIREMENT 8) */}
        {status === 'rejected' && (
          <div className="space-y-6 animate-scale-up">
            <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-rose-200 flex items-center justify-center gap-2">
                  <span>❌</span> Same Device Detected
                </h2>
                <p className="text-xs text-rose-300/90 leading-relaxed font-normal">
                  {rejectReason ||
                    'Self referrals or multiple Telegram accounts on the same device are not allowed.'}
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-left text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-rose-400 font-bold">REJECTED</span>
                </div>
                {fingerprintData && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Device Hash:</span>
                    <span className="text-slate-300 font-semibold truncate max-w-[160px]">
                      {fingerprintData.hash.substring(0, 16)}...
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Reward Status:</span>
                  <span className="text-slate-300 font-semibold">Not Granted</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-slate-700 shadow-md"
            >
              <Send className="w-4 h-4 text-indigo-400" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* SUCCESS CARD (REQUIREMENT 9) */}
        {status === 'success' && (
          <div className="space-y-6 animate-scale-up">
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-emerald-200 flex items-center justify-center gap-2">
                  ✅ Referral Verified!
                </h2>
                <p className="text-xs text-emerald-300/90 leading-relaxed font-normal">
                  Device check completed successfully. The referral reward has been credited to your referrer.
                </p>
              </div>

              {tokenDetails && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-left text-[11px] text-slate-400 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Referred User:</span>
                    <span className="text-slate-200 font-semibold">{tokenDetails.referredName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">UID:</span>
                    <span className="text-indigo-400 font-semibold">#{tokenDetails.referredUid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification:</span>
                    <span className="text-emerald-400 font-bold">PASSED ✓</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <Send className="w-4 h-4" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-lg font-bold text-amber-200">Verification Link Issue</h2>
              <p className="text-xs text-amber-300/80 leading-relaxed">{errorMessage}</p>
            </div>

            <button
              onClick={handleBackToTelegram}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <Send className="w-4 h-4 text-indigo-400" />
              Back to Telegram
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-[10px] text-slate-500 border-t border-slate-800/60 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-slate-600" />
            <span>Secure In-App Browser</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-slate-600" />
            <span>Encrypted Fingerprint</span>
          </div>
        </div>
      </div>
    </div>
  );
};
