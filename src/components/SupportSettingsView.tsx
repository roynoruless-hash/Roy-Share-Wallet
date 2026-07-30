import React from 'react';
import { Headphones, Users2, MessageSquare, Save } from 'lucide-react';
import { AdminConfig } from '../types';

interface SupportSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const SupportSettingsView: React.FC<SupportSettingsViewProps> = ({
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
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Support & Contact Settings</h2>
            <p className="text-xs text-slate-400">
              Configure support contact handles shown to users inside the Telegram Bot interface.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Support Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>Support Username</span>
              <span className="text-sky-400 font-normal text-[11px]">(e.g. @royshare)</span>
            </label>
            <input
              type="text"
              id="support-username-input"
              value={config.supportUsername}
              onChange={(e) => updateConfig({ supportUsername: e.target.value })}
              placeholder="@royshare"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>

          {/* Support Group (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-purple-400" />
              <span>Support Group</span>
              <span className="text-slate-500 font-normal text-[11px]">(Optional)</span>
            </label>
            <input
              type="text"
              id="support-group-input"
              value={config.supportGroup}
              onChange={(e) => updateConfig({ supportGroup: e.target.value })}
              placeholder="@royshare_support"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="support-save-btn"
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
