import React from 'react';
import { ArrowDownRight, QrCode, CreditCard, Gift, Clock, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { AdminConfig } from '../types';

interface WithdrawalSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const WithdrawalSettingsView: React.FC<WithdrawalSettingsViewProps> = ({
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
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Withdrawal System Methods</h2>
            <p className="text-xs text-slate-400">
              Enable or disable withdrawal gateways, payout options, and notice banners.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Box */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        {/* Toggles List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Master Enable Withdraw Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Global Withdrawal Processing</p>
                <p className="text-[11px] text-slate-400">Allow users to place withdrawal requests</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-withdraw-toggle"
              onClick={() => updateConfig({ enableWithdraw: !config.enableWithdraw })}
              className={`p-1.5 rounded-lg transition ${
                config.enableWithdraw ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableWithdraw ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Enable UPI Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Enable UPI Payouts</p>
                <p className="text-[11px] text-slate-400">Allow GPay, PhonePe, Paytm VPA addresses</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-upi-toggle"
              onClick={() => updateConfig({ enableUpi: !config.enableUpi })}
              className={`p-1.5 rounded-lg transition ${
                config.enableUpi ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableUpi ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Enable QR Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Enable QR Upload Payouts</p>
                <p className="text-[11px] text-slate-400">Users can attach payment QR images</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-qr-toggle"
              onClick={() => updateConfig({ enableQr: !config.enableQr })}
              className={`p-1.5 rounded-lg transition ${
                config.enableQr ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableQr ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Enable Redeem Code Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Enable Redeem Codes</p>
                <p className="text-[11px] text-slate-400">Convert balance into store voucher codes</p>
              </div>
            </div>
            <button
              type="button"
              id="enable-redeem-code-toggle"
              onClick={() => updateConfig({ enableRedeemCode: !config.enableRedeemCode })}
              className={`p-1.5 rounded-lg transition ${
                config.enableRedeemCode ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.enableRedeemCode ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>

        {/* Processing Time Notice */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Processing Time Notice</span>
          </label>
          <textarea
            id="processing-time-notice-input"
            value={config.processingTimeNotice}
            onChange={(e) => updateConfig({ processingTimeNotice: e.target.value })}
            rows={3}
            placeholder="e.g. Withdrawals are processed within 24 hours."
            className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition resize-none"
          />
          <p className="text-[11px] text-slate-500">
            This notice will be displayed to Telegram Bot users when they initiate a withdrawal request.
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="withdrawal-save-btn"
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
