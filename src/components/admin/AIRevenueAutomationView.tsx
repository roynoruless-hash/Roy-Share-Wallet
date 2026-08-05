import React, { useState } from 'react';
import {
  ShieldAlert,
  Zap,
  DollarSign,
  Share2,
  Lightbulb,
  Calculator,
  Users,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { FraudInvestigationView } from '../automation/FraudInvestigationView';
import { AutoRewardEngineView } from '../automation/AutoRewardEngineView';
import { RevenueAnalyticsView } from '../automation/RevenueAnalyticsView';
import { AutoEventSummaryView } from '../automation/AutoEventSummaryView';
import { AdminInsightsView } from '../automation/AdminInsightsView';
import { RewardBudgetPlannerView } from '../automation/RewardBudgetPlannerView';
import { UserRetentionEngineView } from '../automation/UserRetentionEngineView';
import { IncidentCenterView } from '../automation/IncidentCenterView';

export const AIRevenueAutomationView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'fraud' | 'auto_reward' | 'revenue' | 'event_summary' | 'insights' | 'budget_planner' | 'retention' | 'incidents'
  >('fraud');

  const navItems = [
    { id: 'fraud', label: '1. AI Fraud Investigation', icon: ShieldAlert, badge: 'AI Radar' },
    { id: 'auto_reward', label: '2. Auto Reward Engine', icon: Zap, badge: 'Auto Payout' },
    { id: 'revenue', label: '3. Smart Revenue Analytics', icon: DollarSign, badge: 'Financials' },
    { id: 'event_summary', label: '4. Auto Event Summary', icon: Share2, badge: '1-Click' },
    { id: 'insights', label: '5. Admin Insights', icon: Lightbulb, badge: 'Morning Digest' },
    { id: 'budget_planner', label: '6. Reward Budget Planner', icon: Calculator, badge: 'AI Allocation' },
    { id: 'retention', label: '7. User Retention Engine', icon: Users, badge: 'Win-Back' },
    { id: 'incidents', label: '8. Real-Time Incident Center', icon: AlertTriangle, badge: 'Alerts' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Main Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border border-emerald-500/30 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Phase XIV Enterprise Engine</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <span>AI Automation & Revenue Engine</span>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              PHASE XIV
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Autonomous fraud analysis, trigger-based reward rules, smart financial analytics, AI event summaries, morning digests, budget allocation & incident defense.
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800/80">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSubTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSubTab(item.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-950 text-emerald-400 border border-slate-800'
                }`}
              >
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Rendering */}
      <div className="mt-4">
        {activeSubTab === 'fraud' && <FraudInvestigationView />}
        {activeSubTab === 'auto_reward' && <AutoRewardEngineView />}
        {activeSubTab === 'revenue' && <RevenueAnalyticsView />}
        {activeSubTab === 'event_summary' && <AutoEventSummaryView />}
        {activeSubTab === 'insights' && <AdminInsightsView />}
        {activeSubTab === 'budget_planner' && <RewardBudgetPlannerView />}
        {activeSubTab === 'retention' && <UserRetentionEngineView />}
        {activeSubTab === 'incidents' && <IncidentCenterView />}
      </div>
    </div>
  );
};
