import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { FeedbackCampaign } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Share2,
  Check,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Calendar,
  DollarSign,
  ChevronRight,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';

interface FeedbackCampaignsViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export const FeedbackCampaignsView: React.FC<FeedbackCampaignsViewProps> = ({
  config,
  showToast,
}) => {
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<FeedbackCampaign | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [bonusAmount, setBonusAmount] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxBonusLimit, setMaxBonusLimit] = useState('1000');
  const [active, setActive] = useState(true);
  const [thankYouMessage, setThankYouMessage] = useState('Thank you for helping Roy Share Wallet.');
  const [rejectMessage, setRejectMessage] = useState('Your feedback submission was rejected.');

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'feedbackCampaigns'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const list: FeedbackCampaign[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as FeedbackCampaign);
      });
      setCampaigns(list);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      showToast('Failed to load feedback campaigns.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Handle Form open for Create
  const handleOpenCreate = () => {
    setEditingCampaign(null);
    setName('');
    setBonusAmount('10');
    
    // Set default dates: start now, end in 30 days
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    
    setStartDate(now.toISOString().split('T')[0]);
    setEndDate(thirtyDaysLater.toISOString().split('T')[0]);
    
    setMaxBonusLimit('1000');
    setActive(true);
    setThankYouMessage('Thank you for helping Roy Share Wallet.');
    setRejectMessage('Your feedback submission was rejected.');
    setIsFormOpen(true);
  };

  // Handle Form open for Edit
  const handleOpenEdit = (campaign: FeedbackCampaign) => {
    setEditingCampaign(campaign);
    setName(campaign.name);
    setBonusAmount(String(campaign.bonusAmount));
    setStartDate(campaign.startDate ? campaign.startDate.split('T')[0] : '');
    setEndDate(campaign.endDate ? campaign.endDate.split('T')[0] : '');
    setMaxBonusLimit(String(campaign.maxBonusLimit));
    setActive(campaign.active);
    setThankYouMessage(campaign.thankYouMessage || 'Thank you for helping Roy Share Wallet.');
    setRejectMessage(campaign.rejectMessage || 'Your feedback submission was rejected.');
    setIsFormOpen(true);
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Delete this feedback campaign? Public links for this campaign will stop working.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'feedbackCampaigns', campaignId));
      showToast('Campaign deleted successfully.', 'success');
      fetchCampaigns();
    } catch (error: any) {
      showToast('Failed to delete campaign.', 'error');
    }
  };

  // Duplicate Campaign
  const handleDuplicateCampaign = async (campaign: FeedbackCampaign) => {
    try {
      const newId = 'fb_' + Math.floor(100000000 + Math.random() * 900000000).toString();
      const origin = window.location.origin;
      const duplicatedData = {
        name: `${campaign.name} (Copy)`,
        bonusAmount: Number(campaign.bonusAmount),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        maxBonusLimit: Number(campaign.maxBonusLimit),
        active: campaign.active,
        thankYouMessage: campaign.thankYouMessage,
        rejectMessage: campaign.rejectMessage,
        createdAt: new Date().toISOString(),
        publicLink: `${origin}/feedback/${newId}`,
      };

      await setDoc(doc(db, 'feedbackCampaigns', newId), duplicatedData);
      showToast('Campaign duplicated successfully.', 'success');
      fetchCampaigns();
    } catch (error: any) {
      showToast('Failed to duplicate campaign.', 'error');
    }
  };

  // Toggle active state directly
  const handleToggleActive = async (campaign: FeedbackCampaign) => {
    try {
      const updatedCampaign = {
        ...campaign,
        active: !campaign.active,
      };
      await setDoc(doc(db, 'feedbackCampaigns', campaign.id), {
        name: updatedCampaign.name,
        bonusAmount: updatedCampaign.bonusAmount,
        startDate: updatedCampaign.startDate,
        endDate: updatedCampaign.endDate,
        maxBonusLimit: updatedCampaign.maxBonusLimit,
        active: updatedCampaign.active,
        thankYouMessage: updatedCampaign.thankYouMessage,
        rejectMessage: updatedCampaign.rejectMessage,
        createdAt: campaign.createdAt,
        publicLink: campaign.publicLink,
      });
      showToast(`Campaign ${updatedCampaign.active ? 'activated' : 'disabled'} successfully.`, 'success');
      fetchCampaigns();
    } catch (error: any) {
      showToast('Failed to toggle status.', 'error');
    }
  };

  // Copy Public Link to Clipboard
  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    showToast('Copied feedback link to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Share Public Link
  const handleShareLink = (campaign: FeedbackCampaign) => {
    const text = `Join Roy Share Wallet Feedback Campaign: "${campaign.name}" and earn ₹${campaign.bonusAmount} bonus instantly!`;
    if (navigator.share) {
      navigator.share({
        title: campaign.name,
        text: text,
        url: campaign.publicLink,
      }).catch(console.error);
    } else {
      handleCopyLink(campaign.publicLink, campaign.id);
    }
  };

  // Submit Form (Save/Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Campaign Name is required.', 'error');
      return;
    }

    try {
      const campId = editingCampaign
        ? editingCampaign.id
        : 'fb_' + Math.floor(100000000 + Math.random() * 900000000).toString();

      const origin = window.location.origin;
      const campaignData = {
        name: name.trim(),
        bonusAmount: Number(bonusAmount) || 0,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : '',
        maxBonusLimit: Number(maxBonusLimit) || 0,
        active: active,
        thankYouMessage: thankYouMessage.trim() || 'Thank you for helping Roy Share Wallet.',
        rejectMessage: rejectMessage.trim() || 'Your feedback submission was rejected.',
        createdAt: editingCampaign ? editingCampaign.createdAt : new Date().toISOString(),
        publicLink: editingCampaign ? editingCampaign.publicLink : `${origin}/feedback/${campId}`,
      };

      await setDoc(doc(db, 'feedbackCampaigns', campId), campaignData);
      showToast(editingCampaign ? 'Campaign updated successfully.' : 'New Campaign created successfully.', 'success');
      setIsFormOpen(false);
      fetchCampaigns();
    } catch (error: any) {
      showToast('Error saving campaign.', 'error');
    }
  };

  return (
    <div className="space-y-6" id="feedback-campaigns-module">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">⭐</span> Feedback Campaigns
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Create, configure, and generate public sharing feedback campaigns with Telegram OTP authorization.
          </p>
        </div>
        {!isFormOpen && (
          <button
            id="create-new-campaign-btn"
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 transition-all duration-200 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        )}
      </div>

      {/* Campaign Form Section */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn" id="campaign-editor-form">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              <span>{editingCampaign ? 'Edit Feedback Campaign' : 'Create New Feedback Campaign'}</span>
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 text-sm transition"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Campaign Name */}
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. July App Upgrade Survey"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition text-sm"
                />
              </div>

              {/* Feedback Bonus Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                  Feedback Bonus Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  placeholder="10"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-sky-500 transition text-sm font-semibold text-emerald-400"
                />
                <p className="text-[11px] text-slate-500">Amount users get credited upon feedback approval</p>
              </div>

              {/* Max Bonus Limit */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Max Bonus Limit (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={maxBonusLimit}
                  onChange={(e) => setMaxBonusLimit(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-sky-500 transition text-sm"
                />
                <p className="text-[11px] text-slate-500">Maximum limit allowed across this campaign</p>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-sky-500 transition text-sm"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-sky-500 transition text-sm"
                />
              </div>

              {/* Thank You Message */}
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Thank You Message (Shown to User upon Submission)
                </label>
                <textarea
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  placeholder="Thank you for helping Roy Share Wallet."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition text-sm resize-none"
                />
              </div>

              {/* Reject Message */}
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Reject Message (For Telegram notification if feedback rejected)
                </label>
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  placeholder="Your feedback submission was rejected."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition text-sm resize-none"
                />
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl col-span-1 md:col-span-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Campaign Status</h4>
                  <p className="text-xs text-slate-500">Enable or disable public feedback links immediately</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className="text-slate-400 hover:text-white transition"
                >
                  {active ? (
                    <ToggleRight className="w-12 h-12 text-sky-400" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/15"
              >
                {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns list Table */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Campaigns Overview ({campaigns.length})</span>
          </h3>
          <button
            onClick={fetchCampaigns}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium hover:underline transition"
          >
            Refresh List
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-xs">Fetching campaigns from Firestore...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-300">No Feedback Campaigns Defined</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click the Create Campaign button to generate your first survey URL for registered mobile users.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Campaign Name</th>
                  <th className="px-5 py-3.5">Reward (₹)</th>
                  <th className="px-5 py-3.5">Date Range</th>
                  <th className="px-5 py-3.5">Max Bonus</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Public link</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaigns.map((camp) => {
                  const now = new Date().toISOString();
                  const isExpired = camp.endDate && now > camp.endDate;
                  const isNotStarted = camp.startDate && now < camp.startDate;
                  const isActive = camp.active && !isExpired && !isNotStarted;

                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-slate-800/20 text-xs sm:text-sm text-slate-300 transition"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white mb-0.5">{camp.name}</div>
                        <div className="text-[10px] text-slate-500 select-all font-mono">ID: {camp.id}</div>
                      </td>

                      {/* Reward Amount */}
                      <td className="px-5 py-4 text-emerald-400 font-bold font-mono">
                        ₹{camp.bonusAmount}
                      </td>

                      {/* Date Range */}
                      <td className="px-5 py-4 text-slate-400">
                        <div className="flex flex-col gap-0.5 text-xs font-mono">
                          <span>S: {camp.startDate ? new Date(camp.startDate).toLocaleDateString() : 'Immediate'}</span>
                          <span>E: {camp.endDate ? new Date(camp.endDate).toLocaleDateString() : 'Never'}</span>
                        </div>
                      </td>

                      {/* Max Bonus Limit */}
                      <td className="px-5 py-4 text-slate-400 font-mono">
                        ₹{camp.maxBonusLimit}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(camp)}
                          className="focus:outline-none"
                          title="Click to toggle active status"
                        >
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              🟢 Active
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              🔴 Expired
                            </span>
                          ) : isNotStarted ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              🟡 Scheduled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                              🔴 Disabled
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Public Link Controls */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={camp.publicLink}
                            className="bg-slate-950 border border-slate-800 text-[10px] px-2 py-1 rounded-lg text-slate-400 select-all font-mono max-w-[140px] focus:outline-none"
                          />
                          <button
                            onClick={() => handleCopyLink(camp.publicLink, camp.id)}
                            className={`p-1.5 rounded-lg border transition ${
                              copiedId === camp.id
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:bg-slate-700'
                            }`}
                            title="Copy Campaign link"
                          >
                            {copiedId === camp.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleShareLink(camp)}
                            className="p-1.5 rounded-lg border bg-slate-800 border-slate-700/80 text-slate-300 hover:bg-slate-700 transition"
                            title="Share Link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(camp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/10 text-sky-400 border border-slate-700/60 hover:border-sky-500/30 transition"
                            title="✏️ Edit Campaign"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateCampaign(camp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-teal-500/10 text-teal-400 border border-slate-700/60 hover:border-teal-500/30 transition"
                            title="📄 Duplicate Campaign"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 text-rose-400 border border-slate-700/60 hover:border-rose-500/30 transition"
                            title="🗑 Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
