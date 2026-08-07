import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Lock,
  CheckCircle,
  X,
  Loader2,
  CheckSquare,
  Square,
  ShieldCheck,
  RefreshCw,
  Database,
  Info,
} from 'lucide-react';

export interface BulkDeleteOptions {
  users: boolean;
  wallet: boolean;
  giveaways: boolean;
  referrals: boolean;
  notifications: boolean;
  taskProgress: boolean;
  userSessions: boolean;
  deviceFingerprints: boolean;
  withdraws: boolean;
}

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'DELETE_ALL_USERS' | 'RESET_PLATFORM';
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  actionType,
  onSuccess,
  showToast,
}) => {
  const isResetMode = actionType === 'RESET_PLATFORM';
  const expectedConfirmationText = isResetMode ? 'RESET PLATFORM' : 'DELETE ALL USERS';

  // Step state: 1 = Options & Auth, 2 = Execution Progress, 3 = Summary
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Options checklist
  const [options, setOptions] = useState<BulkDeleteOptions>({
    users: true,
    wallet: true,
    giveaways: true,
    referrals: true,
    notifications: true,
    taskProgress: true,
    userSessions: true,
    deviceFingerprints: true,
    withdraws: true,
  });

  // Inputs
  const [confirmInput, setConfirmInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [superAdminVerified, setSuperAdminVerified] = useState(true);

  // Progress tracking
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentCollection, setCurrentCollection] = useState('');
  const [deletedCountSoFar, setDeletedCountSoFar] = useState(0);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);

  // Completion Summary
  const [summaryData, setSummaryData] = useState<{
    grandTotalDeleted: number;
    collectionCounts: Record<string, number>;
    auditLogId: string;
    timestamp: string;
  } | null>(null);

  if (!isOpen) return null;

  // Toggle option check
  const toggleOption = (key: keyof BulkDeleteOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllOptions = () => {
    setOptions({
      users: true,
      wallet: true,
      giveaways: true,
      referrals: true,
      notifications: true,
      taskProgress: true,
      userSessions: true,
      deviceFingerprints: true,
      withdraws: true,
    });
  };

  const deselectAllOptions = () => {
    setOptions({
      users: false,
      wallet: false,
      giveaways: false,
      referrals: false,
      notifications: false,
      taskProgress: false,
      userSessions: false,
      deviceFingerprints: false,
      withdraws: false,
    });
  };

  const isConfirmationValid = confirmInput.trim() === expectedConfirmationText;
  const isAnyOptionSelected = Object.values(options).some(Boolean);
  const canExecute = isConfirmationValid && isAnyOptionSelected && superAdminVerified && !isExecuting;

  // Get Auth Token
  const getAdminToken = () => {
    try {
      const rawSession =
        localStorage.getItem('royshare_admin_session') ||
        sessionStorage.getItem('royshare_admin_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        return parsed.sessionToken || '';
      }
    } catch (e) {}
    return '';
  };

  // Handle Deletion Execution
  const handleExecuteBulkDelete = async () => {
    if (!canExecute) return;

    setStep(2);
    setIsExecuting(true);
    setProgressPercent(5);
    setProgressLogs(['Initializing security audit logs & verifying Super Admin session...']);
    setDeletedCountSoFar(0);

    const token = getAdminToken();

    try {
      setProgressLogs((prev) => [...prev, `Action: ${actionType} validated. Preparing batch writer...`]);
      setProgressPercent(15);

      const res = await fetch('/api/admin/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
          'x-admin-session-token': token,
        },
        body: JSON.stringify({
          actionType,
          confirmationText: confirmInput.trim(),
          adminPassword: adminPasswordInput.trim(),
          options,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setProgressPercent(100);
        setCurrentCollection('All Selected Collections Purged');
        setDeletedCountSoFar(data.grandTotalDeleted || 0);

        const logsList = Object.entries(data.collectionCounts || {}).map(
          ([col, count]) => `✔ Collection '${col}': ${count} document(s) permanently deleted.`
        );

        setProgressLogs((prev) => [
          ...prev,
          ...logsList,
          `✅ Audit Log Created ID: ${data.auditLogId}`,
          `🎉 Bulk Deletion completed successfully!`,
        ]);

        setSummaryData({
          grandTotalDeleted: data.grandTotalDeleted || 0,
          collectionCounts: data.collectionCounts || {},
          auditLogId: data.auditLogId || 'AUDIT_LOG_SUCCESS',
          timestamp: data.timestamp || new Date().toISOString(),
        });

        setIsExecuting(false);
        setStep(3);
        showToast(
          isResetMode
            ? 'Platform reset successfully completed!'
            : 'Bulk user deletion completed successfully!',
          'success'
        );
      } else {
        setIsExecuting(false);
        setStep(1);
        showToast(data.error || 'Bulk deletion failed. Please check password and retry.', 'error');
      }
    } catch (err: any) {
      setIsExecuting(false);
      setStep(1);
      showToast(`Execution Error: ${err.message}`, 'error');
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
    // Reset state
    setStep(1);
    setConfirmInput('');
    setAdminPasswordInput('');
    setSummaryData(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between shrink-0 ${
          isResetMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${
              isResetMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}>
              {isResetMode ? <RefreshCw className="w-6 h-6 animate-spin-slow" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                {isResetMode ? '⚠ Reset Platform System' : '⚠ Delete All Users System'}
              </h2>
              <p className="text-xs text-slate-400">
                {isResetMode
                  ? 'Purge user data and reset platform state while preserving admin config'
                  : 'Permanently remove user accounts, transactions, and user collections'}
              </p>
            </div>
          </div>
          {!isExecuting && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* STEP 1: OPTIONS & AUTHENTICATION */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Warning Notice */}
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs leading-relaxed flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-200 block mb-1">DANGER: THIS ACTION IS PERMANENT & IRREVERSIBLE</span>
                  Selected data collections will be permanently deleted using Firestore Batch Operations. Ensure you have created a system backup before proceeding.
                </div>
              </div>

              {/* Protected Collections Callout */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Protected System Collections (Will NEVER be deleted)</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {['Admin Accounts', 'Admin Settings / Config', 'Telegram Bot Credentials', 'Firebase / Firestore Rules', 'Audit Logs & Admin Logs'].map((item) => (
                    <span key={item} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Data Category Options Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    Select Data Collections To Purge
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllOptions}
                      className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded hover:bg-sky-500/10 transition"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={deselectAllOptions}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-800 transition"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: 'users', label: 'User Accounts & Delete Logs', countLabel: 'users, userDeleteLogs' },
                    { key: 'wallet', label: 'Wallet Transactions & Ledger', countLabel: 'transactions, walletTransactions' },
                    { key: 'giveaways', label: 'Giveaways, Contests & Entries', countLabel: 'giveaways, contestants, entries' },
                    { key: 'referrals', label: 'Referrals & Milestone Tokens', countLabel: 'referralTokens, referralLogs' },
                    { key: 'notifications', label: 'Notifications & Broadcasts', countLabel: 'notifications, broadcasts' },
                    { key: 'taskProgress', label: 'Task Progress & System Logs', countLabel: 'tasks, taskProgress, logs' },
                    { key: 'userSessions', label: 'User Sessions & OTP Records', countLabel: 'sessions, otps' },
                    { key: 'deviceFingerprints', label: 'Device Fingerprints & Bans', countLabel: 'deviceFingerprints, bannedDevices' },
                    { key: 'withdraws', label: 'Withdrawal Requests & History', countLabel: 'withdrawals, withdrawRequests' },
                  ].map((item) => {
                    const isChecked = options[item.key as keyof BulkDeleteOptions];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleOption(item.key as keyof BulkDeleteOptions)}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                          isChecked
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-white">{item.label}</div>
                          <div className="text-[10px] text-slate-500">{item.countLabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Confirmation Verification Section */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    1. Type Confirmation String
                  </label>
                  <p className="text-[11px] text-slate-400">
                    To prevent accidental deletion, type <code className="px-1.5 py-0.5 rounded bg-slate-800 text-rose-400 font-bold">{expectedConfirmationText}</code> below:
                  </p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={`Type ${expectedConfirmationText} to continue`}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    2. Admin Security Verification (Optional)
                  </label>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter Admin Password or Security Key"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <ShieldCheck className="w-4 h-4 text-sky-400" /> Super Admin Credentials Active
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={superAdminVerified}
                      onChange={(e) => setSuperAdminVerified(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
                    />
                    <span>Confirm Super Admin Authorization</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: EXECUTION PROGRESS */}
          {step === 2 && (
            <div className="space-y-6 py-6 text-center">
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Executing Bulk Deletion Operations...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Processing chunked Firestore batch writes. Please do not close or refresh this tab until completion.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">{currentCollection || 'Processing Firestore collections...'}</span>
                  <span className="text-rose-400 font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-amber-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Log Activity Console */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-1.5 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                <div className="text-slate-500 border-b border-slate-800/80 pb-1 mb-2 font-sans font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" /> Live Audit Log Stream
                </div>
                {progressLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETION SUMMARY */}
          {step === 3 && summaryData && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {isResetMode ? 'Platform Reset Complete!' : 'Delete All Users Complete!'}
                </h3>
                <p className="text-xs text-emerald-300">
                  All requested user data collections have been safely purged and logged.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Deleted Docs</div>
                  <div className="text-xl font-black text-rose-400 font-mono">
                    {summaryData.grandTotalDeleted.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Collections Cleared</div>
                  <div className="text-xl font-black text-sky-400 font-mono">
                    {Object.keys(summaryData.collectionCounts).length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Audit Reference ID</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 truncate">
                    {summaryData.auditLogId}
                  </div>
                </div>
              </div>

              {/* Collection breakdown list */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-slate-300 pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>Purged Collections Breakdown</span>
                  <span className="text-slate-500 font-mono text-[10px]">{summaryData.timestamp}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto">
                  {Object.entries(summaryData.collectionCounts).map(([col, count]) => (
                    <div key={col} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                      <span className="text-slate-300 font-mono">{col}</span>
                      <span className="font-bold text-rose-400 font-mono">{count} docs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteBulkDelete}
                disabled={!canExecute}
                className={`px-6 py-3 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-lg ${
                  canExecute
                    ? isResetMode
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {isResetMode ? 'Confirm & Execute Platform Reset' : 'Confirm & Permanently Delete All Users'}
                </span>
              </button>
            </>
          )}

          {step === 2 && (
            <div className="w-full text-center text-xs text-slate-400 py-1 font-mono">
              ⚡ Safe Batch Execution in progress... Please wait.
            </div>
          )}

          {step === 3 && (
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Done & Refresh User Management</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
