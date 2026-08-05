import React, { useState, useEffect, useRef } from 'react';
import { AdminConfig, TabType } from './types';
import { DEFAULT_CONFIG, loadAdminConfig, saveAdminConfig, logSystemEvent } from './services/configService';
import { registerWebhook, getWebhookInfo, testBotBackend } from './services/telegramService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TelegramConfigView } from './components/TelegramConfigView';
import { ChannelGroupView } from './components/ChannelGroupView';
import { WalletSettingsView } from './components/WalletSettingsView';
import { WithdrawalSettingsView } from './components/WithdrawalSettingsView';
import { ReferralSettingsView } from './components/ReferralSettingsView';
import { SupportSettingsView } from './components/SupportSettingsView';
import { ReferralMilestonesView } from './components/ReferralMilestonesView';
import { FeedbackCampaignsView } from './components/FeedbackCampaignsView';
import { FeedbackReviewsView } from './components/FeedbackReviewsView';
import { FeedbackUserFlowView } from './components/FeedbackUserFlowView';
import { SecurityView } from './components/SecurityView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { LogsView } from './components/LogsView';
import { UserManagementView } from './components/UserManagementView';
import { TransactionsView } from './components/TransactionsView';
import { ReferralVerifyView } from './components/ReferralVerifyView';
import { ClaimRewardView } from './components/ClaimRewardView';
import { AdminLoginView } from './components/AdminLoginView';
import { VotingContestsView } from './components/VotingContestsView';
import { GiveawayWarView } from './components/GiveawayWarView';
import { AIBroadcastView } from './components/AIBroadcastView';
import { EnterpriseOperationsView } from './components/admin/EnterpriseOperationsView';
import { AIRevenueAutomationView } from './components/admin/AIRevenueAutomationView';
import { GiveawayWarPublicView } from './components/GiveawayWarPublicView';
import { ContestRegistrationView } from './components/ContestRegistrationView';
import { LiveRedeemView } from './components/LiveRedeemView';
import { RedeemEventsView } from './components/RedeemEventsView';
import { BroadcastHistoryView } from './components/BroadcastHistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { AdvancedView } from './components/AdvancedView';
import { SettingsView } from './components/SettingsView';
import { GlobalSearchModal } from './components/admin/GlobalSearchModal';
import { ComingSoonView } from './components/ComingSoonView';
import { Toast, ToastMessage } from './components/Toast';
import { Loader2 } from 'lucide-react';

const SESSION_STORAGE_KEY = 'royshare_admin_session';

function resolveTabFromPath(pathname: string): { tab: TabType; isUnknown: boolean } {
  const p = pathname.toLowerCase().replace(/\/$/, '');
  if (p === '' || p === '/' || p === '/dashboard') return { tab: 'dashboard', isUnknown: false };
  if (p.startsWith('/redeem-events') || p.startsWith('/redeem_events') || p.startsWith('/events')) return { tab: 'redeem_events', isUnknown: false };
  if (p.startsWith('/analytics')) return { tab: 'analytics', isUnknown: false };
  if (p.startsWith('/history') || p.startsWith('/broadcast-history')) return { tab: 'history', isUnknown: false };
  if (p.startsWith('/advanced') || p.startsWith('/pro')) return { tab: 'advanced', isUnknown: false };
  if (p.startsWith('/settings')) return { tab: 'settings', isUnknown: false };
  if (p.startsWith('/giveaway-war') || p.startsWith('/giveaway_war') || p.startsWith('/war') || p.startsWith('/lucky-spin') || p.startsWith('/claim-rewards') || p.startsWith('/event-replay') || p.startsWith('/new-war')) return { tab: 'giveaway_war', isUnknown: false };
  if (p.startsWith('/ai-broadcast') || p.startsWith('/ai_broadcast') || p.startsWith('/broadcast')) return { tab: 'ai_broadcast', isUnknown: false };
  if (p.startsWith('/enterprise') || p.startsWith('/enterprise_ops') || p.startsWith('/enterprise-ops')) return { tab: 'enterprise_ops', isUnknown: false };
  if (p.startsWith('/ai-revenue') || p.startsWith('/ai_revenue') || p.startsWith('/automation') || p.startsWith('/revenue')) return { tab: 'ai_revenue_automation', isUnknown: false };
  if (p.startsWith('/users') || p.startsWith('/user-management')) return { tab: 'users', isUnknown: false };
  if (p.startsWith('/transactions')) return { tab: 'transactions', isUnknown: false };
  if (p.startsWith('/telegram')) return { tab: 'telegram', isUnknown: false };
  if (p.startsWith('/channel')) return { tab: 'channel', isUnknown: false };
  if (p.startsWith('/wallet')) return { tab: 'wallet', isUnknown: false };
  if (p.startsWith('/withdrawal')) return { tab: 'withdrawal', isUnknown: false };
  if (p.startsWith('/referral')) return { tab: 'referral', isUnknown: false };
  if (p.startsWith('/milestones')) return { tab: 'milestones', isUnknown: false };
  if (p.startsWith('/feedback-campaigns') || p.startsWith('/feedback_campaigns')) return { tab: 'feedback_campaigns', isUnknown: false };
  if (p.startsWith('/feedback-reviews') || p.startsWith('/feedback_reviews')) return { tab: 'feedback_reviews', isUnknown: false };
  if (p.startsWith('/voting-contests') || p.startsWith('/voting_contests') || p.startsWith('/contests')) return { tab: 'voting_contests', isUnknown: false };
  if (p.startsWith('/support')) return { tab: 'support', isUnknown: false };
  if (p.startsWith('/security') || p.startsWith('/system')) return { tab: 'security', isUnknown: false };
  if (p.startsWith('/diagnostics')) return { tab: 'diagnostics', isUnknown: false };
  if (p.startsWith('/logs')) return { tab: 'logs', isUnknown: false };

  // Public views handled separately
  if (p.startsWith('/claim-reward') || p.startsWith('/referral-verify') || p.startsWith('/feedback') || p.startsWith('/register-contest')) {
    return { tab: 'dashboard', isUnknown: false };
  }

  return { tab: 'dashboard', isUnknown: true };
}

