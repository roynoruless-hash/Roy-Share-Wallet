import React, { useState } from 'react';
import { Users2, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Save, ToggleLeft, ToggleRight, Radio } from 'lucide-react';
import { AdminConfig } from '../types';
import { verifyChannelAndGroup, formatTelegramUsername } from '../services/telegramService';

interface ChannelGroupViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ChannelGroupView: React.FC<ChannelGroupViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
  showToast,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);

  const handleVerify = async () => {
    if (!config.mainChannelUsername.trim()) {
      showToast('Main Channel Username cannot be empty.', 'error');
      return;
    }
    if (!config.mainGroupUsername.trim()) {
      showToast('Main Group Username cannot be empty.', 'error');
      return;
    }
    if (!config.botToken.trim()) {
      showToast('Please set and validate your Bot Token in Telegram Configuration first.', 'error');
      return;
    }

    setIsVerifying(true);
    setVerificationDone(false);

    const formattedChannel = formatTelegramUsername(config.mainChannelUsername);
    const formattedGroup = formatTelegramUsername(config.mainGroupUsername);

    // Update state with formatted usernames
    updateConfig({
      mainChannelUsername: formattedChannel,
      mainGroupUsername: formattedGroup,
    });

    const res = await verifyChannelAndGroup(
      config.botToken,
      formattedChannel,
      formattedGroup
    );

    setIsVerifying(false);
    setVerificationDone(true);

    updateConfig({
      channelVerified: res.channelVerified,
      groupVerified: res.groupVerified,
      channelVerifyError: res.channelError || '',
      groupVerifyError: res.groupError || '',
    });

    if (res.channelVerified && res.groupVerified) {
      showToast('Channel Verified & Group Verified successfully!', 'success');
    } else {
      showToast('Verification complete with warnings/errors. Check details below.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Users2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Channel & Group Settings</h2>
            <p className="text-xs text-slate-400">
              Set up Force Join channels and community groups for user auto-verification.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Main Channel Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <span>Main Channel Username</span>
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="main-channel-username-input"
              value={config.mainChannelUsername}
              onChange={(e) =>
                updateConfig({
                  mainChannelUsername: e.target.value,
                  channelVerified: false,
                })
              }
              placeholder="@royshare_channel"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
            {!config.mainChannelUsername && (
              <p className="text-[11px] text-rose-400">Channel Username is required.</p>
            )}
          </div>

          {/* Main Group Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-sky-400" />
              <span>Main Group Username</span>
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="main-group-username-input"
              value={config.mainGroupUsername}
              onChange={(e) =>
                updateConfig({
                  mainGroupUsername: e.target.value,
                  groupVerified: false,
                })
              }
              placeholder="@royshare_group"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
            {!config.mainGroupUsername && (
              <p className="text-[11px] text-rose-400">Group Username is required.</p>
            )}
          </div>
        </div>

        {/* Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Force Join Enable/Disable */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Force Join Requirements</p>
              <p className="text-[11px] text-slate-400">
                Users must join main channel & group to access wallet.
              </p>
            </div>
            <button
              type="button"
              id="force-join-toggle-btn"
              onClick={() => updateConfig({ forceJoinEnabled: !config.forceJoinEnabled })}
              className={`p-1.5 rounded-lg transition ${
                config.forceJoinEnabled ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.forceJoinEnabled ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Auto Verification Enable/Disable */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Auto Member Verification</p>
              <p className="text-[11px] text-slate-400">
                Automatically query Telegram API for membership status.
              </p>
            </div>
            <button
              type="button"
              id="auto-verification-toggle-btn"
              onClick={() => updateConfig({ autoVerificationEnabled: !config.autoVerificationEnabled })}
              className={`p-1.5 rounded-lg transition ${
                config.autoVerificationEnabled ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.autoVerificationEnabled ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>

        {/* Verification Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <p className="text-xs font-bold text-slate-200">Verify Channel & Group Status</p>
            <p className="text-[11px] text-slate-400">
              Validates that the Bot is an Admin in the channel & group with required permissions.
            </p>
          </div>

          <button
            type="button"
            id="verify-channel-group-btn"
            onClick={handleVerify}
            disabled={isVerifying || !config.mainChannelUsername || !config.mainGroupUsername}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs sm:text-sm border border-sky-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking Bot Permissions...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Channel & Group</span>
              </>
            )}
          </button>
        </div>

        {/* Verification Results Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Channel Result Card */}
          <div
            className={`p-4 rounded-xl border ${
              config.channelVerified
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Channel Status</span>
              {config.channelVerified ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Channel Verified</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-400">
                  <XCircle className="w-4 h-4" />
                  <span>Unverified</span>
                </span>
              )}
            </div>
            {config.channelVerifyError && (
              <p className="text-[11px] mt-2 opacity-90">{config.channelVerifyError}</p>
            )}
          </div>

          {/* Group Result Card */}
          <div
            className={`p-4 rounded-xl border ${
              config.groupVerified
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Group Status</span>
              {config.groupVerified ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Group Verified</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-400">
                  <XCircle className="w-4 h-4" />
                  <span>Unverified</span>
                </span>
              )}
            </div>
            {config.groupVerifyError && (
              <p className="text-[11px] mt-2 opacity-90">{config.groupVerifyError}</p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="channel-save-btn"
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
