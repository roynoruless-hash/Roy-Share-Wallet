import React from 'react';
import { ShieldAlert, AlertTriangle, Clock, Users, ToggleLeft, ToggleRight, Save, Cpu, Layers } from 'lucide-react';
import { AdminConfig } from '../types';

interface SecurityViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
}) => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System & Security Settings</h2>
            <p className="text-xs text-slate-400">
              Maintenance mode, whitelisted admin IDs, session timeout, and future architecture readiness.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        {/* Maintenance Mode Alert Banner */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            config.maintenanceMode
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                config.maintenanceMode
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400 animate-pulse'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Maintenance Mode</p>
              <p className="text-[11px] text-slate-400">
                When enabled, Telegram bot suppresses wallet transactions and displays maintenance message.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="maintenance-mode-toggle"
            onClick={() => updateConfig({ maintenanceMode: !config.maintenanceMode })}
            className={`p-1.5 rounded-lg transition ${
              config.maintenanceMode ? 'text-rose-400' : 'text-slate-600'
            }`}
          >
            {config.maintenanceMode ? (
              <ToggleRight className="w-8 h-8" />
            ) : (
              <ToggleLeft className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* Security Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Allowed Admin IDs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Allowed Admin Telegram IDs</span>
            </label>
            <input
              type="text"
              id="allowed-admin-ids-input"
              value={config.allowedAdminIds}
              onChange={(e) => updateConfig({ allowedAdminIds: e.target.value })}
              placeholder="e.g. 123456789, 987654321"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
            <p className="text-[11px] text-slate-500">Comma separated Telegram user IDs with Admin access.</p>
          </div>

          {/* Session Timeout */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Session Timeout (Minutes)</span>
            </label>
            <input
              type="number"
              id="session-timeout-input"
              value={config.sessionTimeout}
              onChange={(e) =>
                updateConfig({ sessionTimeout: Math.max(1, parseInt(e.target.value) || 30) })
              }
              min={1}
              max={1440}
              placeholder="30"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
            <p className="text-[11px] text-slate-500">Inactivity period before requiring admin re-auth.</p>
          </div>
        </div>

        {/* Future Ready Architecture Section */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            <span>Future Ready Modular Architecture</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">Step 2: Registration</span>
              <p className="text-[11px] text-slate-500">
                User onboarding, Firestore user schema, profile creation & UID assignment.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">Step 3: Wallet & Bonus</span>
              <p className="text-[11px] text-slate-500">
                Ledger transactions, bonus claim engine, balance increments & logs.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">Step 4: Withdrawals</span>
              <p className="text-[11px] text-slate-500">
                UPI/QR request queue, tax deduction, admin approval dashboard & payout webhooks.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="security-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
