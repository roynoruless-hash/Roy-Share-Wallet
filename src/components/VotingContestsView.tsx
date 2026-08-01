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
  Info,
  Link,
  Share2,
  Send,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  Rocket,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCw
} from 'lucide-react';
import { Contest, Contestant, VoteLog, AdminConfig, ContestLog } from '../types';
import {
  getContests,
  saveContest,
  deleteContest,
  getContestants,
  saveContestant,
  deleteContestant,
  getVoteLogs,
  getVoteLinks,
  getContestLogs,
  saveVoteLink,
  addContestLog
} from '../services/contestService';
import { uploadImageToStorage } from '../services/storageService';

interface VotingContestsViewProps {
  config: AdminConfig;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function getContestPhase(contest: Contest) {
  const now = new Date();
  const regStart = contest.registrationStartDate
    ? new Date(contest.registrationStartDate + (contest.registrationStartDate.includes('T') ? '' : 'T00:00:00'))
    : new Date(0);

  if (contest.status === 'completed' || contest.votingEndedProcessed) {
    return {
      code: 'winners_announced',
      label: 'Winners Announced',
      icon: '🏆',
      colorClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    };
  }
  if (contest.status === 'paused') {
    return {
      code: 'paused',
      label: 'Paused',
      icon: '⏸',
      colorClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    };
  }
  if (contest.votingStarted || contest.registrationClosedProcessed) {
    return {
      code: 'voting_open',
      label: 'Voting Live',
      icon: '🔵',
      colorClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
    };
  }
  if (now < regStart) {
    return {
      code: 'registration_pending',
      label: 'Registration Upcoming',
      icon: '⏳',
      colorClass: 'bg-slate-800 text-slate-300 border border-slate-700'
    };
  }
  return {
    code: 'registration_open',
    label: 'Registration Open',
    icon: '🟢',
    colorClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
  };
}

export function getTimeRemainingString(targetDateStr: string, startDateStr?: string) {
  if (!targetDateStr) return 'N/A';
  const now = new Date().getTime();
  const target = new Date(targetDateStr).getTime();

  if (startDateStr) {
    const start = new Date(startDateStr + (startDateStr.includes('T') ? '' : 'T00:00:00')).getTime();
    if (now < start) {
      const diffStart = start - now;
      const days = Math.floor(diffStart / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diffStart % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffStart % (1000 * 60)) / 1000);
      return `Starts in ${days > 0 ? `${days}d ` : ''}${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
  }

  if (now > target) {
    return 'Ended';
  }

  const diff = target - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  return `${days > 0 ? `${days}d ` : ''}${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

export const VotingContestsView: React.FC<VotingContestsViewProps> = ({ config, showToast }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [voteLogs, setVoteLogs] = useState<VoteLog[]>([]);
  const [contestLogs, setContestLogs] = useState<ContestLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date().toLocaleTimeString());

  // 1-second live ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'contests' | 'contestants' | 'results' | 'logs'>('contests');

  // Loading indicator for resending Telegram link
  const [isResending, setIsResending] = useState<string | null>(null);

  // Get Admin session token from storage
  const getAdminSessionToken = (): string => {
    try {
      const raw = localStorage.getItem('royshare_admin_session') || sessionStorage.getItem('royshare_admin_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.sessionToken || '';
      }
    } catch (err) {
      console.error('Error reading admin session:', err);
    }
    return '';
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    showToast('Link copied to clipboard successfully!', 'success');
  };

  const handleShareLink = (title: string, link: string) => {
    if (navigator.share) {
      navigator
        .share({
          title: title,
          text: `Register for the voting contest "${title}" here!`,
          url: link
        })
        .catch(() => {
          navigator.clipboard.writeText(link);
          showToast('Link copied to clipboard!', 'success');
        });
    } else {
      navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard!', 'success');
    }
  };

  const handleResendVotingLink = async (contestant: Contestant) => {
    if (!contestant.telegramId) {
      showToast('This contestant has no Telegram ID registered.', 'error');
      return;
    }

    setIsResending(contestant.id);
    try {
      const token = getAdminSessionToken();
      const response = await fetch('/api/admin/contestants/resend-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': token
        },
        body: JSON.stringify({
          contestantId: contestant.id,
          contestId: contestant.contestId
        })
      });

      const data = await response.json();

      if (response.status === 401 || (data.error && data.error.toLowerCase().includes('unauthorized'))) {
        showToast('Session expired or missing. Refreshing admin session...', 'error');
        window.dispatchEvent(new Event('admin-session-expired'));
        return;
      }

      if (data.success) {
        showToast(data.message || 'Voting link sent successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to send voting link.', 'error');
      }
    } catch (err: any) {
      console.error('Error sending voting link:', err);
      showToast('Network error while sending voting link.', 'error');
    } finally {
      setIsResending(null);
    }
  };

  // Form states - Contests
  const [showContestForm, setShowContestForm] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [isSavingContest, setIsSavingContest] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Form states - Contestants
  const [showContestantForm, setShowContestantForm] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [isSavingContestant, setIsSavingContestant] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string>('');

  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    registrationStartDate: '',
    registrationStartTime: '00:00',
    rules: '',
    maxVotesPerUser: 1,
    voteIntervalHours: 0,
    voterRewardAmount: 0,
    winnerRewardAmount: 0,
    status: 'active' as Contest['status']
  });

  // Warn on page reload/navigation if form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((showContestForm || showContestantForm) && isFormDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [showContestForm, showContestantForm, isFormDirty]);

  // Safely cancel contest form
  const handleCancelContestForm = () => {
    if (isSavingContest) return;
    if (isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the Voting Contest editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setShowContestForm(false);
    setEditingContest(null);
  };

  // Safely change active subtab
  const handleSubTabChange = (tab: 'contests' | 'contestants' | 'results' | 'logs') => {
    if ((showContestForm || showContestantForm) && isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setShowContestForm(false);
    setShowContestantForm(false);
    setEditingContest(null);
    setEditingContestant(null);
    setActiveSubTab(tab);
  };

  // Safely start new contest form
  const handleNewContestClick = () => {
    if (showContestForm && isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the Voting Contest editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setEditingContest(null);
    setContestForm({
      title: '',
      description: '',
      imageUrl: '',
      registrationStartDate: new Date().toISOString().split('T')[0],
      registrationStartTime: '00:00',
      rules: '',
      maxVotesPerUser: 1,
      voteIntervalHours: 0,
      voterRewardAmount: 0,
      winnerRewardAmount: 0,
      status: 'active'
    });
    setShowContestForm(true);
  };

  // Contestant form data state
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

  const handleCancelContestantForm = () => {
    if (isSavingContestant) return;
    if (isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the Contestant editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setShowContestantForm(false);
    setEditingContestant(null);
  };

  // Filter and Search states
  const [contestSearch, setContestSearch] = useState('');
  const [contestantSearch, setContestantSearch] = useState('');
  const [selectedContestFilter, setSelectedContestFilter] = useState('all');
  const [contestantStatusFilter, setContestantStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [logSearch, setLogSearch] = useState('');

  // Refresh & Touch states for Contestants
  const [isRefreshingContestants, setIsRefreshingContestants] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState<number>(0);

  // Dedicated Refresh for Contestants module
  const handleRefreshContestants = async (isManual = true) => {
    if (isRefreshingContestants) return;
    setIsRefreshingContestants(true);
    try {
      const [cnList, cList, lList, cLogList] = await Promise.all([
        getContestants(),
        getContests(),
        getVoteLogs(),
        getContestLogs()
      ]);

      setContestants(cnList);
      setContests(cList);
      setVoteLogs(lList);
      setContestLogs(cLogList);
      setLastUpdatedTime(new Date().toLocaleTimeString());

      if (isManual) {
        showToast('✅ Contestants refreshed successfully.', 'success');
      }
    } catch (err) {
      console.error('Error refreshing contestants:', err);
      if (isManual) {
        showToast('❌ Failed to refresh. Please try again.', 'error');
      }
    } finally {
      setIsRefreshingContestants(false);
    }
  };

  // Auto refresh contestants every 15 seconds when viewing Contestants tab
  useEffect(() => {
    if (activeSubTab !== 'contestants') return;

    const intervalId = setInterval(() => {
      handleRefreshContestants(false);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [activeSubTab]);

  // Touch handlers for mobile Pull-to-Refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeSubTab === 'contestants' && window.scrollY <= 10) {
      setTouchStartY(e.touches[0].clientY);
    } else {
      setTouchStartY(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeSubTab === 'contestants' && touchStartY !== null && window.scrollY <= 10) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;
      if (diff > 0) {
        setPullDistance(Math.min(diff, 100));
      }
    }
  };

  const handleTouchEnd = () => {
    if (activeSubTab === 'contestants' && pullDistance > 60 && !isRefreshingContestants) {
      handleRefreshContestants(true);
    }
    setTouchStartY(null);
    setPullDistance(0);
  };

  // Initial Fetch
  const reloadAllData = async () => {
    setIsLoading(true);
    try {
      const cList = await getContests();
      const cnList = await getContestants();
      const lList = await getVoteLogs();
      const cLogList = await getContestLogs();

      setContests(cList);
      setContestants(cnList);
      setVoteLogs(lList);
      setContestLogs(cLogList);
      setLastUpdatedTime(new Date().toLocaleTimeString());

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

  const handleStartVoting = async (contest: Contest) => {
    const contestContestants = contestants.filter(cn => cn.contestId === contest.id);
    const approvedContestants = contestContestants.filter(cn => cn.status === 'approved');

    if (approvedContestants.length === 0) {
      showToast('Cannot start voting: Please approve at least one participant first.', 'error');
      return;
    }

    const confirmStart = window.confirm(
      `🚀 Start Voting for "${contest.title}"?\n\n` +
      `This will:\n` +
      `1. Close participant registration immediately.\n` +
      `2. Generate unique Telegram Deep Links for all ${approvedContestants.length} approved participants.\n` +
      `3. Send each participant their personal vote link via Telegram Bot.\n` +
      `4. Switch contest status to 'Voting Live'.\n\n` +
      `Do you want to proceed?`
    );

    if (!confirmStart) return;

    setIsLoading(true);
    try {
      const botUsername = config.botUsername || 'RoyShareWalletBot';
      let linksDispatched = 0;

      // 1. Mark contest as voting started & registration closed
      await saveContest({
        ...contest,
        votingStarted: true,
        registrationClosedProcessed: true,
        votingStartedAt: new Date().toISOString(),
        status: 'active'
      });

      // 2. Generate & dispatch unique voting link for every approved contestant
      for (const cn of approvedContestants) {
        const uniqueLink = `https://t.me/${botUsername}?start=vote_${contest.id}_${cn.id}`;
        const linkId = `vote_${contest.id}_${cn.id}`;

        await saveVoteLink({
          contestId: contest.id,
          contestantId: cn.id,
          voteLink: uniqueLink,
        });

        await saveContestant({
          ...cn,
          voteLink: uniqueLink
        });

        if (cn.telegramId) {
          await handleResendVotingLink({ ...cn, voteLink: uniqueLink });
          linksDispatched++;
        }
      }

      await addContestLog({
        contestId: contest.id,
        action: 'START_VOTING',
        details: `Admin manually started voting. Closed registration and dispatched unique vote links for ${approvedContestants.length} approved contestants (${linksDispatched} notified via Telegram).`
      });

      showToast(`🚀 Voting is now LIVE! Dispatched unique voting links to ${approvedContestants.length} participants.`, 'success');
      await reloadAllData();
    } catch (err: any) {
      console.error('Error starting voting:', err);
      showToast('Failed to start voting: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveContestant = async (cn: Contestant) => {
    try {
      await saveContestant({
        ...cn,
        status: 'approved'
      });
      showToast(`Approved ${cn.name}!`, 'success');
      await reloadAllData();
    } catch (err: any) {
      showToast('Failed to approve participant', 'error');
    }
  };

  const handleRejectContestant = async (cn: Contestant) => {
    try {
      await saveContestant({
        ...cn,
        status: 'rejected'
      });
      showToast(`Rejected ${cn.name}.`, 'info');
      await reloadAllData();
    } catch (err: any) {
      showToast('Failed to reject participant', 'error');
    }
  };

  const handleApproveAll = async (contestIdFilter?: string) => {
    const targetContestants = contestants.filter(cn => {
      const matchesContest = !contestIdFilter || contestIdFilter === 'all' || cn.contestId === contestIdFilter;
      return matchesContest && cn.status === 'pending';
    });

    if (targetContestants.length === 0) {
      showToast('No pending participants found to approve.', 'info');
      return;
    }

    const confirmApprove = window.confirm(`Approve all ${targetContestants.length} pending participants?`);
    if (!confirmApprove) return;

    setIsLoading(true);
    try {
      for (const cn of targetContestants) {
        await saveContestant({
          ...cn,
          status: 'approved'
        });
      }
      showToast(`Approved ${targetContestants.length} participants!`, 'success');
      await reloadAllData();
    } catch (err) {
      showToast('Failed to approve all participants.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectAll = async (contestIdFilter?: string) => {
    const targetContestants = contestants.filter(cn => {
      const matchesContest = !contestIdFilter || contestIdFilter === 'all' || cn.contestId === contestIdFilter;
      return matchesContest && cn.status === 'pending';
    });

    if (targetContestants.length === 0) {
      showToast('No pending participants found to reject.', 'info');
      return;
    }

    const confirmReject = window.confirm(`Reject all ${targetContestants.length} pending participants?`);
    if (!confirmReject) return;

    setIsLoading(true);
    try {
      for (const cn of targetContestants) {
        await saveContestant({
          ...cn,
          status: 'rejected'
        });
      }
      showToast(`Rejected ${targetContestants.length} participants!`, 'info');
      await reloadAllData();
    } catch (err) {
      showToast('Failed to reject all participants.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndVoting = async (contest: Contest) => {
    const confirmEnd = window.confirm(
      `🛑 End Voting for "${contest.title}"?\n\n` +
      `This will:\n` +
      `1. Stop all voting instantly and disable all vote links.\n` +
      `2. Calculate total votes and lock all results.\n` +
      `3. Automatically rank all contestants (1st, 2nd, 3rd place, etc.).\n` +
      `4. Mark contest status as "Completed".\n\n` +
      `Do you want to proceed?`
    );

    if (!confirmEnd) return;

    setIsLoading(true);
    try {
      await saveContest({
        ...contest,
        votingEndedProcessed: true,
        status: 'completed'
      });

      await addContestLog({
        contestId: contest.id,
        action: 'END_VOTING',
        details: `Admin manually ended voting. Locked votes and calculated final winner standings.`
      });

      showToast(`🛑 Voting ended for "${contest.title}". Final winner standings locked!`, 'success');
      setSelectedContestId(contest.id);
      setSelectedContestFilter(contest.id);
      setActiveSubTab('results');
      await reloadAllData();
    } catch (err: any) {
      console.error('Error ending voting:', err);
      showToast('Failed to end voting: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadAllData();
  }, []);

  // Handle Contest Save
  const handleContestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingContest) return;

    if (!contestForm.title.trim()) {
      showToast('Contest Title is required', 'error');
      return;
    }

    setIsSavingContest(true);

    try {
      const startDateTimeStr = contestForm.registrationStartTime
        ? `${contestForm.registrationStartDate}T${contestForm.registrationStartTime}`
        : contestForm.registrationStartDate;

      await saveContest({
        ...(editingContest ? { id: editingContest.id } : {}),
        title: contestForm.title,
        description: contestForm.description,
        imageUrl: contestForm.imageUrl,
        registrationStartDate: startDateTimeStr,
        rules: contestForm.rules,
        maxVotesPerUser: contestForm.maxVotesPerUser,
        voteIntervalHours: contestForm.voteIntervalHours,
        voterRewardAmount: contestForm.voterRewardAmount,
        winnerRewardAmount: contestForm.winnerRewardAmount,
        status: contestForm.status,
        createdAt: editingContest?.createdAt || new Date().toISOString()
      });

      showToast(editingContest ? 'Contest updated successfully!' : 'Contest created successfully!', 'success');
      setIsFormDirty(false);
      setShowContestForm(false);
      setEditingContest(null);
      reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to save contest', 'error');
    } finally {
      setIsSavingContest(false);
    }
  };

  // Handle Contestant Save
  const handleContestantSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingContestant) return;

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
    setIsSavingContestant(true);

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
      setIsFormDirty(false);
      setShowContestantForm(false);
      setEditingContestant(null);
      reloadAllData();
    } catch (err) {
      console.error(err);
      showToast('Failed to save contestant', 'error');
    } finally {
      setIsSavingContestant(false);
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
      setContestants(prev => prev.map(c => (c.id === contestant.id ? { ...c, votesCount: next } : c)));
    } catch (err) {
      showToast('Failed to adjust votes count', 'error');
    }
  };

  // Delete Contest Action
  const handleContestDelete = async (id: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this contest? All associated contestants and votes will be cleared!'
      )
    )
      return;
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
    if (showContestForm && isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the Voting Contest editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
    setEditingContest(contest);
    let startDateVal = contest.registrationStartDate || new Date().toISOString().split('T')[0];
    let startTimeVal = '00:00';
    if (startDateVal.includes('T')) {
      const parts = startDateVal.split('T');
      startDateVal = parts[0];
      startTimeVal = parts[1].substring(0, 5);
    }
    setContestForm({
      title: contest.title,
      description: contest.description,
      imageUrl: contest.imageUrl || '',
      registrationStartDate: startDateVal,
      registrationStartTime: startTimeVal,
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
    if (showContestantForm && isFormDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in the Contestant editor. Are you sure you want to discard your changes?'
      );
      if (!confirmLeave) return;
    }
    setIsFormDirty(false);
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

  // Image Upload helper using Firebase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'contest' | 'contestant') => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Uploading image to Firebase Storage...', 'info');

    try {
      const publicUrl = await uploadImageToStorage(file, type === 'contest' ? 'contests' : 'contestants');
      setIsFormDirty(true);
      if (type === 'contest') {
        setContestForm(prev => ({ ...prev, imageUrl: publicUrl }));
      } else {
        setContestantForm(prev => ({ ...prev, imageUrl: publicUrl }));
      }
      showToast('Image uploaded successfully!', 'success');
    } catch (err) {
      console.error('Image upload failed:', err);
      showToast('Failed to upload image to Firebase Storage.', 'error');
    }
  };

  // Filter Contests and Contestants based on search
  const filteredContests = contests.filter(
    c =>
      c.title.toLowerCase().includes(contestSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(contestSearch.toLowerCase())
  );

  const filteredContestants = contestants.filter(cn => {
    const matchesSearch =
      cn.name.toLowerCase().includes(contestantSearch.toLowerCase()) ||
      (cn.description && cn.description.toLowerCase().includes(contestantSearch.toLowerCase())) ||
      (cn.username && cn.username.toLowerCase().includes(contestantSearch.toLowerCase()));

    const matchesContest = selectedContestFilter === 'all' || cn.contestId === selectedContestFilter;

    const matchesStatus =
      contestantStatusFilter === 'all' || (cn.status || 'approved') === contestantStatusFilter;

    return matchesSearch && matchesContest && matchesStatus;
  });

  const filteredLogs = voteLogs.filter(
    l =>
      l.contestTitle.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.contestantName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.voterName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.voterTelegramId.includes(logSearch)
  );

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6 font-sans overflow-x-hidden">
      {/* Top Banner Information */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0 mt-0.5">
            <ThumbsUp className="w-5 h-5 animate-pulse text-sky-400" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              Telegram Voting Contest Engine
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                PRO
              </span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage interactive voting contests, register participants, and reward users via wallet bonuses automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={handleNewContestClick}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/15 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>New Contest</span>
          </button>
        </div>
      </div>

      {/* Admin Overview Dashboard Box */}
      {contests.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Contest Control Dashboard:
              </span>
              <select
                value={selectedContestId || contests[0]?.id}
                onChange={e => {
                  setSelectedContestId(e.target.value);
                  setSelectedContestFilter(e.target.value);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-950 border border-slate-800 text-sky-400 focus:outline-none focus:border-sky-500"
              >
                {contests.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Voting Status & Voting Countdown Badge */}
            {(() => {
              const selectedC = contests.find(c => c.id === (selectedContestId || contests[0]?.id)) || contests[0];
              if (!selectedC) return null;
              const p = getContestPhase(selectedC);
              const cd = getTimeRemainingString(selectedC.votingEndDate);
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${p.colorClass}`}>
                    <span>{p.icon}</span>
                    <span>Status: {p.label}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Countdown: {cd === 'Ended' ? 'Voting Ended 🔴' : cd}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Participant Metrics & Action Toolbar */}
          {(() => {
            const selectedC = contests.find(c => c.id === (selectedContestId || contests[0]?.id)) || contests[0];
            if (!selectedC) return null;
            const cContestants = contestants.filter(cn => cn.contestId === selectedC.id);
            const pending = cContestants.filter(cn => cn.status === 'pending');
            const approved = cContestants.filter(cn => cn.status === 'approved');
            const rejected = cContestants.filter(cn => cn.status === 'rejected');

            return (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-1">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Pending</span>
                    <span className="text-base font-black text-amber-300 font-mono">{pending.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Approved</span>
                    <span className="text-base font-black text-emerald-300 font-mono">{approved.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Rejected</span>
                    <span className="text-base font-black text-rose-300 font-mono">{rejected.length}</span>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 shrink-0 justify-end">
                  <button
                    onClick={() => handleApproveAll(selectedC.id)}
                    className="py-2 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Approve all pending participants for this contest"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Approve All</span>
                  </button>

                  <button
                    onClick={() => handleRejectAll(selectedC.id)}
                    className="py-2 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Reject all pending participants for this contest"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>Reject All</span>
                  </button>

                  {!selectedC.votingStarted && selectedC.status !== 'completed' && (
                    <button
                      onClick={() => handleStartVoting(selectedC)}
                      className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 transition text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 cursor-pointer"
                      title="Start voting immediately, close registration & generate deep links"
                    >
                      <Rocket className="w-4 h-4 fill-slate-950" />
                      <span>🚀 Start Voting</span>
                    </button>
                  )}

                  {selectedC.votingStarted && selectedC.status !== 'completed' && (
                    <button
                      onClick={() => handleEndVoting(selectedC)}
                      className="py-2 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                      title="Stop voting instantly, lock results & rank winners"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>🛑 End Voting</span>
                    </button>
                  )}

                  {(selectedC.status === 'completed' || selectedC.votingEndedProcessed) && (
                    <button
                      onClick={() => {
                        setSelectedContestId(selectedC.id);
                        setActiveSubTab('results');
                      }}
                      className="py-2 px-4 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                      title="View final winner podium & leaderboard"
                    >
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>🏆 View Results</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Primary Sub-Navigation Tabs */}
      <div className="border-b border-slate-800/80">
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => handleSubTabChange('contests')}
            className={`px-3.5 py-2.5 text-xs font-bold transition rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'contests'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Contests</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {contests.length}
            </span>
          </button>

          <button
            onClick={() => handleSubTabChange('contestants')}
            className={`px-3.5 py-2.5 text-xs font-bold transition rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'contestants'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contestants</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {contestants.length}
            </span>
          </button>

          <button
            onClick={() => handleSubTabChange('results')}
            className={`px-3.5 py-2.5 text-xs font-bold transition rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'results'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Results & Leaderboard 🏆</span>
          </button>

          <button
            onClick={() => handleSubTabChange('logs')}
            className={`px-3.5 py-2.5 text-xs font-bold transition rounded-xl flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'logs'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Voting Audit Logs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {voteLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: CONTESTS */}
      {activeSubTab === 'contests' && (
        <div className="space-y-4">
          {/* Contest Search/Filter Header */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={contestSearch}
                onChange={e => setContestSearch(e.target.value)}
                placeholder="Search contests by title or rules..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Contests Cards Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Loading voting contest campaigns...</span>
            </div>
          ) : filteredContests.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-500 text-xs space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-slate-600 mb-1" />
              <p className="font-semibold text-slate-400">No voting contests found</p>
              <p className="text-slate-500 text-[11px]">Click "New Contest" above to configure your first campaign.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredContests.map(c => {
                const cContestants = contestants.filter(cn => cn.contestId === c.id);
                const cPending = cContestants.filter(cn => cn.status === 'pending');
                const cApproved = cContestants.filter(cn => cn.status === 'approved');
                const cRejected = cContestants.filter(cn => cn.status === 'rejected');
                const totalVotes = cContestants.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);
                const registrationUrl = `${window.location.origin}/register-contest/${c.id}`;
                const phase = getContestPhase(c);
                const voteCountdown = getTimeRemainingString(c.votingEndDate);

                return (
                  <div
                    key={c.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col gap-4 hover:border-slate-700 transition w-full overflow-hidden"
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row items-start gap-4 justify-between min-w-0">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {c.imageUrl ? (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                            <img
                              src={c.imageUrl}
                              alt="Contest Cover"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                            <Image className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight break-words">
                              {c.title}
                            </h4>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0 flex items-center gap-1 ${phase.colorClass}`}
                            >
                              <span>{phase.icon}</span>
                              <span>{phase.label}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {c.description || 'No description provided.'}
                          </p>

                          {/* Contest stats metadata */}
                          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-[10px] text-slate-400 pt-1 font-medium">
                            <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-sky-400 font-bold">
                              <Coins className="w-3 h-3 text-sky-500" />
                              Reward: ₹{c.voterRewardAmount || 0} / vote
                            </span>
                            <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                              <Users className="w-3 h-3 text-indigo-400" />
                              {cContestants.length} Contestants
                            </span>
                            <span className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-200 font-bold">
                              Total Votes: {totalVotes}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons toolbar */}
                      <div className="flex items-center flex-wrap gap-1.5 self-end sm:self-start shrink-0">
                        {!c.votingStarted && c.status !== 'completed' && (
                          <button
                            onClick={() => handleStartVoting(c)}
                            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 transition text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                            title="Start Voting Immediately"
                          >
                            <Rocket className="w-3.5 h-3.5 fill-slate-950" />
                            <span>🚀 Start Voting</span>
                          </button>
                        )}

                        {c.votingStarted && c.status !== 'completed' && (
                          <button
                            onClick={() => handleEndVoting(c)}
                            className="py-1.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                            title="End Voting & Lock Results"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>🛑 End Voting</span>
                          </button>
                        )}

                        {(c.status === 'completed' || c.votingEndedProcessed) && (
                          <button
                            onClick={() => {
                              setSelectedContestId(c.id);
                              setActiveSubTab('results');
                            }}
                            className="py-1.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                            title="View Winner Standings & Leaderboard"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>🏆 View Results</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleApproveAll(c.id)}
                          className="py-1.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Approve All Pending"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve All</span>
                        </button>

                        <button
                          onClick={() => handleRejectAll(c.id)}
                          className="py-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Reject All Pending"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject All</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedContestFilter(c.id);
                            setActiveSubTab('contestants');
                          }}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          title="Manage Contestants"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <span>Contestants</span>
                        </button>

                        <button
                          onClick={() => toggleContestStatus(c)}
                          className={`p-2 rounded-xl border transition cursor-pointer ${
                            c.status === 'active'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                          title={c.status === 'active' ? 'Pause Contest' : 'Activate Contest'}
                        >
                          {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => openEditContest(c)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-sky-400 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                          title="Edit Contest Settings"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleContestDelete(c.id)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/20 text-rose-400 border border-slate-800 hover:border-rose-500/30 transition cursor-pointer"
                          title="Delete Contest"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Voting Dashboard Metrics Panel */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/60">
                        <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" />
                          Contest Workflow
                        </div>
                        <div className="text-xs font-mono font-bold text-sky-400 mt-1 truncate">
                          {c.status === 'completed' || c.votingEndedProcessed
                            ? 'Completed 🏆'
                            : c.votingStarted
                            ? 'Voting Live 🔵'
                            : 'Registration Open 🟢'}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                          Start: {c.registrationStartDate ? c.registrationStartDate.replace('T', ' ') : 'N/A'}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          ⏳ Pending Approval
                        </div>
                        <div className="text-sm font-mono font-black text-amber-300 mt-1 truncate">
                          {cPending.length} Participants
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                          Awaiting Review
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <div className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          ✅ Approved
                        </div>
                        <div className="text-sm font-mono font-black text-emerald-300 mt-1 truncate">
                          {cApproved.length} Participants
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                          Ready for Voting
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20">
                        <div className="text-[9px] font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                          ❌ Rejected
                        </div>
                        <div className="text-sm font-mono font-black text-rose-300 mt-1 truncate">
                          {cRejected.length} Participants
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                          Denied Entry
                        </div>
                      </div>
                    </div>

                    {/* Registration Link Box */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full min-w-0">
                      <div className="min-w-0 flex-1 w-full">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                          Public Registration Link
                        </span>
                        <span className="text-xs font-mono text-sky-400 truncate block selection:bg-sky-500/20 w-full">
                          {registrationUrl}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => handleCopyLink(registrationUrl)}
                          className="flex-1 sm:flex-initial py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          title="Copy Link to Clipboard"
                        >
                          <Link className="w-3.5 h-3.5 text-sky-400" />
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => handleShareLink(c.title, registrationUrl)}
                          className="flex-1 sm:flex-initial py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          title="Share Link"
                        >
                          <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Share</span>
                        </button>
                        <a
                          href={`/register-contest/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 sm:flex-initial py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          title="Preview Registration Page"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Preview</span>
                        </a>
                      </div>
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
        <div
          className="space-y-4 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Pull-to-Refresh Indicator */}
          {(pullDistance > 0 || isRefreshingContestants) && (
            <div
              className="flex items-center justify-center gap-2 py-2 text-xs text-sky-400 font-bold transition-all overflow-hidden bg-slate-900/80 rounded-xl border border-sky-500/20 shadow-lg"
              style={{
                height: isRefreshingContestants ? '40px' : `${Math.min(pullDistance, 50)}px`,
                opacity: isRefreshingContestants ? 1 : pullDistance / 60
              }}
            >
              <RotateCw className={`w-4 h-4 text-sky-400 ${isRefreshingContestants || pullDistance > 60 ? 'animate-spin' : ''}`} />
              <span>
                {isRefreshingContestants
                  ? 'Refreshing contestants...'
                  : pullDistance > 60
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
              </span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Contest Filter dropdown */}
            <div className="w-full sm:w-60">
              <select
                value={selectedContestFilter}
                onChange={e => setSelectedContestFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Contests ({contestants.length})</option>
                {contests.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={contestantSearch}
                onChange={e => setContestantSearch(e.target.value)}
                placeholder="Search contestants by name, username..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => handleRefreshContestants(true)}
              disabled={isRefreshingContestants}
              className="py-2.5 px-3.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-sky-400 transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer shrink-0"
              title="Refresh Contestants Data"
            >
              <RotateCw className={`w-4 h-4 text-sky-400 ${isRefreshingContestants ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Add Contestant Button */}
            <button
              onClick={() => {
                if (showContestantForm && isFormDirty) {
                  const confirmLeave = window.confirm(
                    'You have unsaved changes in the editor. Are you sure you want to discard your changes?'
                  );
                  if (!confirmLeave) return;
                }
                setIsFormDirty(false);
                setEditingContestant(null);
                setContestantForm({
                  contestId: selectedContestFilter !== 'all' ? selectedContestFilter : contests[0]?.id || '',
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
              className="py-2.5 px-4 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/10 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>Add Contestant</span>
            </button>
          </div>

          {/* Status Filter Tabs & Bulk Actions Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none w-full sm:w-auto">
              <button
                onClick={() => setContestantStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  contestantStatusFilter === 'all'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>All Statuses</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {contestants.filter(cn => selectedContestFilter === 'all' || cn.contestId === selectedContestFilter).length}
                </span>
              </button>

              <button
                onClick={() => setContestantStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  contestantStatusFilter === 'pending'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>⏳ Pending</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                  {contestants.filter(cn => (selectedContestFilter === 'all' || cn.contestId === selectedContestFilter) && cn.status === 'pending').length}
                </span>
              </button>

              <button
                onClick={() => setContestantStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  contestantStatusFilter === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>✅ Approved</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                  {contestants.filter(cn => (selectedContestFilter === 'all' || cn.contestId === selectedContestFilter) && cn.status === 'approved').length}
                </span>
              </button>

              <button
                onClick={() => setContestantStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  contestantStatusFilter === 'rejected'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>❌ Rejected</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                  {contestants.filter(cn => (selectedContestFilter === 'all' || cn.contestId === selectedContestFilter) && cn.status === 'rejected').length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => handleApproveAll(selectedContestFilter)}
                className="py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve All Pending</span>
              </button>
              <button
                onClick={() => handleRejectAll(selectedContestFilter)}
                className="py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject All Pending</span>
              </button>
            </div>
          </div>

          {/* Contestants Cards Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Loading registered contestants...</span>
            </div>
          ) : filteredContestants.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-500 text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-600 mb-1" />
              <p className="font-semibold text-slate-400">No contestants registered</p>
              <p className="text-slate-500 text-[11px]">
                No participants found matching your filter or search query.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContestants.map(cn => {
                const cParent = contests.find(c => c.id === cn.contestId);
                const uniqueVotingLink = `https://t.me/${config.botUsername || 'RoyShareWalletBot'}?start=vote_${
                  cn.contestId
                }_${cn.id}`;

                return (
                  <div
                    key={cn.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-col justify-between gap-4 hover:border-slate-700 transition w-full overflow-hidden"
                  >
                    {/* Identity Info */}
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-start gap-3.5 min-w-0">
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

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-white truncate">{cn.name}</h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                                  cn.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : cn.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {cn.status}
                              </span>

                              {cn.status !== 'approved' && (
                                <button
                                  onClick={() => handleApproveContestant(cn)}
                                  className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                                  title="Approve Participant"
                                >
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {cn.status !== 'rejected' && (
                                <button
                                  onClick={() => handleRejectContestant(cn)}
                                  className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                                  title="Reject Participant"
                                >
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {cn.username && <p className="text-[11px] text-sky-400 font-bold truncate">{cn.username}</p>}
                          <p className="text-xs text-slate-400 line-clamp-2">{cn.description || 'No pitch provided.'}</p>

                          <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-400 flex items-center gap-1">
                              <Info className="w-3 h-3 text-slate-500" />
                              Contest: {cParent ? cParent.title : 'Deleted Contest'}
                            </span>
                            {cn.telegramId && (
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                                ID: <code className="text-slate-300">{cn.telegramId}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Unique Voting Link Box */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full min-w-0">
                        <div className="min-w-0 flex-1 w-full">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                            Telegram Bot Unique Voting Link
                          </span>
                          <span className="text-[11px] font-mono text-sky-400 truncate block selection:bg-sky-500/20 w-full">
                            {uniqueVotingLink}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleCopyLink(uniqueVotingLink)}
                            className="flex-1 sm:flex-initial py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            title="Copy Link"
                          >
                            <Link className="w-3.5 h-3.5 text-sky-400" />
                            <span>Copy Link</span>
                          </button>
                          <button
                            disabled={isResending === cn.id}
                            onClick={() => handleResendVotingLink(cn)}
                            className="flex-1 sm:flex-initial py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                            title="Resend link via Bot"
                          >
                            {isResending === cn.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>{isResending === cn.id ? 'Sending...' : 'Resend Link'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Votes Adjustments & Actions Bar */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Votes:</span>
                        <span className="text-xs font-black font-mono text-sky-400">{cn.votesCount}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          onClick={() => adjustContestantVotes(cn, -1)}
                          className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-800 transition cursor-pointer"
                          title="Subtract 1 Vote"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => adjustContestantVotes(cn, 1)}
                          className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold border border-sky-500/20 transition cursor-pointer"
                          title="Add 1 Vote"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => adjustContestantVotes(cn, 10)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20 transition cursor-pointer"
                          title="Add 10 Votes"
                        >
                          +10
                        </button>

                        <span className="w-px h-4 bg-slate-800 mx-0.5 hidden sm:inline" />

                        <button
                          onClick={() => openEditContestant(cn)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                          title="Edit Contestant details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleContestantDelete(cn.id)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-500/10 text-rose-400 border border-slate-800 hover:border-rose-500/20 transition cursor-pointer"
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
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Search audit logs by voter, contestant name, or Telegram ID..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Loading audit logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-500 text-xs space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600 mb-1" />
              <p className="font-semibold text-slate-400">No voting logs recorded</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <th className="p-3.5 pl-5">Timestamp</th>
                      <th className="p-3.5">Contest Title</th>
                      <th className="p-3.5">Voted For</th>
                      <th className="p-3.5">Voter Details</th>
                      <th className="p-3.5 pr-5">Reward Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-[11px] text-slate-300 font-medium">
                    {filteredLogs.map(l => (
                      <tr key={l.id} className="hover:bg-slate-850/50 transition">
                        <td className="p-3.5 pl-5 font-mono text-slate-400 whitespace-nowrap">
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
                            <span className="text-[10px] text-slate-500">
                              ID: <code className="text-slate-400">{l.voterTelegramId}</code>{' '}
                              {l.voterUsername && `(${l.voterUsername})`}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 pr-5">
                          {l.rewardEarned && l.rewardEarned > 0 ? (
                            <span className="text-emerald-400 font-bold font-mono">+₹{l.rewardEarned}</span>
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

      {/* TAB: RESULTS & LEADERBOARD */}
      {activeSubTab === 'results' && (
        <div className="space-y-6">
          {/* Contest Selector Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Select Voting Contest:
              </span>
              <select
                value={selectedContestId || contests[0]?.id || ''}
                onChange={e => setSelectedContestId(e.target.value)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-950 border border-slate-800 text-amber-400 focus:outline-none focus:border-amber-500"
              >
                {contests.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.status === 'completed' || c.votingEndedProcessed ? '🏆 (Completed)' : c.votingStarted ? '🔵 (Voting Live)' : '🟢 (Registration Open)'}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const currentC = contests.find(c => c.id === (selectedContestId || contests[0]?.id));
              if (!currentC) return null;
              return (
                <div className="flex items-center gap-2 shrink-0">
                  {currentC.status === 'completed' || currentC.votingEndedProcessed ? (
                    <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold flex items-center gap-1.5">
                      🏆 Winner Results Locked
                    </span>
                  ) : currentC.votingStarted ? (
                    <button
                      onClick={() => handleEndVoting(currentC)}
                      className="py-1.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>🛑 End Voting & Lock Winners</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartVoting(currentC)}
                      className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Rocket className="w-4 h-4 fill-slate-950" />
                      <span>🚀 Start Voting</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {(() => {
            const activeC = contests.find(c => c.id === (selectedContestId || contests[0]?.id)) || contests[0];
            if (!activeC) {
              return (
                <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
                  No contests available to display results.
                </div>
              );
            }

            const activeContestants = contestants
              .filter(cn => cn.contestId === activeC.id)
              .sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));

            const totalVotes = activeContestants.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

            const winner = activeContestants[0];
            const runnerUp = activeContestants[1];
            const thirdPlace = activeContestants[2];

            return (
              <div className="space-y-6">
                {/* Header Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contest Title</span>
                      <span className="text-sm font-bold text-slate-200">{activeC.title}</span>
                    </div>
                    <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">📊 Total Votes Cast</span>
                      <span className="text-xl font-black font-mono text-sky-400">{totalVotes} Votes</span>
                    </div>
                    <CheckCircle className="w-6 h-6 text-sky-400 shrink-0" />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">👥 Total Contestants</span>
                      <span className="text-xl font-black font-mono text-emerald-400">{activeContestants.length} Participants</span>
                    </div>
                    <Users className="w-6 h-6 text-emerald-400 shrink-0" />
                  </div>
                </div>

                {/* Podium Top 3 Winners */}
                {activeContestants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    {/* 2nd Place (Runner-up) */}
                    <div className="order-2 md:order-1 p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 via-slate-900 to-slate-950 border border-slate-700/60 shadow-xl text-center space-y-3 relative overflow-hidden">
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 text-[10px] font-bold border border-slate-600">
                        🥈 2nd Place
                      </div>
                      {runnerUp ? (
                        <>
                          <div className="w-20 h-20 rounded-2xl mx-auto overflow-hidden bg-slate-800 border-2 border-slate-400 flex items-center justify-center shadow-lg">
                            {runnerUp.imageUrl ? (
                              <img src={runnerUp.imageUrl} alt={runnerUp.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-10 h-10 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-200">{runnerUp.name}</h3>
                            {runnerUp.username && <p className="text-[11px] text-sky-400 font-bold">{runnerUp.username}</p>}
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                            <span className="text-lg font-black text-slate-300">{runnerUp.votesCount || 0} Votes</span>
                            <span className="text-[10px] text-slate-500 block">
                              {totalVotes > 0 ? `${(((runnerUp.votesCount || 0) / totalVotes) * 100).toFixed(1)}% of total` : '0%'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-xs text-slate-500 font-semibold">No Runner-up</div>
                      )}
                    </div>

                    {/* 1st Place (Winner) */}
                    <div className="order-1 md:order-2 p-6 rounded-2xl bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border-2 border-amber-400/60 shadow-2xl shadow-amber-500/10 text-center space-y-3 relative overflow-hidden transform md:-translate-y-2">
                      <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-400/40 uppercase tracking-wider flex items-center gap-1">
                        <span>🏆 Winner</span>
                      </div>
                      {winner ? (
                        <>
                          <div className="w-24 h-24 rounded-2xl mx-auto overflow-hidden bg-slate-800 border-2 border-amber-400 flex items-center justify-center shadow-xl ring-4 ring-amber-400/20">
                            {winner.imageUrl ? (
                              <img src={winner.imageUrl} alt={winner.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-12 h-12 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block">GRAND CHAMPION</span>
                            <h2 className="text-base font-black text-amber-200">{winner.name}</h2>
                            {winner.username && <p className="text-xs text-sky-400 font-bold">{winner.username}</p>}
                          </div>
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono">
                            <span className="text-2xl font-black text-amber-300">{winner.votesCount || 0} Votes</span>
                            <span className="text-[10px] text-amber-400/80 block font-sans font-bold">
                              {totalVotes > 0 ? `${(((winner.votesCount || 0) / totalVotes) * 100).toFixed(1)}% of total votes` : '0%'}
                            </span>
                          </div>
                          {activeC.winnerRewardAmount && activeC.winnerRewardAmount > 0 ? (
                            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold">
                              💰 Prize Cash Bonus: ₹{activeC.winnerRewardAmount}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="py-8 text-xs text-slate-500 font-semibold">No Winner</div>
                      )}
                    </div>

                    {/* 3rd Place */}
                    <div className="order-3 p-5 rounded-2xl bg-gradient-to-b from-amber-900/20 via-slate-900 to-slate-950 border border-amber-800/40 shadow-xl text-center space-y-3 relative overflow-hidden">
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-800/30 text-amber-400 text-[10px] font-bold border border-amber-700/50">
                        🥉 3rd Place
                      </div>
                      {thirdPlace ? (
                        <>
                          <div className="w-20 h-20 rounded-2xl mx-auto overflow-hidden bg-slate-800 border-2 border-amber-700/60 flex items-center justify-center shadow-lg">
                            {thirdPlace.imageUrl ? (
                              <img src={thirdPlace.imageUrl} alt={thirdPlace.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-10 h-10 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-200">{thirdPlace.name}</h3>
                            {thirdPlace.username && <p className="text-[11px] text-sky-400 font-bold">{thirdPlace.username}</p>}
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                            <span className="text-lg font-black text-amber-400/90">{thirdPlace.votesCount || 0} Votes</span>
                            <span className="text-[10px] text-slate-500 block">
                              {totalVotes > 0 ? `${(((thirdPlace.votesCount || 0) / totalVotes) * 100).toFixed(1)}% of total` : '0%'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-xs text-slate-500 font-semibold">No 3rd Place</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
                    No participants found in this contest.
                  </div>
                )}

                {/* Complete Ranked Standings Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>📈 Complete Ranked Leaderboard</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                      {activeContestants.length} Contestants
                    </span>
                  </h3>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[650px]">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            <th className="p-3.5 pl-5 w-16">Rank</th>
                            <th className="p-3.5">Participant Name</th>
                            <th className="p-3.5">Telegram Handle</th>
                            <th className="p-3.5 text-center">Votes Received</th>
                            <th className="p-3.5 text-center">Vote Share</th>
                            <th className="p-3.5 pr-5 text-right">Standing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300 font-medium">
                          {activeContestants.map((cn, idx) => {
                            const rank = idx + 1;
                            const pct = totalVotes > 0 ? (((cn.votesCount || 0) / totalVotes) * 100).toFixed(1) : '0';

                            return (
                              <tr
                                key={cn.id}
                                className={`hover:bg-slate-850/50 transition ${
                                  rank === 1
                                    ? 'bg-amber-500/5'
                                    : rank === 2
                                    ? 'bg-slate-800/20'
                                    : rank === 3
                                    ? 'bg-amber-900/10'
                                    : ''
                                }`}
                              >
                                <td className="p-3.5 pl-5 font-mono font-black">
                                  {rank === 1 ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs">
                                      🏆 1st
                                    </span>
                                  ) : rank === 2 ? (
                                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 border border-slate-600 text-xs">
                                      🥈 2nd
                                    </span>
                                  ) : rank === 3 ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-800/30 text-amber-400 border border-amber-700/50 text-xs">
                                      🥉 3rd
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-bold">#{rank}</span>
                                  )}
                                </td>

                                <td className="p-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center text-slate-400">
                                      {cn.imageUrl ? (
                                        <img src={cn.imageUrl} alt={cn.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="w-4 h-4" />
                                      )}
                                    </div>
                                    <span className="font-bold text-slate-200">{cn.name}</span>
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  {cn.username ? (
                                    <span className="text-sky-400 font-bold font-mono">{cn.username}</span>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">N/A</span>
                                  )}
                                </td>

                                <td className="p-3.5 text-center font-mono font-black text-sky-400 text-sm">
                                  {cn.votesCount || 0}
                                </td>

                                <td className="p-3.5 text-center font-mono text-slate-400 text-xs">
                                  {pct}%
                                </td>

                                <td className="p-3.5 pr-5 text-right font-bold">
                                  {rank === 1 ? (
                                    <span className="text-amber-400 font-extrabold uppercase text-[10px] tracking-wider">
                                      🏆 WINNER
                                    </span>
                                  ) : rank === 2 ? (
                                    <span className="text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                                      🥈 RUNNER-UP
                                    </span>
                                  ) : rank === 3 ? (
                                    <span className="text-amber-600 font-extrabold uppercase text-[10px] tracking-wider">
                                      🥉 THIRD PLACE
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[10px] uppercase">
                                      PARTICIPANT
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================= */}
      {/* CONTEST MODAL / BOTTOM SHEET */}
      {/* ========================================================= */}
      {showContestForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in overflow-hidden">
          <div className="w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            {/* Sticky Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-400">
                    {editingContest ? 'Edit Voting Contest' : 'New Voting Contest'}
                  </h4>
                  <p className="text-[10px] text-slate-400">Configure campaign dates, limits & cash rewards</p>
                </div>
                {isFormDirty && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Unsaved
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelContestForm}
                  disabled={isSavingContest}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <form id="contest-editor-form" onSubmit={handleContestSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contest Title *</label>
                  <input
                    type="text"
                    required
                    value={contestForm.title}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, title: e.target.value }));
                    }}
                    placeholder="e.g. Best Telegram Creator of July"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <select
                    value={contestForm.status}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, status: e.target.value as Contest['status'] }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="active">Active (Voting Open)</option>
                    <option value="paused">Paused</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={2}
                    value={contestForm.description}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, description: e.target.value }));
                    }}
                    placeholder="Provide description of the contest, categories, and criteria..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Schedule Dates */}
                <div className="space-y-3 md:col-span-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-850">
                  <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wider block">
                    Campaign Registration Schedule
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Registration opens automatically on the Start Date & Time. Registration remains open until you manually click "Start Voting".
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Registration Start Date *</label>
                      <input
                        type="date"
                        required
                        value={contestForm.registrationStartDate}
                        onChange={e => {
                          setIsFormDirty(true);
                          setContestForm(prev => ({ ...prev, registrationStartDate: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Registration Start Time *</label>
                      <input
                        type="time"
                        required
                        value={contestForm.registrationStartTime}
                        onChange={e => {
                          setIsFormDirty(true);
                          setContestForm(prev => ({ ...prev, registrationStartTime: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Rules */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Eligibility Rules
                  </label>
                  <input
                    type="text"
                    value={contestForm.rules}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, rules: e.target.value }));
                    }}
                    placeholder="e.g. Accounts must be 5+ days old. 1 vote per user per 24 hours."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Max votes per user */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Max Votes / User
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={contestForm.maxVotesPerUser}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, maxVotesPerUser: parseInt(e.target.value) || 1 }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Vote Interval Hours */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Vote Cooldown (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={contestForm.voteIntervalHours}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, voteIntervalHours: parseInt(e.target.value) || 0 }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Cash Rewards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-sky-400" />
                    Voter Cash Bonus (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contestForm.voterRewardAmount}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, voterRewardAmount: parseFloat(e.target.value) || 0 }));
                    }}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Winner Cash Reward (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contestForm.winnerRewardAmount}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestForm(prev => ({ ...prev, winnerRewardAmount: parseFloat(e.target.value) || 0 }));
                    }}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Banner Cover Image */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Banner Cover Image
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'contest')}
                      className="hidden"
                      id="contest-banner-uploader"
                    />
                    <label
                      htmlFor="contest-banner-uploader"
                      className="cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition shrink-0"
                    >
                      Upload File
                    </label>
                    <input
                      type="text"
                      value={contestForm.imageUrl}
                      onChange={e => {
                        setIsFormDirty(true);
                        setContestForm(prev => ({ ...prev, imageUrl: e.target.value }));
                      }}
                      placeholder="Or paste cover image URL..."
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 w-full"
                    />
                  </div>
                  {contestForm.imageUrl && (
                    <div className="w-full max-h-36 rounded-xl overflow-hidden border border-slate-800 mt-2 bg-slate-950 flex items-center justify-center">
                      <img
                        src={contestForm.imageUrl}
                        alt="Preview"
                        className="max-h-36 object-cover"
                        referrerPolicy="no-referrer"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Sticky Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-400 hidden sm:block">
                {isFormDirty ? (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    ⚠️ You have unsaved changes
                  </span>
                ) : (
                  <span className="text-slate-500">Ready to save</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCancelContestForm}
                  disabled={isSavingContest}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleContestSubmit()}
                  disabled={isSavingContest}
                  className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/10 cursor-pointer"
                >
                  {isSavingContest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3px]" />
                      <span>{editingContest ? 'Save Changes' : 'Launch Contest'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONTESTANT MODAL / BOTTOM SHEET */}
      {/* ========================================================= */}
      {showContestantForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in overflow-hidden">
          <div className="w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            {/* Sticky Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-400">
                    {editingContestant ? `Edit Contestant: ${editingContestant.name}` : 'Add New Contestant'}
                  </h4>
                  <p className="text-[10px] text-slate-400">Participant info & initial vote allocation</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelContestantForm}
                  disabled={isSavingContestant}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <form id="contestant-editor-form" onSubmit={handleContestantSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Contest */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Contest *</label>
                  <select
                    required
                    value={contestantForm.contestId}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, contestId: e.target.value }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="" disabled>
                      Select associated contest...
                    </option>
                    {contests.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
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
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, name: e.target.value }));
                    }}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Telegram ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Telegram User ID
                  </label>
                  <input
                    type="text"
                    value={contestantForm.telegramId}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, telegramId: e.target.value }));
                    }}
                    placeholder="e.g. 123456789"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Telegram Username */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Telegram Username
                  </label>
                  <input
                    type="text"
                    value={contestantForm.username}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({
                        ...prev,
                        username: e.target.value.startsWith('@') ? e.target.value : `@${e.target.value}`
                      }));
                    }}
                    placeholder="e.g. @ramesh_tg"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Initial Votes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Votes Count</label>
                  <input
                    type="number"
                    min="0"
                    value={contestantForm.votesCount}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, votesCount: parseInt(e.target.value) || 0 }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Entry Biography */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Biography / Pitch</label>
                  <textarea
                    rows={2}
                    value={contestantForm.description}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, description: e.target.value }));
                    }}
                    placeholder="e.g. Creator pitching for creator fund..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entry Status</label>
                  <select
                    value={contestantForm.status}
                    onChange={e => {
                      setIsFormDirty(true);
                      setContestantForm(prev => ({ ...prev, status: e.target.value as Contestant['status'] }));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="approved">Approved (Active in Contest)</option>
                    <option value="pending">Pending Admin Approval</option>
                    <option value="rejected">Rejected / Suspended</option>
                  </select>
                </div>

                {/* Photo Upload */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" /> Profile Photo
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'contestant')}
                      className="hidden"
                      id="contestant-photo-uploader"
                    />
                    <label
                      htmlFor="contestant-photo-uploader"
                      className="cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition shrink-0"
                    >
                      Upload File
                    </label>
                    <input
                      type="text"
                      value={contestantForm.imageUrl}
                      onChange={e => {
                        setIsFormDirty(true);
                        setContestantForm(prev => ({ ...prev, imageUrl: e.target.value }));
                      }}
                      placeholder="Or paste profile image URL..."
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500 w-full"
                    />
                  </div>
                  {contestantForm.imageUrl && (
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-800 mt-2 bg-slate-950 flex items-center justify-center">
                      <img
                        src={contestantForm.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Sticky Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-400 hidden sm:block">
                {isFormDirty ? (
                  <span className="text-amber-400 font-medium">⚠️ Unsaved changes</span>
                ) : (
                  <span className="text-slate-500">Ready</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCancelContestantForm}
                  disabled={isSavingContestant}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleContestantSubmit()}
                  disabled={isSavingContestant}
                  className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/10 cursor-pointer"
                >
                  {isSavingContestant ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3px]" />
                      <span>{editingContestant ? 'Save Info' : 'Approve Contestant'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
