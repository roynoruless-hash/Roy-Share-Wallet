import React, { useState } from 'react';
import {
  Zap,
  Sparkles,
  RotateCcw,
  FlaskConical,
  TrendingUp,
  ShieldAlert,
  FileText,
  Activity,
  Users,
  Bell,
  Database,
  Flag,
  Server,
} from 'lucide-react';

import { EnterpriseOperationsView } from './admin/EnterpriseOperationsView';
import { AIRevenueAutomationView } from './admin/AIRevenueAutomationView';
import { HealthCheckDashboard } from './admin/HealthCheckDashboard';
import { RoleBasedAdminView } from './admin/RoleBasedAdminView';
import { AuditLogViewer } from './admin/AuditLogViewer';
import { BackupRestoreView } from './admin/BackupRestoreView';
import { FeatureFlagsManager } from './admin/FeatureFlagsManager';
import { EventTemplatesManager } from './admin/EventTemplatesManager';
import { ScheduledEventsManager } from './admin/ScheduledEventsManager';
import { DiagnosticsView } from './DiagnosticsView';
import { LogsView } from './LogsView';
import { AdminConfig } from '../types';

interface AdvancedViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdvancedView: React.FC<AdvancedViewProps> = ({ config, showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'enterprise' | 'revenue' | 'health' | 'rbac' | 'audit' | 'backup' | 'flags' | 'templates' | 'diagnostics' | 'logs'
  >('enterprise');

  const subTabs = [
    { id: 'enterprise', label: 'Enterprise Ops', icon: Server },
    { id: 'revenue', label: 'AI Revenue Engine', icon: TrendingUp },
    { id: 'health', label: 'Health Dashboard', icon: Activity },
    { id: 'rbac', label: 'Role-Based Access (RBAC)', icon: Users },
    { id: 'audit', label: 'Audit Log Viewer', icon: FileText },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'templates', label: 'Event Templates', icon: Sparkles },
    { id: 'diagnostics', label: 'Diagnostics', icon: FlaskConical },
    { id: 'logs', label: 'System Logs', icon: FileText },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">Advanced Enterprise Section</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO MODULES
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Access Gemini AI, Sandbox, Revenue Automation, RBAC, Disaster Recovery & Feature Flags.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Grid */}
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

      {/* Render Active Sub-Tab View */}
      <div className="pt-2">
        {activeSubTab === 'enterprise' && <EnterpriseOperationsView />}
        {activeSubTab === 'revenue' && <AIRevenueAutomationView />}
        {activeSubTab === 'health' && <HealthCheckDashboard />}
        {activeSubTab === 'rbac' && <RoleBasedAdminView />}
        {activeSubTab === 'audit' && <AuditLogViewer />}
        {activeSubTab === 'backup' && <BackupRestoreView />}
        {activeSubTab === 'flags' && <FeatureFlagsManager />}
        {activeSubTab === 'templates' && <EventTemplatesManager />}
        {activeSubTab === 'diagnostics' && <DiagnosticsView config={config} />}
        {activeSubTab === 'logs' && <LogsView showToast={showToast} />}
      </div>
    </div>
  );
};
