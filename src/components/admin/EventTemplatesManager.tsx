import React, { useState, useEffect } from 'react';
import { Layers, Rocket, Plus, Zap, Award, Gift, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { EventTemplate } from '../../types';

export const EventTemplatesManager: React.FC = () => {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Custom Template Form
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Flash Event');
  const [rewardAmount, setRewardAmount] = useState<number>(100);
  const [maxClaims, setMaxClaims] = useState<number>(50);
  const [codePrefix, setCodePrefix] = useState<string>('ROY');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [description, setDescription] = useState<string>('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/event-templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleLaunchTemplate = async (templateId: string) => {
    setLaunchingId(templateId);
    try {
      const res = await fetch('/api/admin/event-templates/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message || 'Event launched successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to launch event template' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLaunchingId(null);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/event-templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          rewardAmount,
          maxClaims,
          codePrefix,
          durationMinutes,
          description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Template saved successfully!' });
        setShowModal(false);
        fetchTemplates();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save template' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Flash Event': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Golden Event': return <Award className="w-5 h-5 text-yellow-400" />;
      case 'Giveaway Event': return <Gift className="w-5 h-5 text-sky-400" />;
      case 'VIP Event': return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      default: return <Layers className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/30">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Phase XIII Enterprise Automation</span>
          </div>
          <h2 className="text-xl font-black text-white">Event Templates Suite</h2>
          <p className="text-xs text-slate-400 mt-1">
            Launch instant events with 1-click presets or save custom reusable drop configurations.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Template</span>
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

      {/* Grid of Templates */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading event templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/40 transition space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    {getCategoryIcon(tpl.category)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{tpl.name}</h3>
                    <span className="text-[11px] font-semibold text-slate-400">{tpl.category}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleLaunchTemplate(tpl.id)}
                  disabled={launchingId === tpl.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition disabled:opacity-50"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>{launchingId === tpl.id ? 'Launching...' : '1-Click Launch'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2">{tpl.description}</p>

              <div className="grid grid-cols-4 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Reward</p>
                  <p className="font-bold text-emerald-400 text-xs">{tpl.rewardAmount} ₹</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Max Claims</p>
                  <p className="font-bold text-sky-400 text-xs">{tpl.maxClaims}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Prefix</p>
                  <p className="font-mono font-bold text-amber-400 text-xs">{tpl.codePrefix}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Duration</p>
                  <p className="font-bold text-purple-400 text-xs">{tpl.durationMinutes}m</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>Save Reusable Template</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Golden Rush"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Flash Event">Flash Event</option>
                    <option value="Golden Event">Golden Event</option>
                    <option value="Giveaway Event">Giveaway Event</option>
                    <option value="VIP Event">VIP Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Code Prefix</label>
                  <input
                    type="text"
                    required
                    value={codePrefix}
                    onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                    placeholder="ROY"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Reward (₹)</label>
                  <input
                    type="number"
                    required
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Max Claims</label>
                  <input
                    type="number"
                    required
                    value={maxClaims}
                    onChange={(e) => setMaxClaims(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration (min)</label>
                  <input
                    type="number"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details about this drop type..."
                  rows={3}
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
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
