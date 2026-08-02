import React, { useState } from 'react';
import { Send, Key, User, Shield, CheckCircle2, XCircle, RefreshCw, Save, Lock, Bot, Radio, Zap } from 'lucide-react';
import { AdminConfig } from '../types';
import { testBotToken, testBotBackend, registerWebhook, getWebhookInfo } from '../services/telegramService';
import { TelegramDestinationManager } from './TelegramDestinationManager';

interface TelegramConfigViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TelegramConfigView: React.FC<TelegramConfigViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
  showToast,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingFullBot, setIsTestingFullBot] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!config.botToken.trim()) {
      showToast('Please enter a Bot Token before testing connection.', 'error');
      setTestResult({
        tested: true,
        success: false,
        message: '❌ Invalid Bot Token (Token cannot be empty)',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testBotToken(config.botToken);

    setIsTesting(false);

    if (res.success && res.botName && res.botUsername) {
      updateConfig({
        botName: res.botName,
        botUsername: res.botUsername,
        botId: res.botId || '',
        botTokenValidated: true,
      });

      setTestResult({
        tested: true,
        success: true,
        message: '✅ Bot Connected & Token Validated Successfully',
      });
      showToast('Bot Token verified! Bot details loaded successfully.', 'success');
    } else {
      updateConfig({
        botTokenValidated: false,
      });
      setTestResult({
        tested: true,
        success: false,
        message: `❌ ${res.error || 'Invalid Bot Token'}`,
      });
      showToast(`Validation Failed: ${res.error || 'Invalid Bot Token'}`, 'error');
    }
  };

  // Requirement 7 & 8: Test Bot Button logic
  const handleTestBotFull = async () => {
    if (!config.botToken.trim()) {
      showToast('Please enter a Bot Token before testing bot.', 'error');
      return;
    }

    setIsTestingFullBot(true);
    setTestResult(null);

    const adminChat = config.adminChatId || config.adminTelegramId;
    const res = await testBotBackend(config.botToken, adminChat);

    setIsTestingFullBot(false);

    if (res.success) {
      if (res.botInfo) {
        updateConfig({
          botName: res.botInfo.firstName,
          botUsername: res.botInfo.username,
          botId: String(res.botInfo.id),
          botTokenValidated: true,
        });
      }

      setTestResult({
        tested: true,
        success: true,
        message: `✅ ${res.message}`,
        details: res.webhookInfo,
      });
      showToast(`Bot Test Successful: ${res.message}`, 'success');
    } else {
      setTestResult({
        tested: true,
        success: false,
        message: `❌ Bot Test Failed: ${res.error || res.message}`,
      });
      showToast(`Bot Test Failed: ${res.error || res.message}`, 'error');
    }
  };

  // Manual Register Webhook Action
  const handleRegisterWebhook = async () => {
    if (!config.botToken.trim()) {
      showToast('Bot Token required to register webhook.', 'error');
      return;
    }

    setIsRegisteringWebhook(true);
    const res = await registerWebhook(config.botToken);
    setIsRegisteringWebhook(false);

    if (res.success) {
      showToast(`✅ Webhook Registered: ${res.webhookUrl}`, 'success');
      setTestResult({
        tested: true,
        success: true,
        message: `✅ Webhook Registered Successfully (${res.webhookUrl})`,
      });
    } else {
      showToast(`❌ Webhook Failed: ${res.error}`, 'error');
      setTestResult({
        tested: true,
        success: false,
        message: `❌ Webhook Error: ${res.error}`,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Section Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Telegram Bot Configuration</h2>
            <p className="text-xs text-slate-400">
              Configure Telegram Bot Token, Admin Telegram ID, and Webhook responses.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Bot Token Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span>Bot Token</span>
                <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] text-slate-500">Obtained from @BotFather</span>
            </label>
            <div className="relative">
              <input
                type="password"
                id="bot-token-input"
                value={config.botToken}
                onChange={(e) =>
                  updateConfig({
                    botToken: e.target.value,
                    botTokenValidated: false, // Reset validation when token changes
                  })
                }
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
            </div>
            {!config.botToken && (
              <p className="text-xs text-rose-400/90 flex items-center gap-1">
                <span>* Bot Token is required for system operation.</span>
              </p>
            )}
          </div>

          {/* Action Buttons: Test Connection, Test Bot, Sync Webhook */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div>
              <p className="text-xs font-semibold text-slate-200">Bot Diagnostics & Webhook Sync</p>
              <p className="text-[11px] text-slate-400">
                Verify token, test live webhook responses, and auto-reply to /start.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                id="test-bot-connection-btn"
                onClick={handleTestConnection}
                disabled={isTesting || !config.botToken}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-bold text-xs border border-sky-500/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Check Token</span>
              </button>

              {/* Requirement 7: Test Bot Button */}
              <button
                type="button"
                id="test-bot-full-btn"
                onClick={handleTestBotFull}
                disabled={isTestingFullBot || !config.botToken}
                className="px-4 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-sm"
              >
                {isTestingFullBot ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-sky-400" />}
                <span>Test Bot</span>
              </button>

              <button
                type="button"
                id="sync-webhook-btn"
                onClick={handleRegisterWebhook}
                disabled={isRegisteringWebhook || !config.botToken}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {isRegisteringWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Sync Webhook</span>
              </button>
            </div>
          </div>

          {/* Test Result Display Card */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border transition-all ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>

              {testResult.details && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs text-slate-300 space-y-1">
                  <p><b>Registered Webhook URL:</b> <code className="bg-slate-950 px-2 py-0.5 rounded text-sky-300">{testResult.details.url || 'Active'}</code></p>
                  <p><b>Pending Updates:</b> {testResult.details.pendingUpdates ?? 0}</p>
                  {testResult.details.lastError && (
                    <p className="text-amber-400"><b>Last Telegram Error:</b> {testResult.details.lastError}</p>
                  )}
                </div>
              )}

              {testResult.success && config.botName && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Bot Name</span>
                    <span className="font-bold text-white text-sm">{config.botName}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Bot Username</span>
                    <span className="font-bold text-sky-400 text-sm">@{config.botUsername}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Bot ID</span>
                    <span className="font-bold text-slate-200 text-sm font-mono">{config.botId}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Read Only Fields: Bot Name & Bot Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-slate-400" />
                <span>Bot Name (Read Only)</span>
                <Lock className="w-3 h-3 text-slate-500 ml-auto" />
              </label>
              <input
                type="text"
                readOnly
                value={config.botName || 'Not Verified Yet'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 cursor-not-allowed font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                <span>Bot Username (Read Only)</span>
                <Lock className="w-3 h-3 text-slate-500 ml-auto" />
              </label>
              <input
                type="text"
                readOnly
                value={config.botUsername ? `@${config.botUsername}` : 'Not Verified Yet'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 cursor-not-allowed font-medium"
              />
            </div>
          </div>

          {/* Admin Telegram ID & Admin Chat ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-400" />
                <span>Admin Telegram ID</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                id="admin-telegram-id-input"
                value={config.adminTelegramId}
                onChange={(e) => updateConfig({ adminTelegramId: e.target.value })}
                placeholder="e.g. 123456789"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
              {!config.adminTelegramId && (
                <p className="text-[11px] text-rose-400">Admin Telegram ID is required.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                <span>Admin Chat ID</span>
                <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                id="admin-chat-id-input"
                value={config.adminChatId}
                onChange={(e) => updateConfig({ adminChatId: e.target.value })}
                placeholder="e.g. -100123456789"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
              />
            </div>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            id="telegram-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Dynamic Destination Manager */}
      <TelegramDestinationManager config={config} showToast={showToast} />
    </div>
  );
};
