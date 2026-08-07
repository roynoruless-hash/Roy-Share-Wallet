import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Banknote,
  Gift,
  Trophy,
  CheckSquare,
  Radio,
  BarChart3,
  Clock,
  Settings,
  Zap,
  LogOut,
  X,
  Bot,
  Save,
  MessageSquare,
  TrendingUp,
  FileText,
  ShieldCheck,
  Activity,
  History
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
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sections = [
    {
      title: 'Core Operations',
      items: [
        { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users' as TabType, label: 'Users', icon: Users },
        { id: 'wallet' as TabType, label: 'Wallet', icon: Wallet },
        { id: 'withdrawal' as TabType, label: 'Withdraw Requests', icon: Banknote },
        { id: 'transactions' as TabType, label: 'History & Ledger', icon: History },
      ]
    },
    {
      title: 'Growth & Promo',
      items: [
        { id: 'giveaways' as TabType, label: 'Lucky Giveaway', icon: Gift, badge: 'REALTIME' },
        { id: 'giveaway_war' as TabType, label: 'Giveaway War', icon: Trophy },
        { id: 'voting_contests' as TabType, label: 'Voting Contests', icon: Trophy },
        { id: 'referral' as TabType, label: 'Referrals', icon: Users },
        { id: 'milestones' as TabType, label: 'Referral Milestones', icon: TrendingUp },
        { id: 'tasks' as TabType, label: 'Dynamic Tasks', icon: CheckSquare },
      ]
    },
    {
      title: 'AI & Broadcast',
      items: [
        { id: 'ai_broadcast' as TabType, label: 'Broadcast', icon: Radio },
        { id: 'feedback_reviews' as TabType, label: 'Feedback & Reviews', icon: MessageSquare },
        { id: 'ai_revenue_automation' as TabType, label: 'Revenue AI', icon: Zap },
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'telegram' as TabType, label: 'Telegram Bot', icon: Bot },
        { id: 'channel' as TabType, label: 'Channel & Group', icon: ShieldCheck },
        { id: 'settings' as TabType, label: 'System Settings', icon: Settings },
        { id: 'security' as TabType, label: 'Security Hub', icon: ShieldCheck },
        { id: 'advanced' as TabType, label: 'Developer/API', icon: Zap, badge: 'PRO' },
      ]
    }
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
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-68 bg-slate-950 border-r border-slate-900 flex flex-col transition-all duration-300 ease-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="p-6 border-b border-slate-900/65 bg-gradient-to-b from-slate-900/40 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-blue-600 p-[1.5px] shadow-xl shadow-orange-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-orange-400">
                <Bot className="w-5.5 h-5.5" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-1.5">
                ROY SHARE <span className="text-orange-500 font-extrabold text-[10px] bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">V3</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Ledger</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items grouped by sections */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-900">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <div className="px-3 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>{section.title}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></span>
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.label}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/10 via-blue-500/5 to-transparent text-orange-400 pl-3 shadow-md border border-orange-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isActive 
                            ? 'text-orange-400 scale-110' 
                            : 'text-slate-500 group-hover:text-blue-400 group-hover:scale-105'
                        }`}
                      />
                      <span className="text-xs tracking-wide">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${
                          isActive
                            ? 'bg-orange-500 text-slate-950 shadow-md'
                            : 'bg-blue-950/80 text-blue-400 border border-blue-900/50'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Animated vertical border light for active item */}
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-gradient-to-b from-orange-500 to-amber-500"></div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Action Button: Save Configuration & Session */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/80 space-y-3">
          {hasUnsavedChanges && (
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2.5 animate-pulse">
              <Zap className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="font-semibold text-[11px] tracking-wide">Pending configurations unsaved</span>
            </div>
          )}

          <button
            id="sidebar-save-config-btn"
            onClick={() => {
              onSave();
              setIsMobileOpen(false);
            }}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Processing...' : 'Sync Config'}</span>
          </button>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Active Session</span>
            <span className="text-xs text-blue-400 font-mono font-black tracking-widest">
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
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800/80 hover:border-rose-500/20 active:scale-[0.98] transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}

          <div className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Ledger Core v3.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
