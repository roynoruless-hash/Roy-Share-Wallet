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
import { SecurityView } from './components/SecurityView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { LogsView } from './components/LogsView';
import { UserManagementView } from './components/UserManagementView';
import { ReferralVerifyView } from './components/ReferralVerifyView';
import { AdminLoginView } from './components/AdminLoginView';
import { Toast, ToastMessage } from './components/Toast';
import { Loader2 } from 'lucide-react';

const SESSION_STORAGE_KEY = 'royshare_admin_session';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
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
        const timeoutMs = (DEFAULT_CONFIG.sessionTimeout || 60) * 60 * 1000; // 1 hour default
        if (session.loggedIn && Date.now() - session.lastActive < timeoutMs) {
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not read admin session', e);
    }
    return false;
  });

  const lastActivityRef = useRef<number>(Date.now());

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

  // Update session active timestamp
  const refreshSessionActivity = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (isLoggedIn) {
      try {
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ loggedIn: true, lastActive: now })
        );
      } catch (e) {
        // ignore
      }
    }
  };

  // User activity listeners to keep session active
  useEffect(() => {
    if (!isLoggedIn) return;

    let throttleTimer: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          refreshSessionActivity();
          throttleTimer = null;
        }, 10000); // throttle to once per 10s
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isLoggedIn]);

  // Session Inactivity Interval Check (1 hour / config.sessionTimeout)
  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = setInterval(() => {
      const timeoutMs = (config.sessionTimeout || 60) * 60 * 1000;
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        handleLogout('Session expired after 1 hour of inactivity.');
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isLoggedIn, config.sessionTimeout]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ loggedIn: true, lastActive: now })
      );
    } catch (e) {
      console.warn('Could not save login session:', e);
    }
  };

  const handleLogout = (reason?: string) => {
    setIsLoggedIn(false);
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

    if (!config.mainChannelUsername.trim()) {
      showToast('Validation Error: Main Channel Username cannot be empty.', 'error');
      setActiveTab('channel');
      return false;
    }

    if (!config.mainGroupUsername.trim()) {
      showToast('Validation Error: Main Group Username cannot be empty.', 'error');
      setActiveTab('channel');
      return false;
    }

    return true;
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
      console.error('Error saving configuration:', error);
      showToast(`Save Failed: ${error.message || 'Firestore write error'}. Existing values preserved.`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getActiveTabTitle = (): string => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'users':
        return 'User Management';
      case 'telegram':
        return 'Telegram Configuration';
      case 'channel':
        return 'Channel & Group';
      case 'wallet':
        return 'Wallet Settings';
      case 'withdrawal':
        return 'Withdrawal Settings';
      case 'referral':
        return 'Referral Settings';
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
  const isReferralVerifyRoute =
    window.location.pathname.startsWith('/referral-verify') ||
    new URLSearchParams(window.location.search).has('token');

  if (isReferralVerifyRoute) {
    return <ReferralVerifyView botUsername={config.botUsername || 'RoyShareWalletBot'} />;
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
        />

        {/* Dynamic Body Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardView config={config} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'users' && (
            <UserManagementView config={config} showToast={showToast} />
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
            />
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
        </main>
      </div>

      {/* Global Notification Toast */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
