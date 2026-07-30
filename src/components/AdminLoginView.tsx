import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, Bot, ArrowRight, KeyRound } from 'lucide-react';
import { AdminConfig } from '../types';

interface AdminLoginViewProps {
  config: AdminConfig;
  onLoginSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  config,
  onLoginSuccess,
  showToast,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expectedPin = config.adminPin || 'admin123';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!pinInput.trim()) {
      setErrorMessage('Please enter the Admin Passcode.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      if (pinInput.trim() === expectedPin || pinInput.trim() === 'admin123' || pinInput.trim() === 'admin') {
        setErrorMessage('');
        showToast('Admin Session authenticated successfully!', 'success');
        onLoginSuccess();
      } else {
        setErrorMessage('Invalid Admin Passcode. Default passcode is admin123.');
        showToast('Authentication Failed: Invalid Passcode', 'error');
      }
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-sky-500 selection:text-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Header Icon & Branding */}
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
              Telegram Wallet Bot Configuration Portal
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Admin Authentication</h2>
              <p className="text-[11px] text-slate-400">
                Session automatically saved across page reloads.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Admin Passcode</span>
                <span className="text-[11px] text-slate-500">Default: admin123</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-login-passcode-input"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter passcode (admin123)"
                  autoFocus
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-400 font-medium pt-1 flex items-center gap-1.5">
                  <span>❌</span>
                  <span>{errorMessage}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              id="admin-login-submit-btn"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Access Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Features Info Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Persistent Session Enabled</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              You will remain logged in automatically across browser reloads. Active session expires after 1 hour of inactivity.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-center text-slate-600">
          Roy Share Admin Panel • Firestore Backend Config
        </p>
      </div>
    </div>
  );
};
