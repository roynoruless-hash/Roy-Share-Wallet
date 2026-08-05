import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { SystemAnnouncement } from '../../types';

export const AnnouncementsManager: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Announcement Form
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [priority, setPriority] = useState<'Info' | 'Warning' | 'Maintenance'>('Info');
  const [isActive, setIsActive] = useState<boolean>(true);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/announcements/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          priority,
          isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Announcement published successfully!' });
        setShowModal(false);
        setTitle('');
        setMessage('');
        fetchAnnouncements();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save announcement' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await fetch('/api/admin/announcements/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Announcement deleted.' });
        fetchAnnouncements();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Warning':
        return { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> };
      case 'Maintenance':
        return { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: <ShieldAlert className="w-4 h-4 text-rose-400" /> };
      default:
        return { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30', icon: <Info className="w-4 h-4 text-sky-400" /> };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/30">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Megaphone className="w-4 h-4" />
            <span>Phase XIII Communication</span>
          </div>
          <h2 className="text-xl font-black text-white">System Announcements Broadcast</h2>
          <p className="text-xs text-slate-400 mt-1">
            Display real-time banners and maintenance alerts across the Mini App user interface.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
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

      {/* Announcements List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-sky-400" />
          <span>Active & Scheduled Announcements ({announcements.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No announcements created yet. Click "New Announcement" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const { badge, icon } = getPriorityBadge(ann.priority);
              return (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">{icon}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge}`}>
                          {ann.priority}
                        </span>
                        <h4 className="font-bold text-white text-sm">{ann.title}</h4>
                      </div>
                      <p className="text-slate-300">{ann.message}</p>
                      <p className="text-[10px] text-slate-500">{new Date(ann.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-sky-400" />
                <span>Create System Announcement</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled System Maintenance"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Info">Info (General Notice)</option>
                  <option value="Warning">Warning (Important Notice)</option>
                  <option value="Maintenance">Maintenance (Critical Alert)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Message Body</label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detailed announcement text..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-lg shadow-sky-500/20"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
