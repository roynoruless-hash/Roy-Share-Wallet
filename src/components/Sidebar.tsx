import React from 'react';
import {
  LayoutDashboard,
  Gift,
  Trophy,
  Wallet,
  Users,
  Radio,
  BarChart3,
  Clock,
  Zap,
  Settings,
  LogOut,
  X,
  Bot,
  Save,
  CheckCircle2,
  CheckSquare,
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
  sessionTimeLeft?: number;
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
  sessionTimeLeft = 10800,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'voting_contests' as TabType,
      label: 'Voting',
      icon: Trophy,
      badge: undefined,
    },
    {
      id: 'giveaways' as TabType,
      label: 'Giveaways',
      icon: Gift,
      badge: 'NEW',
    },
    {
      id: 'wallet' as TabType,
      label: 'Wallet',
      icon: Wallet,
      badge: undefined,
    },
    {
      id: 'users' as TabType,
      label: 'Users',
      icon: Users,
      badge: undefined,
    },
    {
      id: 'ai_broadcast' as TabType,
      label: 'Broadcast',
      icon: Radio,
      badge: undefined,
    },
    {
      id: 'analytics' as TabType,
      label: 'Analytics',
      icon: BarChart3,
      badge: undefined,
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: Clock,
      badge: undefined,
    },
    {
      id: 'advanced' as TabType,
      label: 'Advanced',
      icon: Zap,
      badge: 'PRO',
    },
    {
      id: 'tasks' as TabType,
      label: 'Tasks',
      icon: CheckSquare,
      badge: undefined,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
      badge: undefined,
    },
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-sky-500 to-blue-600 p-0.5 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                ROY SHARE <span className="text-amber-400 font-bold text-xs bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">V2</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Enterprise Admin Panel</p>
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
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Main Menu
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.label}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent text-amber-400 border-l-4 border-amber-400 pl-2.5 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
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

        {/* Action Button: Save Configuration & Session */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
          {hasUnsavedChanges && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Unsaved changes</span>
            </div>
          )}

          <button
            id="sidebar-save-config-btn"
            onClick={() => {
              onSave();
              setIsMobileOpen(false);
            }}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Session</span>
            <span className="text-xs text-amber-400 font-mono font-black tracking-wider">
              {(() => {
                const h = Math.floor(sessionTimeLeft / 3600);
                const m = Math.floor((sessionTimeLeft % 3600) / 60);
                const s = sessionTimeLeft % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              })()}
            </span>
          </div>

          {onLogout && (
            <button
              id="sidebar-logout-btn"
              onClick={() => {
                onLogout();
                setIsMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}

          <div className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Firestore Engine v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};

