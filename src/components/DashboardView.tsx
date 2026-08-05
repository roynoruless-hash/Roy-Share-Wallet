import React from 'react';
import {
  Users,
  UserCheck,
  Wallet,
  Clock,
  CheckCircle2,
  UserPlus,
  Bot,
  Send,
  ShieldCheck,
  Activity,
  ArrowRight,
  Database,
  Radio,
  Settings,
} from 'lucide-react';
import { AdminConfig, TabType } from '../types';
import { AdminCommandCenter } from './admin/AdminCommandCenter';

interface DashboardViewProps {
  config: AdminConfig;
  setActiveTab: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ config, setActiveTab }) => {
  const statCards = [
    {
      title: 'Total Users',
      value: '0',
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      badge: 'Step 2 Ready',
    },
    {
      title: 'Verified Users',
      value: '0',
      icon: UserCheck,
      color: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      badge: '0%',
    },
    {
      title: 'Wallet Balance',
      value: '₹0',
      icon: Wallet,
      color: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      badge: 'INR',
    },
    {
      title: 'Pending Withdraw',
      value: '0',
      icon: Clock,
      color: 'from-rose-500 to-pink-600',
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      badge: 'Queue',
    },
    {
      title: 'Completed Withdraw',
      value: '0',
      icon: CheckCircle2,
      color: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      badge: 'Processed',
    },
    {
      title: "Today's Users",
      value: '0',
      icon: UserPlus,
      color: 'from-purple-500 to-violet-600',
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      badge: '24h',
    },
  ];

  return (
    <div className="space-y-6">
      {/* PHASE XII: Admin Command Center */}
      <AdminCommandCenter />

      {/* Bot Connection Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/40 border border-slate-800 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Roy Share Telegram Wallet Bot Setup
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Step 1 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                The Admin Configuration Module is active and linked to Firestore (`settings/config`). Configure Bot tokens, Channel verification, and Wallet default rules below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('telegram')}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-lg shadow-sky-500/20"
            >
              <Send className="w-4 h-4" />
              <span>Telegram Config</span>
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 flex items-center gap-2 transition"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isUserCard = card.title === 'Total Users' || card.title === 'Verified Users';
          return (
            <div
              key={card.title}
              onClick={() => {
                if (isUserCard) setActiveTab('users');
              }}
              className={`p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-lg relative group overflow-hidden ${
                isUserCard ? 'cursor-pointer hover:bg-slate-800/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${card.iconBg}`}
                >
                  {card.badge}
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {card.value}
                </span>
                <div
                  className={`p-3 rounded-xl border ${card.iconBg} transition-transform group-hover:scale-110 duration-200`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
                <span>System metric initialized for module operations</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overview & Quick Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Settings Quick Summary */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Current Active Settings Summary</h3>
            </div>
            <button
              onClick={() => setActiveTab('wallet')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
            >
              <span>Edit Settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Registration Bonus</span>
              <span className="font-bold text-emerald-400">₹{config.registrationBonus}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Referral Bonus</span>
              <span className="font-bold text-emerald-400">₹{config.referralBonus}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Min / Max Withdrawal</span>
              <span className="font-bold text-white">
                ₹{config.minWithdrawal} - ₹{config.maxWithdrawal}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Withdrawal Tax</span>
              <span className="font-bold text-amber-400">{config.withdrawalTax}%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Support Handle</span>
              <span className="font-bold text-sky-400">{config.supportUsername || '@royshare'}</span>
            </div>
          </div>
        </div>

        {/* Telegram & Channel Status Summary */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Bot & Channel Integration</h3>
            </div>
            <button
              onClick={() => setActiveTab('channel')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
            >
              <span>Verify Channel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Bot Name</span>
              <span className="font-semibold text-white">
                {config.botName || 'Not Tested'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Bot Username</span>
              <span className="font-semibold text-sky-400">
                {config.botUsername ? `@${config.botUsername}` : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Main Channel</span>
              <span className="font-semibold text-slate-200">
                {config.mainChannelUsername || 'Not Configured'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Main Group</span>
              <span className="font-semibold text-slate-200">
                {config.mainGroupUsername || 'Not Configured'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 text-xs">
              <span className="text-slate-400">Maintenance Mode</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  config.maintenanceMode
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {config.maintenanceMode ? 'ENABLED' : 'OFF (LIVE)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
