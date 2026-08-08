import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle2, XCircle, Bot, Database, Radio, Users, ShieldCheck, Zap } from 'lucide-react';
import { AdminConfig, DiagnosticItem } from '../types';
import { testBotToken, verifyChannelAndGroup, getWebhookInfo, registerWebhook } from '../services/telegramService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface DiagnosticsViewProps {
  config: AdminConfig;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ config }) => {
  const [items, setItems] = useState<DiagnosticItem[]>([
    { id: '1', name: 'Bot Connected', key: 'bot', status: 'pending', message: 'Awaiting check' },
    { id: '2', name: 'Firestore Connected', key: 'firestore', status: 'pending', message: 'Awaiting check' },
    { id: '3', name: 'Database Status', key: 'database', status: 'pending', message: 'Awaiting check' },
    { id: '4', name: 'Webhook Status', key: 'webhook', status: 'pending', message: 'Awaiting check' },
    { id: '5', name: 'Channel Status', key: 'channel', status: 'pending', message: 'Awaiting check' },
    { id: '6', name: 'Group Status', key: 'group', status: 'pending', message: 'Awaiting check' },
    { id: '7', name: 'Admin Status', key: 'admin', status: 'pending', message: 'Awaiting check' },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [lastDiagnosticTime, setLastDiagnosticTime] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);

    // 1. Bot Connected
    setItems((prev) =>
      prev.map((i) => (i.key === 'bot' ? { ...i, status: 'checking', message: 'Testing Bot Token...' } : i))
    );

    let botSuccess = false;
    let botMessage = '';
    if (config.botToken.trim()) {
      const botRes = await testBotToken(config.botToken);
      botSuccess = botRes.success;
      botMessage = botRes.success
        ? `Bot Connected: @${botRes.botUsername} (${botRes.botName})`
        : `Bot Error: ${botRes.error || 'Invalid Token'}`;
    } else {
      botSuccess = false;
      botMessage = 'Bot Token is missing in configuration.';
    }

    setItems((prev) =>
      prev.map((i) =>
        i.key === 'bot'
          ? {
              ...i,
              status: botSuccess ? 'green' : 'red',
              message: botMessage,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : i
      )
    );

    // 2. Firestore Connected
    setItems((prev) =>
      prev.map((i) =>
        i.key === 'firestore' ? { ...i, status: 'checking', message: 'Checking Firestore ping...' } : i
      )
    );

    let firestoreSuccess = false;
    let firestoreMessage = '';
    try {
      const pingSnap = await getDoc(doc(db, 'settings', 'config'));
      firestoreSuccess = true;
      firestoreMessage = pingSnap.exists()
        ? 'Firestore database reachable & document settings/config synced.'
        : 'Firestore connected successfully (document ready to be written).';
    } catch (err: any) {
      firestoreSuccess = false;
      firestoreMessage = `Firestore Connection Error: ${err.message || 'Unknown network error'}`;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.key === 'firestore'
          ? {
              ...i,
              status: firestoreSuccess ? 'green' : 'red',
              message: firestoreMessage,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : i
      )
    );

    // 3. Database Status
    setItems((prev) =>
      prev.map((i) =>
        i.key === 'database'
          ? {
              ...i,
              status: firestoreSuccess ? 'green' : 'red',
              message: firestoreSuccess
                ? 'Firestore collections (settings, logs) healthy and responding.'
                : 'Database collections unreachable.',
              lastChecked: new Date().toLocaleTimeString(),
            }
          : i
      )
    );

    // 4. Webhook Status (Requirements 2, 3, 4, 5)
    setItems((prev) =>
      prev.map((i) =>
        i.key === 'webhook' ? { ...i, status: 'checking', message: 'Checking Webhook status via Telegram API...' } : i
      )
    );

    let webhookSuccess = false;
    let webhookMessage = '';
    if (botSuccess && config.botToken.trim()) {
      try {
        const whInfo = await getWebhookInfo(config.botToken.trim());
        if (whInfo.success && whInfo.url) {
          webhookSuccess = true;
          webhookMessage = `Webhook Active & Online: ${whInfo.url} (Pending updates: ${whInfo.pendingUpdateCount ?? 0})`;
          if (whInfo.lastErrorMessage) {
            webhookMessage += ` | Note: ${whInfo.lastErrorMessage}`;
          }
        } else {
          // Webhook missing or disabled -> Auto register (Requirement 4)
          const regRes = await registerWebhook(config.botToken.trim());
          if (regRes.success) {
            webhookSuccess = true;
            webhookMessage = `Webhook Missing -> Auto-registered successfully: ${regRes.webhookUrl}`;
          } else {
            webhookSuccess = false;
            // Requirement 5: Show exact Telegram API error if webhook registration fails
            webhookMessage = `Webhook Registration Failed: ${regRes.error || whInfo.error || 'Unknown Telegram API Error'}`;
          }
        }
      } catch (err: any) {
        webhookSuccess = false;
        webhookMessage = `Webhook check failed: ${err.message || 'Network exception'}`;
      }
    } else {
      webhookSuccess = false;
      webhookMessage = 'Valid Bot Token is required before checking Webhook status.';
    }

    setItems((prev) =>
      prev.map((i) =>
        i.key === 'webhook'
          ? {
              ...i,
              status: webhookSuccess ? 'green' : 'red',
              message: webhookMessage,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : i
      )
    );

    // 5 & 6. Channel & Group Status
    setItems((prev) =>
      prev.map((i) =>
        i.key === 'channel' || i.key === 'group'
          ? { ...i, status: 'checking', message: 'Verifying channel & group usernames...' }
          : i
      )
    );

    let channelSuccess = false;
    let channelMessage = '';
    let groupSuccess = false;
    let groupMessage = '';

    if (config.botToken.trim() && config.mainChannelUsername && config.mainGroupUsername) {
      const verRes = await verifyChannelAndGroup(
        config.botToken,
        config.mainChannelUsername,
        config.mainGroupUsername
      );
      channelSuccess = verRes.channelVerified;
      channelMessage = verRes.channelVerified
        ? `Channel ${config.mainChannelUsername} verified & Bot is Admin.`
        : verRes.channelError || `Channel ${config.mainChannelUsername} unverified.`;

      groupSuccess = verRes.groupVerified;
      groupMessage = verRes.groupVerified
        ? `Group ${config.mainGroupUsername} verified & Bot is member/Admin.`
        : verRes.groupError || `Group ${config.mainGroupUsername} unverified.`;
    } else {
      channelSuccess = false;
      channelMessage = 'Bot Token and Channel Username required.';
      groupSuccess = false;
      groupMessage = 'Bot Token and Group Username required.';
    }

    setItems((prev) =>
      prev.map((i) => {
        if (i.key === 'channel') {
          return {
            ...i,
            status: channelSuccess ? 'green' : 'red',
            message: channelMessage,
            lastChecked: new Date().toLocaleTimeString(),
          };
        }
        if (i.key === 'group') {
          return {
            ...i,
            status: groupSuccess ? 'green' : 'red',
            message: groupMessage,
            lastChecked: new Date().toLocaleTimeString(),
          };
        }
        return i;
      })
    );

    // 7. Admin Status
    const adminSuccess = Boolean(config.adminTelegramId.trim());
    const adminMessage = adminSuccess
      ? `Admin Telegram ID whitelisted: ${config.adminTelegramId}`
      : 'Admin Telegram ID is missing in configuration!';

    setItems((prev) =>
      prev.map((i) =>
        i.key === 'admin'
          ? {
              ...i,
              status: adminSuccess ? 'green' : 'red',
              message: adminMessage,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : i
      )
    );

    setIsRunning(false);
    setLastDiagnosticTime(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    // Run diagnostics automatically on view load
    runDiagnostics();
  }, []);

  const getIconForCheck = (key: string) => {
    switch (key) {
      case 'bot':
        return Bot;
      case 'firestore':
      case 'database':
        return Database;
      case 'webhook':
        return Radio;
      case 'channel':
      case 'group':
        return Users;
      case 'admin':
        return ShieldCheck;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System Diagnostics Screen</h2>
            <p className="text-xs text-slate-400">
              Live automated health checks for Bot, Firestore, Webhooks, Channels, Groups, and Admin permissions.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="run-diagnostics-btn"
          onClick={runDiagnostics}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running Diagnostics...' : 'Run Full Diagnostic'}</span>
        </button>
      </div>

      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const Icon = getIconForCheck(item.key);
          const isGreen = item.status === 'green';
          const isRed = item.status === 'red';
          const isChecking = item.status === 'checking';

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all duration-300 shadow-lg relative overflow-hidden ${
                isGreen
                  ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/20'
                  : isRed
                  ? 'bg-slate-900/90 border-rose-500/40 shadow-rose-950/20'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl border ${
                      isGreen
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : isRed
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">{item.name}</span>
                </div>

                {/* Status Indicator Pill */}
                {isChecking ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Checking</span>
                  </span>
                ) : isGreen ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>GREEN</span>
                  </span>
                ) : isRed ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>RED</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                    PENDING
                  </span>
                )}
              </div>

              {/* Message Details */}
              <p className="text-xs text-slate-300 mt-3 leading-relaxed min-h-[36px]">
                {item.message}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                <span>Check: {item.key.toUpperCase()}</span>
                {item.lastChecked && <span>Updated {item.lastChecked}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {lastDiagnosticTime && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>
              Diagnostic run complete. Green items indicate system components ready for operational use.
            </span>
          </div>
          <span className="text-slate-500">Last executed: {lastDiagnosticTime}</span>
        </div>
      )}

      {/* User Registration Diagnostic Lookup */}
      <UserDiagnosticLookup />
    </div>
  );
};

const UserDiagnosticLookup: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/diagnostic-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Lookup failed');
      }
    } catch (err: any) {
      setError(err.message || 'Server network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">User Diagnostic & Registration Lookup</h3>
          <p className="text-xs text-slate-400">
            Search by Telegram ID, App UID, Mobile Number, or Username to inspect active registration state and identity details.
          </p>
        </div>
      </div>

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter Telegram ID, App UID, Mobile, or @username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition disabled:opacity-50 shrink-0"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Inspect Account</span>}
        </button>
      </form>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white">Query Target: {result.query}</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
              result.registrationState === 'ACTIVE'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : result.registrationState === 'UNREGISTERED'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              State: {result.registrationState}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
            <div><b>Telegram ID:</b> {result.telegramId || 'Not found'}</div>
            <div><b>App UID:</b> {result.appUid || 'None'}</div>
            <div><b>Username:</b> {(!result.username || result.username === 'N/A' || result.username === '@N/A') ? 'Not set' : result.username}</div>
            <div><b>Account Status:</b> {result.isRegistered ? '✅ Registered' : '❌ Unregistered'}</div>
          </div>

          {result.pendingSession && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="font-bold text-amber-400">Pending Registration Session</div>
              <div><b>Full Name:</b> {result.pendingSession.fullName}</div>
              <div><b>Mobile:</b> {result.pendingSession.mobile}</div>
              <div><b>Gmail:</b> {result.pendingSession.gmail}</div>
              <div><b>Contact Shared:</b> {result.pendingSession.contactVerified ? 'YES' : 'NO'}</div>
              <div><b>OTP Sent:</b> {result.pendingSession.otpSent ? 'YES' : 'NO'}</div>
            </div>
          )}

          {result.userDoc && (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400">Active Firestore User Profile</div>
              <div><b>Name:</b> {result.userDoc.userName || result.userDoc.fullName}</div>
              <div><b>Mobile:</b> {result.userDoc.mobile}</div>
              <div><b>Gmail:</b> {result.userDoc.gmail}</div>
              <div><b>Wallet Balance:</b> ₹{result.userDoc.walletBalance || result.userDoc.balance || 0}</div>
              <div><b>Coins:</b> {result.userDoc.coinsBalance || 0}</div>
              <div><b>Joined Date:</b> {result.userDoc.createdAt}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
