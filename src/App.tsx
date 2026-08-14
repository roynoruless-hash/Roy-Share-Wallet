import React, { useState, useEffect, useRef } from 'react';
import { AdminConfig, TabType } from './types';
import { DEFAULT_CONFIG, loadAdminConfig, saveAdminConfig, logSystemEvent } from './services/configService';
import { registerWebhook, getWebhookInfo, testBotBackend } from './services/telegramService';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TelegramConfigView } from './components/TelegramConfigView';
import { EarningBotsView } from './components/EarningBotsView';
import { EarningBotWithdrawalsView } from './components/EarningBotWithdrawalsView';
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
import { SecurityReviewView } from './components/admin/SecurityReviewView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { LogsView } from './components/LogsView';
import { UserManagementView } from './components/UserManagementView';
import { TransactionsView } from './components/TransactionsView';
import { ReferralVerifyView } from './components/ReferralVerifyView';
import { ClaimRewardView } from './components/ClaimRewardView';
import { AdminLoginView } from './components/AdminLoginView';
import { VotingContestsView } from './components/VotingContestsView';
import { AIBroadcastView } from './components/AIBroadcastView';
import { LuckyGiveawaysView } from './components/admin/LuckyGiveawaysView';
import { EnterpriseOperationsView } from './components/admin/EnterpriseOperationsView';
import { AIRevenueAutomationView } from './components/admin/AIRevenueAutomationView';
import { ContestRegistrationView } from './components/ContestRegistrationView';
import { UserAppView } from './components/UserAppView';
import { BroadcastHistoryView } from './components/BroadcastHistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { AdvancedView } from './components/AdvancedView';
import { SettingsView } from './components/SettingsView';
import { TasksManagerView } from './components/admin/TasksManagerView';
import { GlobalSearchModal } from './components/admin/GlobalSearchModal';
import { ComingSoonView } from './components/ComingSoonView';
import { Toast, ToastMessage } from './components/Toast';
import { Loader2 } from 'lucide-react';
import { DebugView } from './components/DebugView';
import { db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const SESSION_STORAGE_KEY = 'royshare_admin_session';

function resolveTabFromPath(pathname: string): { tab: TabType; isUnknown: boolean } {
  const p = pathname.toLowerCase().replace(/\/$/, '');
  if (p === '' || p === '/' || p === '/dashboard') return { tab: 'dashboard', isUnknown: false };
  if (p.startsWith('/analytics')) return { tab: 'analytics', isUnknown: false };
  if (p.startsWith('/history') || p.startsWith('/broadcast-history')) return { tab: 'history', isUnknown: false };
  if (p.startsWith('/advanced') || p.startsWith('/pro')) return { tab: 'advanced', isUnknown: false };
  if (p.startsWith('/settings')) return { tab: 'settings', isUnknown: false };
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
  if (p.startsWith('/tasks')) return { tab: 'tasks', isUnknown: false };
  if (p.startsWith('/feedback-campaigns') || p.startsWith('/feedback_campaigns')) return { tab: 'feedback_campaigns', isUnknown: false };
  if (p.startsWith('/feedback-reviews') || p.startsWith('/feedback_reviews')) return { tab: 'feedback_reviews', isUnknown: false };
  if (p.startsWith('/voting-contests') || p.startsWith('/voting_contests') || p.startsWith('/contests')) return { tab: 'voting_contests', isUnknown: false };
  if (p.startsWith('/support')) return { tab: 'support', isUnknown: false };
  if (p.startsWith('/security-review') || p.startsWith('/security_review')) return { tab: 'security_review', isUnknown: false };
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
  const [isLoading, setIsLoading] = useState(false);
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

  const [configDiagnostic, setConfigDiagnostic] = useState<{
    status: 'idle' | 'loading' | 'success' | 'failed';
    collection: string;
    documentId: string;
    exists: boolean | null;
    fields: string[];
    error?: string;
    errorCode?: string;
    latency?: number;
    requestStartedAt?: string;
    requestFinishedAt?: string;
  }>({
    status: 'idle',
    collection: 'settings',
    documentId: 'config',
    exists: null,
    fields: []
  });

  const [apiDiagnostic, setApiDiagnostic] = useState<{
    status: 'idle' | 'loading' | 'success' | 'failed' | 'skipped';
    endpoint: string;
    method: string;
    httpStatus: number | null;
    fields: string[];
    error?: string;
    latency?: number;
  }>({
    status: 'idle',
    endpoint: '/api/admin/config',
    method: 'GET',
    httpStatus: null,
    fields: []
  });

  // Load configuration from API/Firestore on mount
  useEffect(() => {
    let active = true;
    async function initConfig() {
      setIsLoading(true);
      const startTime = Date.now();
      
      // Get session token if present
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      let sessionToken = '';
      if (rawSession) {
        try {
          sessionToken = JSON.parse(rawSession).sessionToken || '';
        } catch (e) {}
      }

      let loadedConfig: Partial<AdminConfig> | null = null;
      let apiSucceeded = false;
      let apiStatus: number | null = null;
      let apiLatency = 0;
      let apiFields: string[] = [];
      let apiErrorMsg = '';

      if (sessionToken) {
        console.log('[ADMIN_CONFIG_API_TEST] Requesting /api/admin/config GET');
        setApiDiagnostic((prev) => ({ ...prev, status: 'loading' }));
        const apiStartTime = Date.now();
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const res = await fetch('/api/admin/config', {
            method: 'GET',
            headers: {
              'x-admin-session-token': sessionToken,
              'Authorization': `Bearer ${sessionToken}`
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          apiStatus = res.status;
          apiLatency = Date.now() - apiStartTime;

          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.config) {
              loadedConfig = data.config;
              apiFields = Object.keys(data.config).map(k => k); // sanitized keys only
              apiSucceeded = true;
              console.log('[ADMIN_CONFIG_API_TEST] Successfully fetched admin config from API.');
            } else {
              apiErrorMsg = data?.error || 'API returned success=false';
            }
          } else {
            apiErrorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
            if (res.status === 401 || res.status === 403) {
              console.warn('[ADMIN_CONFIG_API_TEST] Unauthorized config fetch, dispatching admin-session-expired');
              window.dispatchEvent(new CustomEvent('admin-session-expired'));
            }
          }
        } catch (err: any) {
          apiLatency = Date.now() - apiStartTime;
          apiErrorMsg = err?.message || String(err);
          console.warn('[ADMIN_CONFIG_API_TEST] Failed to fetch config via API:', err);
        }

        if (active) {
          setApiDiagnostic({
            status: apiSucceeded ? 'success' : 'failed',
            endpoint: '/api/admin/config',
            method: 'GET',
            httpStatus: apiStatus,
            fields: apiFields,
            error: apiErrorMsg,
            latency: apiLatency
          });
        }
      } else {
        if (active) {
          setApiDiagnostic((prev) => ({ ...prev, status: 'skipped', error: 'No session token found' }));
        }
      }

      // If API succeeded, we use it. Otherwise, we try the Firestore fallback.
      if (apiSucceeded && loadedConfig) {
        if (active) {
          const merged: AdminConfig = {
            ...DEFAULT_CONFIG,
            ...loadedConfig,
          };
          setConfig(merged);
          setIsLoading(false);
        }
        return;
      }

      // --- Firestore Fallback ---
      console.log('[FIRESTORE_CONFIG_FALLBACK] Attempting Firestore read on path: settings/config');
      setConfigDiagnostic((prev) => ({
        ...prev,
        status: 'loading',
        requestStartedAt: new Date().toISOString()
      }));

      const configDocRef = doc(db, 'settings', 'config');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore operation timed out (5000ms)')), 5000)
      );

      try {
        const docSnap = await Promise.race([
          getDoc(configDocRef),
          timeoutPromise
        ]);

        const endTime = Date.now();
        const latency = endTime - startTime;

        if (!active) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          const fields = Object.keys(data || {});
          
          console.log('[FIRESTORE_CONFIG_FALLBACK] Success! Document exists. Fields:', fields);

          setConfigDiagnostic({
            status: 'success',
            collection: 'settings',
            documentId: 'config',
            exists: true,
            fields,
            latency,
            requestStartedAt: new Date(startTime).toISOString(),
            requestFinishedAt: new Date(endTime).toISOString()
          });

          const merged: AdminConfig = {
            ...DEFAULT_CONFIG,
            ...data,
          };
          setConfig(merged);
        } else {
          console.log('[FIRESTORE_CONFIG_FALLBACK] Document settings/config does not exist.');
          setConfigDiagnostic({
            status: 'success',
            collection: 'settings',
            documentId: 'config',
            exists: false,
            fields: [],
            latency,
            requestStartedAt: new Date(startTime).toISOString(),
            requestFinishedAt: new Date(endTime).toISOString()
          });
          setConfig(DEFAULT_CONFIG);
        }
      } catch (err: any) {
        const endTime = Date.now();
        const latency = endTime - startTime;
        console.error('[FIRESTORE_CONFIG_FALLBACK] Failed to read Firestore:', err);

        if (active) {
          setConfigDiagnostic({
            status: 'failed',
            collection: 'settings',
            documentId: 'config',
            exists: null,
            fields: [],
            error: err?.message || String(err),
            errorCode: err?.code || 'UNKNOWN_ERROR',
            latency,
            requestStartedAt: new Date(startTime).toISOString(),
            requestFinishedAt: new Date(endTime).toISOString()
          });
          setConfig(DEFAULT_CONFIG);
          showToast(`Firestore fallback error: ${err?.message || 'Check connection details'}`, 'error');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    initConfig();

    return () => {
      active = false;
    };
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
      localStorage.removeItem('adminSessionToken');
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
      case 'giveaways':
        return '🎁 Lucky Number Giveaways';
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
      case 'tasks':
        return '📑 App Tasks';
      case 'feedback_campaigns':
        return '⭐ Feedback Campaigns';
      case 'feedback_reviews':
        return 'Feedback Reviews';
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

  // 1. Reactive state to ensure any async or delayed Telegram script load triggers a clean React re-render
  const [isTelegramWebLoaded, setIsTelegramWebLoaded] = useState(() => {
    const tg = (window as any).Telegram?.WebApp;
    return Boolean(tg?.initData || tg?.initDataUnsafe?.user?.id);
  });

  useEffect(() => {
    // Disabled for Phase 2A isolation testing
    return;
  }, [isTelegramWebLoaded]);

  // Telegram WebApp Detection and Zero-Click Authentication
  const tgWebApp = (window as any).Telegram?.WebApp;
  const isTelegramWebApp = Boolean(tgWebApp && (tgWebApp.initData || tgWebApp.initDataUnsafe?.user?.id));
  const urlParams = new URLSearchParams(window.location.search);
  const tgStartParam = tgWebApp?.initDataUnsafe?.start_param || '';
  const startAppParam = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || urlParams.get('start') || tgStartParam || '';
  const liveEventIdParam = urlParams.get('liveEventId') || '';

  const hasTelegramParams =
    window.location.search.includes('tgWebApp') ||
    window.location.hash.includes('tgWebApp') ||
    window.location.search.includes('startapp') ||
    window.location.hash.includes('startapp') ||
    window.location.search.includes('liveEventId');

  const isTelegramInAppBrowser = /Telegram/i.test(navigator.userAgent);

  const isTelegramContext = isTelegramWebApp || isTelegramWebLoaded || hasTelegramParams || isTelegramInAppBrowser || startAppParam !== '' || liveEventIdParam !== '';

  const isLiveEventPayload =
    startAppParam.includes('live_event') ||
    startAppParam === 'live_event' ||
    startAppParam.includes('live') ||
    Boolean(liveEventIdParam);

  useEffect(() => {
    // Disabled for Phase 2A isolation testing
    return;
  }, [isTelegramContext, startAppParam, isLiveEventPayload, isTelegramWebApp, isTelegramWebLoaded]);

  // Check if URL is for the unauthenticated Runtime Debug Page
  const isDebugRoute = window.location.pathname.startsWith('/debug');

  if (isDebugRoute) {
    console.log('[ROUTING_DECISION] Rendering DebugView. Path:', window.location.pathname);
    return <DebugView />;
  }

  // Check if URL is for Referral Verification
  const isClaimRewardRoute = window.location.pathname.startsWith('/claim-reward');
  const isReferralVerifyRoute =
    window.location.pathname.startsWith('/referral-verify') ||
    (new URLSearchParams(window.location.search).has('token') && !isClaimRewardRoute);
  const isFeedbackRoute = window.location.pathname.startsWith('/feedback');
  const isContestRegistrationRoute = window.location.pathname.startsWith('/register-contest');

  const isUserAppRoute =
    isTelegramContext ||
    window.location.pathname.startsWith('/wallet') ||
    window.location.pathname.startsWith('/profile') ||
    window.location.pathname.startsWith('/task') ||
    window.location.pathname.startsWith('/tasks') ||
    window.location.pathname.startsWith('/withdraw') ||
    window.location.pathname.startsWith('/referral') ||
    window.location.pathname.startsWith('/giveaways');

  if (isUserAppRoute) {
    console.log(`[ROUTING_DECISION] Rendering UserAppView (Telegram Client Mini App) because Telegram context or a user-app path is active.`, {
      pathname: window.location.pathname,
      isTelegramContext,
      isTelegramWebApp,
      isTelegramWebLoaded,
    });
    return <UserAppView botUsername={config.botUsername || 'Roy_wallett_bot'} />;
  }

  if (isClaimRewardRoute) {
    console.log('[ROUTING_DECISION] Rendering ClaimRewardView.');
    return <ClaimRewardView botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isReferralVerifyRoute) {
    console.log('[ROUTING_DECISION] Rendering ReferralVerifyView.');
    return <ReferralVerifyView botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isFeedbackRoute) {
    const pathParts = window.location.pathname.split('/');
    const campaignId = pathParts[2] || '';
    console.log('[ROUTING_DECISION] Rendering FeedbackUserFlowView. CampaignId:', campaignId);
    return <FeedbackUserFlowView campaignId={campaignId} botUsername={config.botUsername || 'RoyShareWalletBot'} />;
  }

  if (isContestRegistrationRoute) {
    const pathParts = window.location.pathname.split('/');
    const rContestId = pathParts[2] || '';
    console.log('[ROUTING_DECISION] Rendering ContestRegistrationView. ContestId:', rContestId);
    return <ContestRegistrationView contestId={rContestId} botUsername={config.botUsername || 'RoyShareWalletBot'} />;
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
    console.log('[ROUTING_DECISION] AdminLoginView is selected.', {
      reason: 'User is NOT logged in as Admin, and we are NOT on a Telegram, public, or debug route.',
      pathname: window.location.pathname,
      isTelegramContext,
      isLiveEventPayload,
      startAppParam,
      liveEventIdParam,
      isLoggedIn
    });
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

              {activeTab === 'earning_bots' && (
                <EarningBotsView showToast={showToast} />
              )}

              {activeTab === 'earning_bot_withdrawals' && (
                <EarningBotWithdrawalsView showToast={showToast} />
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

              {activeTab === 'tasks' && (
                <TasksManagerView
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

              {activeTab === 'giveaways' && (
                <LuckyGiveawaysView
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

              {activeTab === 'security_review' && (
                <SecurityReviewView showToast={showToast} />
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
