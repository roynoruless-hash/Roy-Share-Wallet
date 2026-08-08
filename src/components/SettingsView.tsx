import React, { useState } from 'react';
import {
  Settings,
  Send,
  Users2,
  Wallet,
  ArrowDownRight,
  Share2,
  Headphones,
  ShieldAlert,
} from 'lucide-react';
import { AdminConfig } from '../types';

import { TelegramConfigView } from './TelegramConfigView';
import { ChannelGroupView } from './ChannelGroupView';
import { WalletSettingsView } from './WalletSettingsView';
import { WithdrawalSettingsView } from './WithdrawalSettingsView';
import { ReferralSettingsView } from './ReferralSettingsView';
import { SupportSettingsView } from './SupportSettingsView';
import { SecurityView } from './SecurityView';

interface SettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'telegram' | 'channel' | 'wallet' | 'withdrawal' | 'referral' | 'support' | 'security'
  >('telegram');

  const subTabs = [
    { id: 'telegram', label: 'Telegram Bot', icon: Send },
    { id: 'channel', label: 'Channels & Groups', icon: Users2 },
    { id: 'wallet', label: 'Wallet Rules', icon: Wallet },
    { id: 'withdrawal', label: 'Withdrawal Rules', icon: ArrowDownRight },
    { id: 'referral', label: 'Referral Engine', icon: Share2 },
    { id: 'support', label: 'Support Info', icon: Headphones },
    { id: 'security', label: 'System & Security', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">System Configuration & Settings</h1>
            <p className="text-xs text-slate-400">Configure Telegram Bot, Channel Verification, Wallet Bonuses, & Security.</p>
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex flex-wrap gap-2 p-2 rounded-2xl bg-slate-900/80 border border-slate-800">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Render Selected Sub-View */}
      <div className="pt-2">
        {activeSubTab === 'telegram' && (
          <TelegramConfigView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
            showToast={showToast}
          />
        )}
        {activeSubTab === 'channel' && (
          <ChannelGroupView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
            showToast={showToast}
          />
        )}
        {activeSubTab === 'wallet' && (
          <WalletSettingsView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
            showToast={showToast}
          />
        )}
        {activeSubTab === 'withdrawal' && (
          <WithdrawalSettingsView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
          />
        )}
        {activeSubTab === 'referral' && (
          <ReferralSettingsView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
            showToast={showToast}
          />
        )}
        {activeSubTab === 'support' && (
          <SupportSettingsView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
          />
        )}
        {activeSubTab === 'security' && (
          <SecurityView
            config={config}
            updateConfig={updateConfig}
            onSave={onSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
};
