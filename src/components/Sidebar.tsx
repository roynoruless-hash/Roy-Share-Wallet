import React from 'react';
import {
  LayoutDashboard,
  Users,
  Send,
  Users2,
  Wallet,
  ArrowDownRight,
  Share2,
  Headphones,
  ShieldAlert,
  Activity,
  FileText,
  Save,
  CheckCircle2,
  X,
  Bot,
  Zap,
  LogOut,
  Award,
} from 'lucide-react';
import { TabType } from '../types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onSave: () => void;
  onLogout?: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  onSave,
  onLogout,
  isSaving,
  hasUnsavedChanges,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'telegram' as TabType,
      label: 'Telegram Configuration',
      icon: Send,
      badge: 'Core',
    },
    {
      id: 'channel' as TabType,
      label: 'Channels & Groups',
      icon: Users2,
      badge: 'v2.0',
    },
    {
      id: 'wallet' as TabType,
      label: 'Wallet Settings',
      icon: Wallet,
      badge: undefined,
    },
    {
      id: 'withdrawal' as TabType,
      label: 'Withdrawal Settings',
      icon: ArrowDownRight,
      badge: undefined,
    },
    {
      id: 'referral' as TabType,
      label: 'Referral Settings',
      icon: Share2,
      badge: undefined,
    },
    {
      id: 'milestones' as TabType,
      label: 'Referral Milestones',
      icon: Award,
      badge: 'New',
    },
    {
      id: 'support' as TabType,
      label: 'Support Settings',
      icon: Headphones,
      badge: undefined,
    },
    {
      id: 'security' as TabType,
      label: 'System Settings',
      icon: ShieldAlert,
      badge: undefined,
    },
    {
      id: 'security' as TabType,
      label: 'Security',
      icon: ShieldAlert,
      badge: undefined,
    },
    {
      id: 'diagnostics' as TabType,
      label: 'Diagnostics',
      icon: Activity,
      badge: 'Live',
    },
    {
      id: 'logs' as TabType,
      label: 'Logs',
      icon: FileText,
      badge: undefined,
    },
  ];

  // Remove duplicate id representation if needed, but keeping explicit list for menu navigation
  // Let's filter out duplicates so 'security' is shown cleanly as System Settings / Security
  const uniqueMenuItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as TabType, label: 'User Management', icon: Users, badge: 'Users' },
    { id: 'telegram' as TabType, label: 'Telegram Configuration', icon: Send, badge: 'Core' },
    { id: 'channel' as TabType, label: 'Channel & Group', icon: Users2 },
    { id: 'wallet' as TabType, label: 'Wallet Settings', icon: Wallet },
    { id: 'withdrawal' as TabType, label: 'Withdrawal Settings', icon: ArrowDownRight },
    { id: 'referral' as TabType, label: 'Referral Settings', icon: Share2 },
    { id: 'support' as TabType, label: 'Support Settings', icon: Headphones },
    { id: 'security' as TabType, label: 'System Settings', icon: ShieldAlert },
    { id: 'diagnostics' as TabType, label: 'Diagnostics', icon: Activity, badge: 'Live' },
    { id: 'logs' as TabType, label: 'Logs', icon: FileText },
  ];

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sky-400">
                <Bot className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Roy Share <span className="text-sky-400">Bot</span>
              </h2>
              <p className="text-xs text-slate-400">Telegram Wallet Admin</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Configuration Menu
          </div>

          {uniqueMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.label}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/15 to-blue-600/10 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                      isActive
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Button: Save Configuration */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 space-y-3">
          {hasUnsavedChanges && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Settings have unsaved modifications</span>
            </div>
          )}

          <button
            id="sidebar-save-config-btn"
            onClick={() => {
              onSave();
              setIsMobileOpen(false);
            }}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-200 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Configuration'}</span>
          </button>

          {onLogout && (
            <button
              id="sidebar-logout-btn"
              onClick={() => {
                onLogout();
                setIsMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/80 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout Admin Session</span>
            </button>
          )}

          <div className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Firestore Config Engine v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
