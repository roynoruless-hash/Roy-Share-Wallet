import React from 'react';
import { Menu, Save, ShieldCheck, Bot, CheckCircle2, AlertCircle, RefreshCw, Layers, LogOut } from 'lucide-react';
import { AdminConfig } from '../types';

interface HeaderProps {
  config: AdminConfig;
  onSave: () => void;
  onLogout?: () => void;
  isSaving: boolean;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  activeTabTitle: string;
  hasUnsavedChanges: boolean;
  sessionTimeLeft?: number;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onSave,
  onLogout,
  isSaving,
  isMobileOpen,
  setIsMobileOpen,
  activeTabTitle,
  hasUnsavedChanges,
  sessionTimeLeft = 10800,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left Section: Mobile Menu & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Roy Share Telegram Wallet Bot
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Step 1: Admin System
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-slate-500">System</span>
                <span>/</span>
                <span className="text-sky-400 font-medium">{activeTabTitle}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Status Indicators & Save Configuration CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  config.botTokenValidated ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300 font-medium">
                {config.botTokenValidated ? 'Bot Linked' : 'Token Pending'}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Firestore Active</span>
            </div>
          </div>

          {/* Session Timer Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="text-slate-400">Session:</span>
            <span className="text-sky-400 font-mono font-bold tracking-wider">
              {(() => {
                const h = Math.floor(sessionTimeLeft / 3600);
                const m = Math.floor((sessionTimeLeft % 3600) / 60);
                const s = sessionTimeLeft % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              })()}
            </span>
          </div>

          {/* Unsaved Badge */}
          {hasUnsavedChanges && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Unsaved Changes
            </span>
          )}

          {/* Save Configuration Primary Action */}
          <button
            id="header-save-config-btn"
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg ${
              hasUnsavedChanges
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/25 ring-2 ring-sky-400/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span className="hidden xs:inline">Save Configuration</span>
                <span className="xs:hidden">Save</span>
              </>
            )}
          </button>

          {/* Logout Action Button */}
          {onLogout && (
            <button
              id="header-logout-btn"
              onClick={onLogout}
              title="Logout from Admin Session"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 border border-slate-700/80 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
