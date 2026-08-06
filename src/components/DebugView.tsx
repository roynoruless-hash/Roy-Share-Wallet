import React, { useEffect, useState } from 'react';
import { Loader2, Copy, Check, Server, Shield, Monitor, RefreshCw } from 'lucide-react';

interface ServerDebugInfo {
  PUBLIC_APP_URL: string;
  APP_URL: string;
  serverHostname: string;
  hostHeader: string;
  environment: string;
}

export function DebugView() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerDebugInfo | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectHistory, setRedirectHistory] = useState<string[]>([]);

  // Capture location details immediately on mount
  const clientHref = window.location.href;
  const clientOrigin = window.location.origin;
  const clientHostname = window.location.hostname;
  const clientPathname = window.location.pathname;
  const referrer = document.referrer || 'None (Direct)';
  const userAgent = navigator.userAgent;

  // Telegram Specifics
  const tgWebApp = (window as any).Telegram?.WebApp;
  const tgExists = Boolean(tgWebApp);
  const initDataPresent = Boolean(tgWebApp?.initData);
  const tgUser = tgWebApp?.initDataUnsafe?.user;
  const tgUserId = tgUser?.id ? String(tgUser.id) : 'None';
  const tgUserName = tgUser?.username || '';
  
  // Startapp param detection
  const urlParams = new URLSearchParams(window.location.search);
  const urlStartApp = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || '';
  const tgStartApp = tgWebApp?.initDataUnsafe?.start_param || '';
  const finalStartApp = urlStartApp || tgStartApp || 'None';

  // Redirect Tracking
  useEffect(() => {
    // Collect from performance navigation API
    const navEntries = window.performance.getEntriesByType('navigation');
    const logs: string[] = [];
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      logs.push(`Navigation Type: ${nav.type}`);
      logs.push(`Redirect Count: ${nav.redirectCount}`);
      if (nav.redirectCount > 0) {
        logs.push('Detected client-side HTTP/HTTPS redirects during this session.');
      }
    } else {
      logs.push('Performance navigation API not fully populated by browser.');
    }

    // Grab persistent history from sessionStorage
    try {
      const stored = sessionStorage.getItem('roy_debug_redirect_history');
      let arr: string[] = stored ? JSON.parse(stored) : [];
      // Prevent infinite duplication, append current URL if different
      if (arr.length === 0 || arr[arr.length - 1] !== clientHref) {
        arr.push(`${new Date().toISOString().split('T')[1].slice(0, 8)} -> ${clientHref}`);
        sessionStorage.setItem('roy_debug_redirect_history', JSON.stringify(arr.slice(-10))); // keep last 10
      }
      setRedirectHistory(arr);
    } catch (e) {
      logs.push(`Failed to read sessionStorage history: ${(e as Error).message}`);
    }
  }, [clientHref]);

  // Fetch Server-Side configurations
  const fetchServerInfo = async () => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch('/api/debug-info');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setServerInfo(data);
    } catch (err: any) {
      console.error('Failed to fetch backend debug info:', err);
      setServerError(err.message || 'Unknown server error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerInfo();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isOnRender = clientHostname.includes('onrender.com');
  const isAisDev = clientHostname.includes('ais-dev-');
  const isAisPre = clientHostname.includes('ais-pre-');

  let activeUrlClassification = 'Other / Unknown';
  if (isOnRender) activeUrlClassification = 'https://roy-share-wallet.onrender.com (OnRender Deployed)';
  else if (isAisDev) activeUrlClassification = 'https://ais-dev-... (AI Studio Development App)';
  else if (isAisPre) activeUrlClassification = 'https://ais-pre-... (AI Studio Shared App)';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 flex flex-col justify-start items-center">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Header Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-1 uppercase tracking-wider">
              <Shield className="w-4 h-4" /> Live Diagnostics Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Runtime Environment Debugger
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Real-time browser, client context, and backend environment analytics.
            </p>
          </div>
          <button
            onClick={fetchServerInfo}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Section: Environment Verification */}
        <div className="bg-slate-900 border border-rose-950/40 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-rose-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            🎯 Active Deployment Verification
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${isOnRender ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950/40 border-slate-800/60 opacity-60'}`}>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Render Production</span>
              <span className="text-sm font-bold mt-2 break-all text-white">roy-share-wallet.onrender.com</span>
              <span className={`text-[10px] inline-block px-2 py-0.5 rounded mt-3 self-start ${isOnRender ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                {isOnRender ? 'ACTIVE CURRENTLY' : 'INACTIVE'}
              </span>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between ${isAisDev ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/40 border-slate-800/60 opacity-60'}`}>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">AI Studio Dev App</span>
              <span className="text-sm font-bold mt-2 break-all text-white">ais-dev-...asia-southeast1.run.app</span>
              <span className={`text-[10px] inline-block px-2 py-0.5 rounded mt-3 self-start ${isAisDev ? 'bg-amber-500/20 text-amber-400 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                {isAisDev ? 'ACTIVE CURRENTLY' : 'INACTIVE'}
              </span>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between ${isAisPre ? 'bg-sky-950/20 border-sky-500/30' : 'bg-slate-950/40 border-slate-800/60 opacity-60'}`}>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">AI Studio Shared App</span>
              <span className="text-sm font-bold mt-2 break-all text-white">ais-pre-...asia-southeast1.run.app</span>
              <span className={`text-[10px] inline-block px-2 py-0.5 rounded mt-3 self-start ${isAisPre ? 'bg-sky-500/20 text-sky-400 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                {isAisPre ? 'ACTIVE CURRENTLY' : 'INACTIVE'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Current Domain Verification Conclusion</span>
              <span className="text-sm font-extrabold text-rose-300 mt-1 break-all block sm:inline">
                {activeUrlClassification}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(clientHostname, 'conclusion')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shrink-0"
              title="Copy Hostname"
            >
              {copiedKey === 'conclusion' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Section: Client-Side Browser Context */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Monitor className="w-5 h-5 text-sky-400" /> Client Browser & Window Details
          </h2>
          
          <div className="space-y-3">
            {[
              { label: 'window.location.href', val: clientHref, key: 'href' },
              { label: 'window.location.origin', val: clientOrigin, key: 'origin' },
              { label: 'window.location.hostname', val: clientHostname, key: 'hostname' },
              { label: 'window.location.pathname', val: clientPathname, key: 'pathname' },
              { label: 'document.referrer', val: referrer, key: 'referrer' },
              { label: 'navigator.userAgent', val: userAgent, key: 'ua' }
            ].map((item) => (
              <div key={item.key} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-slate-950/45 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-mono text-slate-400 block font-bold">{item.label}</span>
                  <span className="text-sm font-mono text-sky-300 break-all mt-1 block">{item.val}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(item.val, item.key)}
                  className="p-1.5 sm:p-2 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shrink-0 self-end sm:self-center"
                >
                  {copiedKey === item.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Telegram WebApp Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            ✈ Telegram Mini App Context
          </h2>
          
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-950/45 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">window.Telegram.WebApp exists?</span>
                  <span className={`text-sm font-bold block mt-1 ${tgExists ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tgExists ? 'YES (Telegram Context)' : 'NO (Normal Browser)'}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-950/45 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">initData Present?</span>
                  <span className={`text-sm font-bold block mt-1 ${initDataPresent ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {initDataPresent ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            </div>

            {[
              { label: 'Telegram User ID', val: tgUserId, key: 'tg_id' },
              { label: 'Telegram Username', val: tgUserName || 'None', key: 'tg_user' },
              { label: 'startapp / start_param Parameter', val: finalStartApp, key: 'tg_start' },
              { label: 'Full Telegram WebApp URL opened', val: clientHref, key: 'tg_full_url' }
            ].map((item) => (
              <div key={item.key} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-slate-950/45 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-slate-400 block font-semibold">{item.label}</span>
                  <span className="text-sm font-mono text-purple-300 break-all mt-1 block">{item.val}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(item.val, item.key)}
                  className="p-1.5 sm:p-2 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shrink-0 self-end sm:self-center"
                >
                  {copiedKey === item.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Server-Side Backend Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Server className="w-5 h-5 text-emerald-400" /> Server-Side Environment Variables
          </h2>

          {loading ? (
            <div className="flex items-center justify-center p-8 space-x-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Fetching backend server variables...</span>
            </div>
          ) : serverError ? (
            <div className="p-4 bg-rose-950/20 border border-rose-500/30 text-rose-300 rounded-xl text-sm">
              ⚠ <strong>Backend connection failed:</strong> {serverError}
            </div>
          ) : serverInfo ? (
            <div className="space-y-3">
              {[
                { label: 'PUBLIC_APP_URL', val: serverInfo.PUBLIC_APP_URL || 'NOT CONFIGURED (CRITICAL FAIL)', key: 's_pub', critical: !serverInfo.PUBLIC_APP_URL },
                { label: 'APP_URL', val: serverInfo.APP_URL || 'None', key: 's_app' },
                { label: 'req.hostname (from Express)', val: serverInfo.serverHostname, key: 's_host' },
                { label: 'req.headers.host (from Express)', val: serverInfo.hostHeader, key: 's_hdr' },
                { label: 'NODE_ENV', val: serverInfo.environment, key: 's_env' }
              ].map((item) => (
                <div key={item.key} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 rounded-xl border transition-colors ${item.critical ? 'bg-rose-950/15 border-rose-500/20 hover:border-rose-500/40' : 'bg-slate-950/45 border-slate-800/80 hover:border-slate-700/80'}`}>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-slate-400 block font-semibold">{item.label}</span>
                    <span className={`text-sm font-mono break-all mt-1 block ${item.critical ? 'text-rose-400 font-bold' : 'text-emerald-300'}`}>
                      {item.val}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.val, item.key)}
                    className="p-1.5 sm:p-2 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shrink-0 self-end sm:self-center"
                  >
                    {copiedKey === item.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Section: Session Navigation & Redirect Tracker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            🔄 Browser Navigation Redirect History
          </h2>
          
          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 block font-bold uppercase mb-2">Redirect Log History in Session Storage:</span>
            {redirectHistory.length > 0 ? (
              <div className="font-mono text-xs text-slate-300 space-y-1 divide-y divide-slate-900">
                {redirectHistory.map((log, index) => (
                  <div key={index} className="pt-1 first:pt-0 break-all">
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-500 italic font-mono">No navigation logs found.</span>
            )}
          </div>
          
          <div className="text-xs text-slate-500 leading-relaxed">
            Note: This list records successive browser paths navigated within this session context. If the browser redirects from Render to AI Studio or visa versa, a new session starts unless persistent cookies or storage spans domains.
          </div>
        </div>

      </div>
    </div>
  );
}
