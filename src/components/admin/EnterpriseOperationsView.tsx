import React, { useState } from 'react';
import { Calendar, Layers, ShieldCheck, FileText, Database, Megaphone, Sliders, Activity, Server } from 'lucide-react';
import { ScheduledEventsManager } from './ScheduledEventsManager';
import { EventTemplatesManager } from './EventTemplatesManager';
import { RoleBasedAdminView } from './RoleBasedAdminView';
import { AuditLogViewer } from './AuditLogViewer';
import { BackupRestoreView } from './BackupRestoreView';
import { AnnouncementsManager } from './AnnouncementsManager';
import { FeatureFlagsManager } from './FeatureFlagsManager';
import { HealthCheckDashboard } from './HealthCheckDashboard';

type OpsTab = 'scheduled' | 'templates' | 'rbac' | 'audit' | 'backup' | 'announcements' | 'flags' | 'health';

export const EnterpriseOperationsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<OpsTab>('scheduled');

  const tabs: { id: OpsTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'scheduled', label: '1. Scheduled Events', icon: Calendar, badge: 'Auto' },
    { id: 'templates', label: '2. Event Templates', icon: Layers, badge: '1-Click' },
    { id: 'rbac', label: '3. Admin Roles & RBAC', icon: ShieldCheck, badge: 'Matrix' },
    { id: 'audit', label: '4. Audit Log', icon: FileText, badge: 'Ledger' },
    { id: 'backup', label: '5. Backup & Restore', icon: Database, badge: 'Snapshot' },
    { id: 'announcements', label: '6. System Announcements', icon: Megaphone },
    { id: 'flags', label: '7. Feature Flags', icon: Sliders, badge: 'Live' },
    { id: 'health', label: '8. Health Check', icon: Activity, badge: 'Daily' },
  ];

  return (
    <div className="space-y-6">
      {/* Enterprise Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 p-0.5 shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sky-400">
                <Server className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                  Phase XIII Enterprise Standard
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide mt-1">
                Enterprise Operations Management
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-stack control for automated scheduled drops, RBAC matrix, immutable logs, backups & health monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl font-bold text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    isActive ? 'bg-slate-950 text-sky-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Render Active Sub-Component */}
      <div className="transition-all duration-300">
        {activeSubTab === 'scheduled' && <ScheduledEventsManager />}
        {activeSubTab === 'templates' && <EventTemplatesManager />}
        {activeSubTab === 'rbac' && <RoleBasedAdminView />}
        {activeSubTab === 'audit' && <AuditLogViewer />}
        {activeSubTab === 'backup' && <BackupRestoreView />}
        {activeSubTab === 'announcements' && <AnnouncementsManager />}
        {activeSubTab === 'flags' && <FeatureFlagsManager />}
        {activeSubTab === 'health' && <HealthCheckDashboard />}
      </div>
    </div>
  );
};
