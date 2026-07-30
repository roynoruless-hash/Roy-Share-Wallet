import React from 'react';
import { Wallet, DollarSign, Percent, Hash, ArrowDownRight, ArrowUpRight, Save, RotateCcw } from 'lucide-react';
import { AdminConfig } from '../types';

interface WalletSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WalletSettingsView: React.FC<WalletSettingsViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
  showToast,
}) => {
  const handleResetDefaults = () => {
    updateConfig({
      registrationBonus: 0,
      referralBonus: 0,
      minWithdrawal: 100,
      maxWithdrawal: 300,
      withdrawalTax: 5,
      uidLength: 6,
    });
    showToast('Reset Wallet settings to defaults!', 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Wallet & Bonus Settings</h2>
              <p className="text-xs text-slate-400">
                Configure default bonuses, withdrawal limits, tax rate, and UID formatting.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Form Grid */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Registration Bonus */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Registration Bonus (₹)</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 0</span>
            </label>
            <input
              type="number"
              id="registration-bonus-input"
              value={config.registrationBonus}
              onChange={(e) =>
                updateConfig({ registrationBonus: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* Referral Bonus */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-sky-400" />
                <span>Referral Bonus (₹)</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 0</span>
            </label>
            <input
              type="number"
              id="referral-bonus-input"
              value={config.referralBonus}
              onChange={(e) =>
                updateConfig({ referralBonus: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* Minimum Withdrawal */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-amber-400" />
                <span>Minimum Withdrawal (₹)</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 100</span>
            </label>
            <input
              type="number"
              id="min-withdrawal-input"
              value={config.minWithdrawal}
              onChange={(e) =>
                updateConfig({ minWithdrawal: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="100"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* Maximum Withdrawal */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-purple-400" />
                <span>Maximum Withdrawal (₹)</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 300</span>
            </label>
            <input
              type="number"
              id="max-withdrawal-input"
              value={config.maxWithdrawal}
              onChange={(e) =>
                updateConfig({ maxWithdrawal: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="300"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* Withdrawal Tax (%) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-rose-400" />
                <span>Withdrawal Tax (%)</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 5%</span>
            </label>
            <input
              type="number"
              id="withdrawal-tax-input"
              value={config.withdrawalTax}
              onChange={(e) =>
                updateConfig({
                  withdrawalTax: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                })
              }
              min={0}
              max={100}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* UID Length */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <span>UID Length</span>
              </span>
              <span className="text-[11px] text-slate-500">Default: 6</span>
            </label>
            <input
              type="number"
              id="uid-length-input"
              value={config.uidLength}
              onChange={(e) =>
                updateConfig({
                  uidLength: Math.min(12, Math.max(4, parseInt(e.target.value) || 6)),
                })
              }
              min={4}
              max={12}
              placeholder="6"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="wallet-save-btn"
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
