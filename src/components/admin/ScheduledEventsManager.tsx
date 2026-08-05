import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Zap, Tag, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { ScheduledEvent, EventTemplate } from '../../types';

export const ScheduledEventsManager: React.FC = () => {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [eventName, setEventName] = useState<string>('Golden Drop #102');
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const [codeReleaseDate, setCodeReleaseDate] = useState<string>(new Date(Date.now() + 7200000).toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState<string>(new Date(Date.now() + 10800000).toISOString().slice(0, 16));
  const [rewardAmount, setRewardAmount] = useState<number>(250);
  const [maxClaims, setMaxClaims] = useState<number>(30);
  const [code, setCode] = useState<string>('ROY250');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const fetchScheduledData = async () => {
    setLoading(true);
    try {
      const [evRes, tplRes] = await Promise.all([
        fetch('/api/admin/scheduled-events'),
        fetch('/api/admin/event-templates'),
      ]);
      const evData = await evRes.json();
      const tplData = await tplRes.json();
      if (evData.success) setEvents(evData.events || []);
      if (tplData.success) setTemplates(tplData.templates || []);
    } catch (err) {
      console.error('Failed to load scheduled events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledData();
  }, []);

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setEventName(tpl.name);
      setRewardAmount(tpl.rewardAmount);
      setMaxClaims(tpl.maxClaims);
      setCode(`${tpl.codePrefix}${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handleCreateScheduledEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/scheduled-events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          startDate: new Date(startDate).toISOString(),
          codeReleaseDate: new Date(codeReleaseDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          rewardAmount,
          maxClaims,
          code,
          templateId: selectedTemplateId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Scheduled event created successfully!' });
        setShowCreateModal(false);
        fetchScheduledData();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to schedule event' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled event?')) return;
    try {
      const res = await fetch('/api/admin/scheduled-events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Scheduled event deleted.' });
        fetchScheduledData();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Phase XIII Enterprise Automation</span>
          </div>
          <h2 className="text-xl font-black text-white">Scheduled Events Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Schedule reward drops and redeem code releases in advance with automated timing.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Event</span>
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

      {/* Events List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Active & Upcoming Scheduled Events ({events.length})</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading scheduled events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No scheduled events found. Click "Schedule New Event" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-bold text-sm text-white">{ev.name}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {ev.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-3 rounded-lg border border-slate-800/60">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Reward Pool</p>
                    <p className="font-bold text-emerald-400">{ev.rewardAmount} ₹</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Max Claims</p>
                    <p className="font-bold text-amber-400">{ev.maxClaims} users</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Code</p>
                    <p className="font-mono font-bold text-sky-400">{ev.code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Template</p>
                    <p className="font-bold text-slate-300">{ev.templateId || 'Custom'}</p>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Starts:</span>
                    <span>{new Date(ev.startDate).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Code Release:</span>
                    <span className="text-amber-400 font-medium">{new Date(ev.codeReleaseDate).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ends:</span>
                    <span>{new Date(ev.endDate).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Schedule Advance Event</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateScheduledEvent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Load Reusable Template (Optional)</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Custom Configuration --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rewardAmount} ₹, {t.maxClaims} claims)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Reward per User (₹)</label>
                  <input
                    type="number"
                    required
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Max Claims</label>
                  <input
                    type="number"
                    required
                    value={maxClaims}
                    onChange={(e) => setMaxClaims(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Redeem Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Code Release Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={codeReleaseDate}
                    onChange={(e) => setCodeReleaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
