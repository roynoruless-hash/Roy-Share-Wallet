import React, { useState, useEffect } from 'react';
import { Bot, Key, Shield, Smartphone, Loader2, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { AdminConfig } from '../types';

interface AdminLoginViewProps {
  config: AdminConfig;
  onLoginSuccess: (sessionData?: { sessionToken: string; expiresAt: number }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  config,
  onLoginSuccess,
  showToast,
}) => {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Setup state fields
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [setupBotToken, setSetupBotToken] = useState('');
  const [setupChatId, setSetupChatId] = useState('');
  const [setupMobile, setSetupMobile] = useState('');
  const [setupOtp, setSetupOtp] = useState('');

  // Login state fields
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [loginMobile, setLoginMobile] = useState('');
  const [loginOtp, setLoginOtp] = useState('');

  // Lockout / Security states
  const [attemptsLeft, setAttemptsLeft] = useState<number>(5);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  // Check admin setup status on load
  const checkStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      setIsConfigured(data.isConfigured);
    } catch (err: any) {
      console.error('Error checking setup status:', err);
      setErrorMsg('Failed to connect to the backend server.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimeLeft]);

  // Formatter for locked time MM:SS
  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup Step 1 Action: Verify & Save Bot token + Chat ID
  const handleSetupStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!setupBotToken.trim() || !setupChatId.trim()) {
      setErrorMsg('Please enter both Telegram Bot Token and Chat ID.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: setupBotToken, adminChatId: setupChatId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Bot details and Chat ID verified successfully!', 'success');
        setSetupStep(2);
      } else {
        setErrorMsg(data.error || 'Verification failed.');
        showToast(data.error || 'Setup Step 1 failed', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Network error. Failed to connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Setup Step 2 Action: Verify & Save Mobile Number, trigger OTP
  const handleSetupStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanMobile = setupMobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/setup-mobile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminMobileNumber: cleanMobile }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🔐 OTP sent through Telegram Bot! Check your chat.', 'success');
        setSetupStep(3);
      } else {
        setErrorMsg(data.error || 'Failed to request verification OTP.');
        showToast(data.error || 'Setup Step 2 failed', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Network error. Failed to trigger OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Setup Step 3 Action: Verify Setup OTP
  const handleSetupStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!setupOtp.trim() || setupOtp.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: setupOtp.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Admin system setup complete and logged in!', 'success');
        // Store session token
        localStorage.setItem('royshare_admin_session', JSON.stringify({
          loggedIn: true,
          lastActive: Date.now(),
          sessionToken: data.sessionToken,
          expiresAt: data.expiresAt
        }));
        onLoginSuccess();
      } else {
        setErrorMsg(data.error || 'OTP verification failed.');
        showToast(data.error || 'Setup verification failed', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Network error during verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login Step 1 Action: Request Login OTP
  const handleLoginRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanMobile = loginMobile.replace(/\D/g, '');
    if (!cleanMobile) {
      setErrorMsg('Please enter your registered Admin Mobile Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile }),
      });
      const data = await res.json();
      if (res.status === 403) {
        // Locked out
        setErrorMsg(data.error);
        setLockoutTimeLeft(15 * 60); // Start 15 mins countdown
        showToast(data.error, 'error');
      } else if (data.success) {
        showToast('🔐 OTP has been sent via your Telegram Bot. Enter it below.', 'success');
        setLoginStep(2);
      } else {
        setErrorMsg(data.error || 'Request OTP failed.');
        showToast(data.error || 'Failed to send OTP', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Network error. Failed to trigger login OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login Step 2 Action: Verify OTP & Login
  const handleLoginVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!loginOtp.trim() || loginOtp.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: loginOtp.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Admin authentication successful!', 'success');
        // Store session token
        localStorage.setItem('royshare_admin_session', JSON.stringify({
          loggedIn: true,
          lastActive: Date.now(),
          sessionToken: data.sessionToken,
          expiresAt: data.expiresAt
        }));
        onLoginSuccess();
      } else {
        setErrorMsg(data.error || 'Invalid OTP code.');
        showToast(data.error || 'OTP verification failed', 'error');
        if (data.attemptsLeft !== undefined) {
          setAttemptsLeft(data.attemptsLeft);
          if (data.attemptsLeft <= 0) {
            setLockoutTimeLeft(15 * 60); // 15 mins
          }
        }
      }
    } catch (err: any) {
      setErrorMsg('Network error. Failed to verify OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Connecting to Admin Auth System...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-sky-500 selection:text-slate-950">
      <div className="w-full max-w-md space-y-6">
        
        {/* Branding header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-xl shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sky-400">
              <Bot className="w-9 h-9" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Roy Share <span className="text-sky-400">Admin</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isConfigured ? 'Telegram OTP Security Login' : 'Initial System Setup & Configuration'}
            </p>
          </div>
        </div>

        {/* Setup flow */}
        {!isConfigured ? (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 backdrop-blur-xl">
            
            {/* Steps bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${setupStep === 1 ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>1</span>
                <span className="text-xs font-bold text-slate-200">Bot Setup</span>
              </div>
              <div className="w-8 h-0.5 bg-slate-800" />
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${setupStep === 2 ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>2</span>
                <span className="text-xs font-bold text-slate-200">Mobile Verify</span>
              </div>
              <div className="w-8 h-0.5 bg-slate-800" />
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${setupStep === 3 ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>3</span>
                <span className="text-xs font-bold text-slate-200">OTP Code</span>
              </div>
            </div>

            {/* Step 1: Bot Token & Chat ID */}
            {setupStep === 1 && (
              <form onSubmit={handleSetupStep1} className="space-y-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
                  ⚠️ <b>First-time Setup Required:</b> Create a Telegram bot via <b>@BotFather</b> and start a chat to find your Chat ID. No default passwords are used.
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    <span>Telegram Bot Token</span>
                  </label>
                  <input
                    type="password"
                    value={setupBotToken}
                    onChange={(e) => setSetupBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span>Telegram Chat ID</span>
                  </label>
                  <input
                    type="text"
                    value={setupChatId}
                    onChange={(e) => setSetupChatId(e.target.value)}
                    placeholder="e.g. 123456789 or group ID"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errorMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Verifying bot details...' : 'Save & Verify'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 2: Mobile input */}
            {setupStep === 2 && (
              <form onSubmit={handleSetupStep2} className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Bot Token & Chat ID verified successfully! Proceed with mobile registration.</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                    <span>Admin Mobile Number</span>
                  </label>
                  <input
                    type="tel"
                    value={setupMobile}
                    onChange={(e) => setSetupMobile(e.target.value)}
                    placeholder="e.g. 9027671630"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errorMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Sending OTP code...' : 'Send OTP'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 3: Verify OTP */}
            {setupStep === 3 && (
              <form onSubmit={handleSetupStep3} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    <span>Enter 6-Digit OTP Code</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={setupOtp}
                    onChange={(e) => setSetupOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-lg font-black tracking-[0.4em] text-sky-400 placeholder-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                  <p className="text-[11px] text-slate-500 text-center">OTP is sent ONLY via the configured Telegram bot. Valid for 5 minutes.</p>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5 justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errorMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Verifying OTP...' : 'Verify & Setup Admin'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>
            )}

          </div>
        ) : (
          /* Normal OTP login flow */
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Admin Authentication</h2>
                <p className="text-[11px] text-slate-400">
                  OTP is sent directly via Telegram Bot to your registered chat.
                </p>
              </div>
            </div>

            {lockoutTimeLeft > 0 ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-xs font-bold text-rose-300">Login Temporarily Locked</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Maximum wrong OTP attempts reached. Please wait for the lockout period to end.
                </p>
                <p className="text-2xl font-mono font-black text-rose-400 tracking-wider">
                  {formatLockoutTime(lockoutTimeLeft)}
                </p>
              </div>
            ) : (
              <>
                {loginStep === 1 ? (
                  <form onSubmit={handleLoginRequestOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                        <span>Admin Mobile Number</span>
                      </label>
                      <input
                        type="tel"
                        value={loginMobile}
                        onChange={(e) => setLoginMobile(e.target.value)}
                        placeholder="e.g. 9027671630"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errorMsg}</span>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                    >
                      <span>{isSubmitting ? 'Requesting OTP...' : 'Send OTP'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLoginVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-sky-400" />
                          <span>Enter 6-Digit OTP</span>
                        </span>
                        {attemptsLeft < 5 && (
                          <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">
                            Attempts left: {attemptsLeft}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={loginOtp}
                        onChange={(e) => setLoginOtp(e.target.value)}
                        placeholder="123456"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-lg font-black tracking-[0.4em] text-sky-400 placeholder-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errorMsg}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginStep(1);
                          setLoginOtp('');
                          setErrorMsg('');
                        }}
                        className="w-1/3 py-3 px-4 rounded-xl border border-slate-800 text-xs font-bold hover:bg-slate-800 text-slate-300 transition"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                      >
                        <span>{isSubmitting ? 'Verifying OTP...' : 'Verify Code'}</span>
                        <LogIn className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[10px] text-slate-400 space-y-1">
              <p className="font-semibold text-sky-400">🛡️ Multi-factor OTP Security Policy</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>No hardcoded defaults or PIN codes.</li>
                <li>OTP expires strictly after 5 minutes.</li>
                <li>Max 5 failed attempts allowed before 15-minute lock.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[11px] text-center text-slate-600">
          Roy Share Wallet Admin • Secure Telegram Engine
        </p>
      </div>
    </div>
  );
};
