import React from 'react';
import { Share2, DollarSign, ShieldAlert, UserX, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { AdminConfig } from '../types';

interface ReferralSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const ReferralSettingsView: React.FC<ReferralSettingsViewProps> = ({
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
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Referral Engine Settings</h2>
            <p className="text-xs text-slate-400">
              Configure rewards per referral and anti-abuse fraud protections.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Master Referral Enable Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Referral Program Status</p>
              <p className="text-[11px] text-slate-400">Enable or pause viral referral links</p>
            </div>
            <button
              type="button"
              id="referral-enable-toggle"
              onClick={() => updateConfig({ referralEnable: !config.referralEnable })}
              className={`p-1.5 rounded-lg transition ${
                config.referralEnable ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.referralEnable ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Reward Per Referral */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Reward Per Referral (₹)</span>
              </span>
            </label>
            <input
              type="number"
              id="reward-per-referral-input"
              value={config.rewardPerReferral}
              onChange={(e) =>
                updateConfig({ rewardPerReferral: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>
        </div>

        {/* Anti-Fraud Protections Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Anti-Abuse & Fraud Protection</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Self Referral Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Self Referral Protection</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Block users from using their own referral link
                </p>
              </div>
              <button
                type="button"
                id="self-referral-toggle"
                onClick={() =>
                  updateConfig({ selfReferralProtection: !config.selfReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.selfReferralProtection ? 'text-sky-400' : 'text-slate-600'
                }`}
              >
                {config.selfReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>

            {/* Duplicate Referral Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Duplicate Referral Protection</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Prevent multiple rewards from same IP/device fingerprint
                </p>
              </div>
              <button
                type="button"
                id="duplicate-referral-toggle"
                onClick={() =>
                  updateConfig({ duplicateReferralProtection: !config.duplicateReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.duplicateReferralProtection ? 'text-sky-400' : 'text-slate-600'
                }`}
              >
                {config.duplicateReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="referral-save-btn"
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
