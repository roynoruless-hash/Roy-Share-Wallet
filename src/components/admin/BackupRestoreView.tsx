import React, { useState, useEffect } from 'react';
import { Database, Download, RotateCcw, ShieldCheck, CheckCircle2, AlertCircle, HardDrive, Clock } from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backup/list');
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/backup/create', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Backup snapshot created successfully!' });
        fetchBackups();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to create backup' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm(`Are you sure you want to restore system state from snapshot ${backupId}?`)) return;
    setRestoringId(backupId);
    try {
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Restore failed' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Phase XIII Disaster Recovery</span>
          </div>
          <h2 className="text-xl font-black text-white">Backup & Restore Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Instant manual snapshots & recovery of Events, Wallet Data, Settings, and Event Templates.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition disabled:opacity-50"
        >
          <HardDrive className="w-4 h-4" />
          <span>{creating ? 'Creating Snapshot...' : 'Create Instant Backup'}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Backup Snapshots */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span>Available System Backups ({backups.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading backup snapshots...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No backups available yet. Click "Create Instant Backup" above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-purple-400">{b.id}</span>
                  <span className="text-[10px] text-slate-400">{new Date(b.createdAt).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 text-center text-[11px]">
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Users</p>
                    <p className="font-bold text-white">{b.recordCounts?.users || 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Events</p>
                    <p className="font-bold text-white">{b.recordCounts?.events || 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Withdrawals</p>
                    <p className="font-bold text-white">{b.recordCounts?.withdrawals || 0}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleRestoreBackup(b.id)}
                    disabled={restoringId === b.id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{restoringId === b.id ? 'Restoring...' : 'Restore State'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