export default function App() {
  const initialRoute = resolveTabFromPath(window.location.pathname);
  const [activeTab, setActiveTabState] = useState<TabType>(initialRoute.tab);
  const [isUnknownRoute, setIsUnknownRoute] = useState<boolean>(initialRoute.isUnknown);

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    setIsUnknownRoute(false);
  };

  useEffect(() => {
    const handlePopState = () => {
      const res = resolveTabFromPath(window.location.pathname);
      setActiveTabState(res.tab);
      setIsUnknownRoute(res.isUnknown);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session.loggedIn && session.expiresAt && Date.now() < session.expiresAt) {
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not read admin session', e);
    }
    return false;
  });

  const lastActivityRef = useRef<number>(Date.now());

  // Settings Change Verification OTP States
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [settingsChangeOtp, setSettingsChangeOtp] = useState('');
  const [isVerifyingSettingsChange, setIsVerifyingSettingsChange] = useState(false);
  const [settingsChangeError, setSettingsChangeError] = useState('');

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load configuration from Firestore on mount
  useEffect(() => {
    async function initConfig() {
      setIsLoading(true);
      try {
        const res = await loadAdminConfig();
        // Automatically populate every input field with fetched/cached data
        setConfig(res.config);

        if (res.isError) {
          showToast(`Firestore unavailable: ${res.errorMessage}. Existing values preserved.`, 'error');
        } else if (res.config.botToken && res.config.botToken.trim()) {
          // Check webhook status on initial load; if missing, auto-register
          getWebhookInfo(res.config.botToken).then((whInfo) => {
            if (whInfo.success && !whInfo.url) {
              registerWebhook(res.config.botToken).catch((err) =>
                console.warn('Auto webhook registration on load failed:', err)
              );
            }
          });
        }
      } catch (err: any) {
        console.error('Failed to load initial config:', err);
        showToast('Firestore connection error. Retaining existing values.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    initConfig();
  }, []);

  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(3 * 3600);

  // Update session active timestamp
  const refreshSessionActivity = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (isLoggedIn) {
      try {
        const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
        let token = '';
        if (rawSession) {
          token = JSON.parse(rawSession).sessionToken || '';
        }
        const expiresAt = now + 3 * 3600 * 1000; // 3 hours sliding window
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ loggedIn: true, lastActive: now, expiresAt, sessionToken: token })
        );

        // Ping configuration endpoint on server to extend Firestore session sliding window
        if (token) {
          fetch('/api/admin/config', {
            headers: { 'x-admin-session-token': token }
          }).catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    }
  };

  // User activity listeners to keep session active
  useEffect(() => {
    const handleExpiredEvent = () => {
      handleLogout('Session expired or unauthorized. Please login again.');
    };
    window.addEventListener('admin-session-expired', handleExpiredEvent);

    if (!isLoggedIn) {
      return () => {
        window.removeEventListener('admin-session-expired', handleExpiredEvent);
      };
    }

    let throttleTimer: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          refreshSessionActivity();
          throttleTimer = null;
        }, 15000); // throttle to once per 15s
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('admin-session-expired', handleExpiredEvent);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isLoggedIn]);

  // Session Inactivity Countdown check (runs every second)
  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const expiresAt = parsed.expiresAt || (Date.now() + 3 * 3600 * 1000);
          const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          setSessionTimeLeft(remainingSeconds);

          if (remainingSeconds <= 0) {
            handleLogout('Session expired after 3 hours of inactivity.');
          }
        }
      } catch (e) {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLoginSuccess = async (sessionData?: { sessionToken: string; expiresAt: number }) => {
    setIsLoggedIn(true);
    const now = Date.now();
    lastActivityRef.current = now;

    // Fetch decrypted config from server now that we are logged in
    setIsLoading(true);
    try {
      const res = await loadAdminConfig();
      setConfig(res.config);
      if (res.isError) {
        showToast(`Firestore unavailable: ${res.errorMessage}. Existing values preserved.`, 'error');
      }
    } catch (err: any) {
      console.error('Failed to load config on login:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (reason?: string) => {
    setIsLoggedIn(false);
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sessionToken) {
          await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'x-admin-session-token': parsed.sessionToken }
          }).catch(() => {});
        }
      }
    } catch (e) {}
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not remove login session:', e);
    }
    showToast(reason || 'Logged out of Admin Session.', reason ? 'error' : 'info');
  };

  // Update Config Fields Helper
  const updateConfig = (fields: Partial<AdminConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...fields,
    }));
    setHasUnsavedChanges(true);
  };

  // Validation before saving to Firestore
  const validateConfig = (): boolean => {
    if (!config.botToken.trim()) {
      showToast('Validation Error: Bot Token cannot be empty.', 'error');
      setActiveTab('telegram');
      return false;
    }

    if (!config.adminTelegramId.trim()) {
      showToast('Validation Error: Admin Telegram ID cannot be empty.', 'error');
      setActiveTab('telegram');
      return false;
    }

    return true;
  };

  // Request settings change verification OTP
  const requestSettingsChangeOtp = async () => {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    let token = '';
    if (rawSession) {
      token = JSON.parse(rawSession).sessionToken || '';
    }
    try {
      const res = await fetch('/api/admin/request-settings-change-otp', {
        method: 'POST',
        headers: { 'x-admin-session-token': token }
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpModalOpen(true);
        setSettingsChangeOtp('');
        setSettingsChangeError('');
        showToast('🔐 Settings change verification OTP sent to your Telegram Bot!', 'info');
      } else {
        showToast(`Failed to request verification OTP: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast('Network error while requesting verification OTP.', 'error');
    }
  };

  // Verify settings change via OTP and save
  const handleVerifySettingsChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsChangeError('');
    if (!settingsChangeOtp.trim() || settingsChangeOtp.trim().length !== 6) {
      setSettingsChangeError('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsVerifyingSettingsChange(true);
    try {
      await saveAdminConfig(config, settingsChangeOtp.trim());
      await logSystemEvent('activity', 'Admin successfully verified settings change via OTP.', {
        botUsername: config.botUsername,
        adminTelegramId: config.adminTelegramId,
      });

      setHasUnsavedChanges(false);
      setIsOtpModalOpen(false);

      // Automatically register Webhook after saving valid Bot Token
      if (config.botToken.trim()) {
        const whRes = await registerWebhook(config.botToken);
        if (whRes.success) {
          showToast('✅ Configuration Saved & Webhook Registered Successfully', 'success');
        } else {
          showToast(`✅ Config Saved, but Webhook Failed: ${whRes.error || 'Check Bot Token permissions'}`, 'error');
        }
      } else {
        showToast('✅ Configuration Saved Successfully', 'success');
      }
    } catch (error: any) {
      setSettingsChangeError(error.message || 'OTP verification and save failed.');
      showToast(error.message || 'Failed to save configuration.', 'error');
    } finally {
      setIsVerifyingSettingsChange(false);
    }
  };

  // Save Configuration to Firestore settings/config
  const handleSaveConfiguration = async () => {
    if (!validateConfig()) return;

    setIsSaving(true);
    try {
      await saveAdminConfig(config);
      await logSystemEvent('activity', 'Admin updated system configuration in Firestore settings/config.', {
        botUsername: config.botUsername,
        adminTelegramId: config.adminTelegramId,
      });

      setHasUnsavedChanges(false);

      // Requirement 1 & 5: Automatically register Webhook after saving valid Bot Token
      if (config.botToken.trim()) {
        const whRes = await registerWebhook(config.botToken);
        if (whRes.success) {
          showToast('✅ Configuration Saved & Webhook Registered Successfully', 'success');
        } else {
          showToast(`✅ Config Saved, but Webhook Failed: ${whRes.error || 'Check Bot Token permissions'}`, 'error');
        }
      } else {
        showToast('✅ Configuration Saved Successfully', 'success');
      }
    } catch (error: any) {
      if (error.message === 'NEEDS_OTP') {
        await requestSettingsChangeOtp();
      } else {
        console.error('Error saving configuration:', error);
        showToast(`Save Failed: ${error.message || 'Firestore write error'}. Existing values preserved.`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getActiveTabTitle = (): string => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'redeem_events':
        return '🎁 Redeem Events & Live Lobby';
      case 'voting_contests':
        return '🏆 Voting Contest System';
      case 'wallet':
        return '💰 Wallet Settings & Payouts';
      case 'users':
        return '👥 User Management';
      case 'ai_broadcast':
        return '📢 Broadcast & Telegram Channels';
      case 'analytics':
        return '📊 Traffic & System Analytics';
      case 'history':
        return '📜 Broadcast History';
      case 'advanced':
        return '⚡ Advanced Enterprise Tools';
      case 'settings':
        return '⚙️ System Configuration & Settings';
      case 'telegram':
        return 'Telegram Configuration';
      case 'channel':
        return 'Channel & Group';
      case 'withdrawal':
        return 'Withdrawal Settings';
      case 'referral':
        return 'Referral Settings';
      case 'milestones':
        return 'Referral Milestones';
      case 'feedback_campaigns':
        return '⭐ Feedback Campaigns';
      case 'feedback_reviews':
        return 'Feedback Reviews';
      case 'giveaway_war':
        return '⚔️ Giveaway War';
      case 'support':
        return 'Support Settings';
      case 'security':
        return 'System & Security';
      case 'diagnostics':
        return 'System Diagnostics';
      case 'logs':
        return 'Audit Logs';
      default:
        return 'Dashboard';
    }
  };

  // Check if URL is for Referral Verification
  const isClaimRewardRoute = window.location.pathname.startsWith('/claim-reward');
  const isReferralVerifyRoute =
    window.location.pathname.startsWith('/referral-verify') ||
    (new URLSearchParams(window.location.search).has('token') && !isClaimRewardRoute);
  const isFeedbackRoute = window.location.pathname.startsWith('/feedback');
  const isContestRegistrationRoute = window.location.pathname.startsWith('/register-contest');
  const isWarPublicRoute = window.location.pathname.startsWith('/war/') || window.location.pathname.startsWith('/war');
  const urlParams = new URLSearchParams(window.location.search);
  const tgStartParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || '';
  const isLiveRedeemRoute =
    window.location.pathname.startsWith('/live-redeem') ||
    window.location.pathname.startsWith('/live-event') ||
    window.location.pathname.startsWith('/redeem') ||
    Boolean(urlParams.get('liveEventId')) ||
    Boolean(urlParams.get('start')) ||
    Boolean(urlParams.get('startapp')) ||
    Boolean(urlParams.get('tgWebAppStartParam')) ||
    Boolean(tgStartParam);

  if (isLiveRedeemRoute) {
    return <LiveRedeemView botUsername={config.botUsername || 'Roy_wallett_bot'} />;
  }

  if (isClaimRewardRoute) {
    return <ClaimRewardView botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isReferralVerifyRoute) {
    return <ReferralVerifyView botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isFeedbackRoute) {
    const pathParts = window.location.pathname.split('/');
    const campaignId = pathParts[2] || '';
    return <FeedbackUserFlowView campaignId={campaignId} botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isContestRegistrationRoute) {
    const pathParts = window.location.pathname.split('/');
    const rContestId = pathParts[2] || '';
    return <ContestRegistrationView contestId={rContestId} botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isWarPublicRoute) {
    return <GiveawayWarPublicView botUsername={config.botUsername || 'Roy_wallett_bot'} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
        </div>
        <p className="text-sm font-semibold text-slate-300">
          Loading Roy Share Admin Panel from Firestore...
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <AdminLoginView
          config={config}
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-sky-500 selection:text-slate-950">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        onSave={handleSaveConfiguration}
        onLogout={() => handleLogout()}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        sessionTimeLeft={sessionTimeLeft}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          config={config}
          onSave={handleSaveConfiguration}
          onLogout={() => handleLogout()}
          isSaving={isSaving}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          activeTabTitle={getActiveTabTitle()}
          hasUnsavedChanges={hasUnsavedChanges}
          sessionTimeLeft={sessionTimeLeft}
        />

        {/* Dynamic Body Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {isUnknownRoute ? (
            <ComingSoonView
              path={window.location.pathname}
              onGoHome={() => {
                window.history.pushState({}, '', '/');
                setActiveTab('dashboard');
              }}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView config={config} setActiveTab={setActiveTab} />
              )}

              {activeTab === 'redeem_events' && (
                <RedeemEventsView config={config} showToast={showToast} />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView />
              )}

              {activeTab === 'history' && (
                <BroadcastHistoryView />
              )}

              {activeTab === 'advanced' && (
                <AdvancedView config={config} showToast={showToast} />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                  showToast={showToast}
                />
              )}

              {activeTab === 'users' && (
                <UserManagementView config={config} showToast={showToast} />
              )}

              {activeTab === 'transactions' && (
                <TransactionsView />
              )}

              {activeTab === 'telegram' && (
                <TelegramConfigView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                  showToast={showToast}
                />
              )}

              {activeTab === 'channel' && (
                <ChannelGroupView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                  showToast={showToast}
                />
              )}

              {activeTab === 'wallet' && (
                <WalletSettingsView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                  showToast={showToast}
                />
              )}

              {activeTab === 'withdrawal' && (
                <WithdrawalSettingsView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                />
              )}

              {activeTab === 'referral' && (
                <ReferralSettingsView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                  showToast={showToast}
                />
              )}

              {activeTab === 'milestones' && (
                <ReferralMilestonesView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'feedback_campaigns' && (
                <FeedbackCampaignsView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'feedback_reviews' && (
                <FeedbackReviewsView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'voting_contests' && (
                <VotingContestsView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'giveaway_war' && (
                <GiveawayWarView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'ai_broadcast' && (
                <AIBroadcastView
                  config={config}
                  showToast={showToast}
                />
              )}

              {activeTab === 'enterprise_ops' && (
                <EnterpriseOperationsView />
              )}

              {activeTab === 'ai_revenue_automation' && (
                <AIRevenueAutomationView />
              )}

              {activeTab === 'support' && (
                <SupportSettingsView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                />
              )}

              {activeTab === 'security' && (
                <SecurityView
                  config={config}
                  updateConfig={updateConfig}
                  onSave={handleSaveConfiguration}
                  isSaving={isSaving}
                />
              )}

              {activeTab === 'diagnostics' && <DiagnosticsView config={config} />}

              {activeTab === 'logs' && <LogsView showToast={showToast} />}
            </>
          )}
        </main>
      </div>

      {/* Settings Change OTP Modal */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Loader2 className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">Verify Settings Change</h3>
              <p className="text-xs text-slate-400">
                You are modifying sensitive system settings. Please enter the 6-digit OTP sent to your admin Telegram Bot.
              </p>
            </div>

            <form onSubmit={handleVerifySettingsChange} className="space-y-4">
              <div className="space-y-1">
                <input
                  type="text"
                  maxLength={6}
                  value={settingsChangeOtp}
                  onChange={(e) => setSettingsChangeOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-lg font-black tracking-[0.4em] text-sky-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                  disabled={isVerifyingSettingsChange}
                />
              </div>

              {settingsChangeError && (
                <p className="text-xs text-rose-400 text-center font-medium">
                  {settingsChangeError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtpModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-800/80 text-xs font-bold hover:bg-slate-800 text-slate-300 transition"
                  disabled={isVerifyingSettingsChange}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingSettingsChange}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {isVerifyingSettingsChange ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Save</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Notification Toast */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
