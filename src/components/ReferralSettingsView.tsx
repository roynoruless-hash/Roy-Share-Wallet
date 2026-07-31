import React, { useState, useEffect } from 'react';
import { Share2, DollarSign, ShieldAlert, UserX, ToggleLeft, ToggleRight, Save, ShieldCheck, RefreshCw, Smartphone, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { AdminConfig, ReferralVerificationToken } from '../types';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ReferralSettingsViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const ReferralSettingsView: React.FC<ReferralSettingsViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
}) => {
  const [tokens, setTokens] = useState<ReferralVerificationToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState<boolean>(false);

  const fetchReferralTokens = async () => {
    setLoadingTokens(true);
    try {
      const q = query(collection(db, 'referralTokens'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      const items: ReferralVerificationToken[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          token: d.token,
          referrerUid: d.referrerUid,
          referredUid: d.referredUid,
          referredTelegramId: d.referredTelegramId,
          referredName: d.referredName,
          deviceFingerprint: d.deviceFingerprint,
          ipAddress: d.ipAddress,
          userAgent: d.userAgent,
          status: d.status || 'pending',
          rejectReason: d.rejectReason,
          createdAt: d.createdAt,
          verifiedAt: d.verifiedAt,
        });
      });
      setTokens(items);
    } catch (err) {
      console.warn('Error fetching referral verification tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    fetchReferralTokens();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Referral Engine & Anti Self-Referral System</h2>
            <p className="text-xs text-slate-400">
              Configure reward rates and monitor device fingerprint anti-fraud verifications.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Master Referral Enable Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Referral Program Status</p>
              <p className="text-[11px] text-slate-400">Enable or pause viral referral links</p>
            </div>
            <button
              type="button"
              id="referral-enable-toggle"
              onClick={() => updateConfig({ referralEnable: !config.referralEnable })}
              className={`p-1.5 rounded-lg transition ${
                config.referralEnable ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.referralEnable ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Reward Per Referral */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Reward Per Referral (₹)</span>
              </span>
            </label>
            <input
              type="number"
              id="reward-per-referral-input"
              value={config.rewardPerReferral}
              onChange={(e) =>
                updateConfig({ rewardPerReferral: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              min={0}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
            />
          </div>
        </div>

        {/* Anti-Fraud Protections Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Anti-Abuse & Device Fingerprint Protection</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Self Referral Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-400" />
                  <span>Self Referral Protection</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Block users from using their own referral link
                </p>
              </div>
              <button
                type="button"
                id="self-referral-toggle"
                onClick={() =>
                  updateConfig({ selfReferralProtection: !config.selfReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.selfReferralProtection ? 'text-sky-400' : 'text-slate-600'
                }`}
              >
                {config.selfReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>

            {/* Device Fingerprint Protection */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                  <span>Device Fingerprint Protection</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Require in-app browser device verification link
                </p>
              </div>
              <button
                type="button"
                id="duplicate-referral-toggle"
                onClick={() =>
                  updateConfig({ duplicateReferralProtection: !config.duplicateReferralProtection })
                }
                className={`p-1.5 rounded-lg transition ${
                  config.duplicateReferralProtection ? 'text-sky-400' : 'text-slate-600'
                }`}
              >
                {config.duplicateReferralProtection ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            id="referral-save-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Anti Self-Referral Verification Logs */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Recent Referral Verifications & Anti-Fraud Logs</h3>
          </div>
          <button
            type="button"
            onClick={fetchReferralTokens}
            disabled={loadingTokens}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTokens ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {tokens.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
            No referral verifications recorded yet. Pending tokens will appear here as users register via referral links.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Token</th>
                  <th className="py-2.5 px-3">Referrer UID</th>
                  <th className="py-2.5 px-3">Referred User</th>
                  <th className="py-2.5 px-3">Device Fingerprint</th>
                  <th className="py-2.5 px-3">Created / Verified At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {tokens.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      {item.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20" title={item.rejectReason}>
                          <XCircle className="w-3 h-3" /> REJECTED
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px] truncate max-w-[120px]">
                      {item.token}
                    </td>
                    <td className="py-3 px-3 font-mono text-indigo-400 font-semibold">
                      #{item.referrerUid}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{item.referredName || 'User'}</div>
                      <div className="font-mono text-[10px] text-slate-500">UID: #{item.referredUid}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                      {item.deviceFingerprint ? item.deviceFingerprint : '—'}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500">
                      {new Date(item.verifiedAt || item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

