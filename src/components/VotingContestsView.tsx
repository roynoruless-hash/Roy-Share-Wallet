import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Calendar,
  Award,
  History,
  User,
  Check,
  X,
  Image,
  ThumbsUp,
  Coins,
  Settings,
  Search,
  Users,
  Eye,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react';
import { Contest, Contestant, VoteLog, AdminConfig } from '../types';
import {
  getContests,
  saveContest,
  deleteContest,
  getContestants,
  saveContestant,
  deleteContestant,
  getVoteLogs,
  submitVote
} from '../services/contestService';

interface VotingContestsViewProps {
  config: AdminConfig;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const VotingContestsView: React.FC<VotingContestsViewProps> = ({ config, showToast }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [voteLogs, setVoteLogs] = useState<VoteLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab within Voting System
  const [activeSubTab, setActiveSubTab] = useState<'contests' | 'contestants' | 'logs'>('contests');

  // Form states - Contests
  const [showContestForm, setShowContestForm] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    startDate: '',
    endDate: '',
    rules: '',
    maxVotesPerUser: 1,
    voteIntervalHours: 0,
    voterRewardAmount: 0,
    winnerRewardAmount: 0,
    status: 'active' as Contest['status']
  });

  // Form states - Contestants
  const [showContestantForm, setShowContestantForm] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [contestantForm, setContestantForm] = useState({
    contestId: '',
    name: '',
    telegramId: '',
    username: '',
    description: '',
    imageUrl: '',
    votesCount: 0,
    status: 'approved' as Contestant['status']
  });

  // Filter and Search states
  const [contestSearch, setContestSearch] = useState('');
  const [contestantSearch, setContestantSearch] = useState('');
  const [selectedContestFilter, setSelectedContestFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');

  // Initial Fetch
  const reloadAllData = async () => {
    setIsLoading(true);
    try {
      const cList = await getContests();
      const cnList = await getContestants();
      const lList = await getVoteLogs();

      setContests(cList);
      setContestants(cnList);
      setVoteLogs(lList);

      if (cList.length > 0 && !selectedContestId) {
        setSelectedContestId(cList[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load Voting System data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadAllData();
  }, []);

  // Handle Contest Save
  const handleContestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestForm.title.trim()) {
      showToast('Contest Title is required', 'error');
      return;
    }

    try {
      const savedId = await saveContest({
        ...(editingContest ? { id: editingContest.id } : {}),
        title: contestForm.title,
        description: contestForm.description,
        imageUrl: contestForm.imageUrl,
        startDate: contestForm.startDate,
        endDate: contestForm.endDate,
        rules: contestForm.rules,
        maxVotesPerUser: contestForm.maxVotesPerUser,
        voteIntervalHours: contestForm.voteIntervalHours,
        voterRewardAmount: contestForm.voterRewardAmount,
        winnerRewardAmount: contestForm.winnerRewardAmount,
        status: contestForm.status,
        createdAt: editingContest?.createdAt || new Date().toISOString()
      });

      showToast(editingContest ? 'Contest updated successfully!' : 'Contest created successfully!', 'success');
      setShowContestForm(false);
      setEditingContest(null);
      reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to save contest', 'error');
    }
  };

  // Handle Contestant Save
  const handleContestantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetContestId = contestantForm.contestId || selectedContestId;
    if (!targetContestId) {
      showToast('Please select or create a contest first', 'error');
      return;
    }
    if (!contestantForm.name.trim()) {
      showToast('Contestant Name is required', 'error');
      return;
    }

    const targetContest = contests.find(c => c.id === targetContestId);

    try {
      await saveContestant({
        ...(editingContestant ? { id: editingContestant.id } : {}),
        contestId: targetContestId,
        contestTitle: targetContest?.title || 'Unknown Contest',
        name: contestantForm.name,
        telegramId: contestantForm.telegramId,
        username: contestantForm.username,
        description: contestantForm.description,
        imageUrl: contestantForm.imageUrl,
        votesCount: contestantForm.votesCount,
        status: contestantForm.status,
        createdAt: editingContestant?.createdAt || new Date().toISOString()
      });

      showToast(editingContestant ? 'Contestant updated successfully!' : 'Contestant added successfully!', 'success');
      setShowContestantForm(false);
      setEditingContestant(null);
      reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to save contestant', 'error');
    }
  };

  // Toggle Contest Status Quick action
  const toggleContestStatus = async (contest: Contest) => {
    const newStatus: Contest['status'] = contest.status === 'active' ? 'paused' : 'active';
    try {
      await saveContest({
        ...contest,
        status: newStatus
      });
      showToast(`Contest status changed to ${newStatus}`, 'success');
      reloadAllData();
    } catch (err) {
      showToast('Failed to toggle status', 'error');
    }
  };

  // Manual Adjust Votes Count
  const adjustContestantVotes = async (contestant: Contestant, offset: number) => {
    const current = Number(contestant.votesCount) || 0;
    const next = Math.max(0, current + offset);
    try {
      await saveContestant({
        ...contestant,
        votesCount: next
      });
      showToast(`Votes updated for ${contestant.name} to ${next}`, 'success');
      setContestants(prev => prev.map(c => c.id === contestant.id ? { ...c, votesCount: next } : c));
    } catch (err) {
      showToast('Failed to adjust votes count', 'error');
    }
  };

  // Delete Contest Action
  const handleContestDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contest? All associated contestants and votes will be cleared!')) return;
    try {
      await deleteContest(id);
      showToast('Contest deleted successfully', 'success');
      reloadAllData();
    } catch (err) {
      showToast('Failed to delete contest', 'error');
    }
  };

  // Delete Contestant Action
  const handleContestantDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this contestant?')) return;
    try {
      await deleteContestant(id);
      showToast('Contestant removed successfully', 'success');
      reloadAllData();
    } catch (err) {
      showToast('Failed to delete contestant', 'error');
    }
  };

  // Open Edit Contest Form
  const openEditContest = (contest: Contest) => {
    setEditingContest(contest);
    setContestForm({
      title: contest.title,
      description: contest.description,
      imageUrl: contest.imageUrl || '',
      startDate: contest.startDate,
      endDate: contest.endDate,
      rules: contest.rules || '',
      maxVotesPerUser: contest.maxVotesPerUser || 1,
      voteIntervalHours: contest.voteIntervalHours || 0,
      voterRewardAmount: contest.voterRewardAmount || 0,
      winnerRewardAmount: contest.winnerRewardAmount || 0,
      status: contest.status
    });
    setShowContestForm(true);
  };

  // Open Edit Contestant Form
  const openEditContestant = (contestant: Contestant) => {
    setEditingContestant(contestant);
    setContestantForm({
      contestId: contestant.contestId,
      name: contestant.name,
      telegramId: contestant.telegramId || '',
      username: contestant.username || '',
      description: contestant.description || '',
      imageUrl: contestant.imageUrl || '',
      votesCount: contestant.votesCount,
      status: contestant.status
    });
    setShowContestantForm(true);
  };

  // Image Upload base64 parser helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'contest' | 'contestant') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size exceeds 2MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (type === 'contest') {
          setContestForm(prev => ({ ...prev, imageUrl: reader.result as string }));
        } else {
          setContestantForm(prev => ({ ...prev, imageUrl: reader.result as string }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter Contests and Contestants based on search
  const filteredContests = contests.filter(c =>
    c.title.toLowerCase().includes(contestSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(contestSearch.toLowerCase())
  );

  const filteredContestants = contestants.filter(cn => {
    const matchesSearch = cn.name.toLowerCase().includes(contestantSearch.toLowerCase()) ||
      (cn.description && cn.description.toLowerCase().includes(contestantSearch.toLowerCase())) ||
      (cn.username && cn.username.toLowerCase().includes(contestantSearch.toLowerCase()));

    const matchesContest = selectedContestFilter === 'all' || cn.contestId === selectedContestFilter;

    return matchesSearch && matchesContest;
  });

  const filteredLogs = voteLogs.filter(l =>
    l.contestTitle.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.contestantName.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.voterName.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.voterTelegramId.includes(logSearch)
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Banner Information */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 to-blue-600/10 border border-sky-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/25 mt-0.5 sm:mt-0">
            <ThumbsUp className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Telegram Voting Contest Engine</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Engage users with interactive voting campaigns. Award wallet cash to voters to boost virality!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingContest(null);
              setContestForm({
                title: '',
                description: '',
                imageUrl: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                rules: '',
                maxVotesPerUser: 1,
                voteIntervalHours: 0,
                voterRewardAmount: 0,
                winnerRewardAmount: 0,
                status: 'active'
              });
              setShowContestForm(true);
            }}
            className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            New Contest
          </button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1.5">
        <button
          onClick={() => setActiveSubTab('contests')}
          className={`px-4 py-3 text-xs font-bold tracking-wide uppercase transition relative flex items-center gap-1.5 ${
            activeSubTab === 'contests' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Manage Contests ({contests.length})
          {activeSubTab === 'contests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />}
        </button>
        <button
          onClick={() => setActiveSubTab('contestants')}
          className={`px-4 py-3 text-xs font-bold tracking-wide uppercase transition relative flex items-center gap-1.5 ${
            activeSubTab === 'contestants' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Contestants ({contestants.length})
          {activeSubTab === 'contestants' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />}
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-3 text-xs font-bold tracking-wide uppercase transition relative flex items-center gap-1.5 ${
            activeSubTab === 'logs' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Voting Audit Logs
          {activeSubTab === 'logs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />}
        </button>
      </div>

      {/* TAB 1: CONTESTS */}
      {activeSubTab === 'contests' && (
        <div className="space-y-4">
          {/* Contest Search/Filter Header */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={contestSearch}
                onChange={e => setContestSearch(e.target.value)}
                placeholder="Search contests by title or details..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Create / Edit Contest Dialog */}
          {showContestForm && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  {editingContest ? 'Edit Voting Contest' : 'Configure New Voting Contest'}
                </h4>
                <button
                  onClick={() => {
                    setShowContestForm(false);
                    setEditingContest(null);
                  }}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleContestSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contest Title *</label>
                  <input
                    type="text"
                    required
                    value={contestForm.title}
                    onChange={e => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Best Telegram Creator of July"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Status</label>
                  <select
                    value={contestForm.status}
                    onChange={e => setContestForm(prev => ({ ...prev, status: e.target.value as Contest['status'] }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="active">Active (Voting Open)</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={2}
                    value={contestForm.description}
                    onChange={e => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide description of the contest, categories, and criteria..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={contestForm.startDate}
                    onChange={e => setContestForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date (Inclusive)</label>
                  <input
                    type="date"
                    required
                    value={contestForm.endDate}
                    onChange={e => setContestForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Rules */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Special Rules (Optional)</label>
                  <input
                    type="text"
                    value={contestForm.rules}
                    onChange={e => setContestForm(prev => ({ ...prev, rules: e.target.value }))}
                    placeholder="e.g. Only Indian Mobile verified users can vote. Accounts must be 5+ days old."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Max Votes and Limit Interval */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Total Votes Per User</label>
                  <input
                    type="number"
                    min="1"
                    value={contestForm.maxVotesPerUser}
                    onChange={e => setContestForm(prev => ({ ...prev, maxVotesPerUser: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vote Interval Hours (e.g. 24 for Daily)</label>
                  <input
                    type="number"
                    min="0"
                    value={contestForm.voteIntervalHours}
                    onChange={e => setContestForm(prev => ({ ...prev, voteIntervalHours: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Reward settings */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-sky-400" />
                    Voter Reward Cash (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contestForm.voterRewardAmount}
                    onChange={e => setContestForm(prev => ({ ...prev, voterRewardAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Winner Cash/Description Reward (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contestForm.winnerRewardAmount}
                    onChange={e => setContestForm(prev => ({ ...prev, winnerRewardAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Banner Image */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Banner Cover Image
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'contest')}
                      className="hidden"
                      id="contest-banner-uploader"
                    />
                    <label
                      htmlFor="contest-banner-uploader"
                      className="cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition"
                    >
                      Choose Cover Image
                    </label>
                    <input
                      type="text"
                      value={contestForm.imageUrl}
                      onChange={e => setContestForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="Or enter image URL here..."
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 w-full"
                    />
                  </div>
                  {contestForm.imageUrl && (
                    <div className="w-full max-h-40 rounded-xl overflow-hidden border border-slate-800 mt-2 bg-slate-950 flex items-center justify-center">
                      <img
                        src={contestForm.imageUrl}
                        alt="Preview"
                        className="max-h-40 object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="md:col-span-2 pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowContestForm(false);
                      setEditingContest(null);
                    }}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-850 hover:bg-slate-800 text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
                  >
                    {editingContest ? 'Update Contest Settings' : 'Launch Contest Campaign'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Contests Grid */}
          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse">Loading Contest campaigns...</div>
          ) : filteredContests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-850/60 text-slate-500 text-xs">
              <AlertTriangle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No voting contests found matching your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredContests.map(c => {
                const cContestants = contestants.filter(cn => cn.contestId === c.id);
                const totalVotes = cContestants.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

                return (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-slate-750 transition"
                  >
                    {/* Image and info block */}
                    <div className="flex items-start gap-4 flex-1">
                      {c.imageUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 hidden sm:block">
                          <img
                            src={c.imageUrl}
                            alt="Contest Cover"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0 hidden sm:block">
                          <Image className="w-6 h-6" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h4 className="text-sm font-bold text-white">{c.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            c.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            c.status === 'upcoming' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 max-w-xl">{c.description || 'No description provided.'}</p>

                        {/* Sub metadata */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[10px] text-slate-500 font-medium pt-1">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {c.startDate} to {c.endDate}
                          </span>
                          <span className="flex items-center gap-1 text-sky-400 font-bold">
                            <Coins className="w-3.5 h-3.5 text-sky-500" />
                            Reward: ₹{c.voterRewardAmount || 0} / vote
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            {cContestants.length} Contestant(s)
                          </span>
                          <span className="flex items-center gap-1 font-bold text-slate-300">
                            Total Votes: {totalVotes}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions block */}
                    <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                      <button
                        onClick={() => {
                          setSelectedContestFilter(c.id);
                          setActiveSubTab('contestants');
                        }}
                        className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition text-[11px] font-bold flex items-center gap-1"
                        title="View Contestants"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Contestants</span>
                      </button>

                      <button
                        onClick={() => toggleContestStatus(c)}
                        className={`p-2 rounded-xl border transition ${
                          c.status === 'active'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                        title={c.status === 'active' ? 'Pause Voting' : 'Activate Voting'}
                      >
                        {c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => openEditContest(c)}
                        className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-sky-400 border border-slate-800 hover:border-slate-700 transition"
                        title="Edit Settings"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleContestDelete(c.id)}
                        className="p-2 rounded-xl bg-slate-950/60 hover:bg-rose-500/20 text-rose-400 border border-slate-800 hover:border-rose-500/30 transition"
                        title="Delete Contest"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTESTANTS */}
      {activeSubTab === 'contestants' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Contest dropdown filter */}
            <div className="w-full sm:w-64">
              <select
                value={selectedContestFilter}
                onChange={e => setSelectedContestFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Contests</option>
                {contests.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={contestantSearch}
                onChange={e => setContestantSearch(e.target.value)}
                placeholder="Search contestants by name..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Add Contestant Button */}
            <button
              onClick={() => {
                setEditingContestant(null);
                setContestantForm({
                  contestId: selectedContestFilter !== 'all' ? selectedContestFilter : (contests[0]?.id || ''),
                  name: '',
                  telegramId: '',
                  username: '',
                  description: '',
                  imageUrl: '',
                  votesCount: 0,
                  status: 'approved'
                });
                setShowContestantForm(true);
              }}
              className="py-2 px-3.5 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              Add Contestant
            </button>
          </div>

          {/* Form Create / Edit Contestant */}
          {showContestantForm && (
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  {editingContestant ? `Edit Contestant: ${editingContestant.name}` : 'Add Contestant'}
                </h4>
                <button
                  onClick={() => {
                    setShowContestantForm(false);
                    setEditingContestant(null);
                  }}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleContestantSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Associated Contest */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Contest *</label>
                  <select
                    required
                    value={contestantForm.contestId}
                    onChange={e => setContestantForm(prev => ({ ...prev, contestId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="" disabled>Select associated contest...</option>
                    {contests.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contestant Name *</label>
                  <input
                    type="text"
                    required
                    value={contestantForm.name}
                    onChange={e => setContestantForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Telegram ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telegram User ID (Optional)</label>
                  <input
                    type="text"
                    value={contestantForm.telegramId}
                    onChange={e => setContestantForm(prev => ({ ...prev, telegramId: e.target.value }))}
                    placeholder="e.g. 123456789"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Telegram Username */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telegram Username (Optional)</label>
                  <input
                    type="text"
                    value={contestantForm.username}
                    onChange={e => setContestantForm(prev => ({ ...prev, username: e.target.value.startsWith('@') ? e.target.value : `@${e.target.value}` }))}
                    placeholder="e.g. @ramesh_tg"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contestant Biography / Entry Pitch</label>
                  <textarea
                    rows={2}
                    value={contestantForm.description}
                    onChange={e => setContestantForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Professional content creator with 50K subscribers. Pitching for the creator fund."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Initial Votes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Votes Count</label>
                  <input
                    type="number"
                    min="0"
                    value={contestantForm.votesCount}
                    onChange={e => setContestantForm(prev => ({ ...prev, votesCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contestant Entry Status</label>
                  <select
                    value={contestantForm.status}
                    onChange={e => setContestantForm(prev => ({ ...prev, status: e.target.value as Contestant['status'] }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="approved">Approved (Active in Contest)</option>
                    <option value="pending">Pending Admin Approval</option>
                    <option value="rejected">Rejected / Suspended</option>
                  </select>
                </div>

                {/* Photograph URL */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Contestant Profile Photograph
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'contestant')}
                      className="hidden"
                      id="contestant-photo-uploader"
                    />
                    <label
                      htmlFor="contestant-photo-uploader"
                      className="cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition"
                    >
                      Upload Photo File
                    </label>
                    <input
                      type="text"
                      value={contestantForm.imageUrl}
                      onChange={e => setContestantForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="Or enter photograph image URL..."
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 w-full"
                    />
                  </div>
                  {contestantForm.imageUrl && (
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-800 mt-2 bg-slate-950 flex items-center justify-center">
                      <img
                        src={contestantForm.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="md:col-span-2 pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowContestantForm(false);
                      setEditingContestant(null);
                    }}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-850 hover:bg-slate-800 text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
                  >
                    {editingContestant ? 'Save Contestant Info' : 'Approve Contestant Entry'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Contestants Grid / list */}
          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse">Loading contestants list...</div>
          ) : filteredContestants.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-850/60 text-slate-500 text-xs">
              <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No contestants registered under this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContestants.map(cn => {
                const cParent = contests.find(c => c.id === cn.contestId);

                return (
                  <div
                    key={cn.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4 hover:border-slate-750 transition"
                  >
                    {/* Identity & stats info */}
                    <div className="flex items-start gap-3">
                      {cn.imageUrl ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                          <img
                            src={cn.imageUrl}
                            alt="Contestant Avatar"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                      )}

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-white">{cn.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            cn.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            cn.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {cn.status}
                          </span>
                        </div>
                        {cn.username && <p className="text-[10px] text-sky-400 font-bold">{cn.username}</p>}
                        <p className="text-[11px] text-slate-400 line-clamp-2">{cn.description || 'No entry biography provided.'}</p>

                        <div className="pt-2 flex flex-col gap-1 text-[10px] text-slate-500">
                          <span className="font-semibold text-slate-400 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-slate-500" />
                            Contest: {cParent ? cParent.title : 'Deleted Contest'}
                          </span>
                          {cn.telegramId && <span>Telegram ID: <code>{cn.telegramId}</code></span>}
                        </div>
                      </div>
                    </div>

                    {/* Votes Adjustments and Controls Bar */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      {/* Vote Count indicator */}
                      <div className="bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-850 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Votes:</span>
                        <span className="text-xs font-black font-mono text-sky-400">{cn.votesCount}</span>
                      </div>

                      {/* Vote adjustment buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjustContestantVotes(cn, -1)}
                          className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-850 text-slate-400 text-[10px] font-mono font-bold border border-slate-800 transition"
                          title="Subtract 1 Vote"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => adjustContestantVotes(cn, 1)}
                          className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold border border-sky-500/20 transition"
                          title="Add 1 Vote"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => adjustContestantVotes(cn, 10)}
                          className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20 transition"
                          title="Add 10 Votes"
                        >
                          +10
                        </button>

                        <span className="w-px h-4 bg-slate-800 mx-1" />

                        <button
                          onClick={() => openEditContestant(cn)}
                          className="p-1.5 rounded bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 transition"
                          title="Edit Contestant details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleContestantDelete(cn.id)}
                          className="p-1.5 rounded bg-slate-950 hover:bg-rose-500/10 text-rose-400 border border-slate-800 hover:border-rose-500/20 transition"
                          title="Remove Contestant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT VOTE LOGS */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Logs search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Search logs by voter, contestant, or contest..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Audit Logs table */}
          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 animate-pulse">Loading voting records logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-850/60 text-slate-500 text-xs">
              <History className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No voting log entries recorded.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                      <th className="p-3.5 pl-5">Timestamp</th>
                      <th className="p-3.5">Contest Title</th>
                      <th className="p-3.5">Voted For</th>
                      <th className="p-3.5">Voter Name / Telegram ID</th>
                      <th className="p-3.5">Reward Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px] text-slate-300 font-medium">
                    {filteredLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-950/40 transition">
                        <td className="p-3.5 pl-5 font-mono text-slate-500">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-slate-200 font-bold">{l.contestTitle}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20">
                            {l.contestantName}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-bold">{l.voterName}</span>
                            <span className="text-[9px] text-slate-500">
                              ID: <code>{l.voterTelegramId}</code> {l.voterUsername && `(${l.voterUsername})`}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          {l.rewardEarned && l.rewardEarned > 0 ? (
                            <span className="text-emerald-400 font-bold font-mono">
                              +₹{l.rewardEarned}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono">₹0.00</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
