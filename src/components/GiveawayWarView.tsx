import React, { useState, useEffect } from 'react';
import {
  Swords,
  Trophy,
  ShieldAlert,
  BarChart3,
  Users,
  Play,
  Pause,
  Plus,
  Coins,
  Medal,
  Award,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Flame,
  UserCheck,
  RotateCcw,
  Check,
  ShieldCheck,
  RefreshCw,
  FileText,
  Lock,
  Download,
  Share2,
  Copy,
  Trash2,
  Printer,
  ChevronRight,
  TrendingUp,
  Target,
  Gift,
  Dices,
  HelpCircle,
  Activity,
  RotateCw,
  Tv,
  ListOrdered,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  AdminConfig,
  GiveawayWar,
  WarMember,
  WarTeam,
  WarActivityLog,
  WarPointRules,
  WarRewardConfig,
  WarChallenge,
  WarSecretMission,
  WarAirdrop,
  WarTimelineEvent,
  WarPendingReward
} from '../types';
import {
  getGiveawayWars,
  getGiveawayWarById,
  saveGiveawayWar,
  updateWarStatus,
  joinWarTeam,
  getWarMembers,
  getWarMemberByTelegramId,
  addWarPointsForActivity,
  getWarActivityLogs,
  endGiveawayWar,
  resetWarTeamScores,
  resetWarUserContributions,
  resetEntireWar,
  resetUserWarTeam,
  awardDailyMvp,
  exportWarDataCSV,
  getTeamAchievementBadge,
  activatePointBooster,
  getHallOfFameWars,
  createWarChallenge,
  createWarSecretMission,
  triggerWarAirdrop,
  triggerSurpriseBooster,
  spinDailyWarWheel,
  getAdvancedWarStats,
  calculateFairPlayScore,
  claimPendingReward,
  recordWarTimelineEvent,
  DEFAULT_POINT_RULES,
  DEFAULT_REWARD_CONFIG
} from '../services/giveawayWarService';

interface GiveawayWarViewProps {
  config: AdminConfig;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const GiveawayWarView: React.FC<GiveawayWarViewProps> = ({ config, showToast }) => {
  const [activeTab, setActiveTab] = useState<'arena' | 'admin' | 'analytics' | 'antifraud' | 'results' | 'halloffame'>('arena');
  const [wars, setWars] = useState<GiveawayWar[]>([]);
  const [hallOfFameWars, setHallOfFameWars] = useState<GiveawayWar[]>([]);
  const [selectedWarId, setSelectedWarId] = useState<string>('');
  const [activeWar, setActiveWar] = useState<GiveawayWar | null>(null);
  const [members, setMembers] = useState<WarMember[]>([]);
  const [logs, setLogs] = useState<WarActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Phase 3 Booster Activator State
  const [boosterDuration, setBoosterDuration] = useState<number>(60); // 60 mins
  const [boosterMultiplier, setBoosterMultiplier] = useState<number>(2); // 2x

  // Leaderboard Category Filter State
  const [leaderboardCategory, setLeaderboardCategory] = useState<'contributors' | 'inviters' | 'voters' | 'feedbacks'>('contributors');

  // Phase 4 Modals & Feature States
  const [showClaimCenterModal, setShowClaimCenterModal] = useState<boolean>(false);
  const [showSpinWheelModal, setShowSpinWheelModal] = useState<boolean>(false);
  const [showEventReplayModal, setShowEventReplayModal] = useState<boolean>(false);
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState<boolean>(false);
  const [showCreateSecretMissionModal, setShowCreateSecretMissionModal] = useState<boolean>(false);
  const [showAirdropModal, setShowAirdropModal] = useState<boolean>(false);

  // Wheel Spin State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinOutcome, setSpinOutcome] = useState<any>(null);

  // Advanced Stats State
  const [advancedStats, setAdvancedStats] = useState<any>(null);

  // Challenge Form State
  const [chTitle, setChTitle] = useState<string>('⚡ Referral Race 500');
  const [chTargetType, setChTargetType] = useState<'referrals' | 'votes' | 'feedbacks' | 'points'>('referrals');
  const [chTargetCount, setChTargetCount] = useState<number>(50);
  const [chBonusPoints, setChBonusPoints] = useState<number>(100);

  // Secret Mission Form State
  const [smTitle, setSmTitle] = useState<string>('🕵️ Top Ambassador Task');
  const [smDesc, setSmDesc] = useState<string>('Refer 15 active users to unlock secret surprise bonus!');
  const [smTargetType, setSmTargetType] = useState<'referrals' | 'votes' | 'feedbacks' | 'points'>('referrals');
  const [smTargetCount, setSmTargetCount] = useState<number>(15);
  const [smRewardAmount, setSmRewardAmount] = useState<number>(100);
  const [smRewardType, setSmRewardType] = useState<'points' | 'wallet'>('points');

  // AirDrop Form State
  const [airdropAmount, setAirdropAmount] = useState<number>(50);
  const [airdropType, setAirdropType] = useState<'points' | 'wallet'>('points');
  const [airdropCount, setAirdropCount] = useState<number>(3);

  // User Simulator / Current User State
  const [currentUserTgId, setCurrentUserTgId] = useState<string>(config.adminTelegramId || '123456789');
  const [currentUserName, setCurrentUserName] = useState<string>('Roy Warrior');
  const [currentMember, setCurrentMember] = useState<WarMember | null>(null);
  const [isJoiningTeam, setIsJoiningTeam] = useState<boolean>(false);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  // Single User Team Reset Input
  const [userResetTgId, setUserResetTgId] = useState<string>('');

  // Admin Creator Form State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingWarId, setEditingWarId] = useState<string | null>(null);
  const [warForm, setWarForm] = useState<{
    title: string;
    bannerUrl: string;
    description: string;
    rules: string;
    prizePool: number;
    totalTeams: number;
    teams: WarTeam[];
    pointRules: WarPointRules;
    rewards: WarRewardConfig;
  }>({
    title: '⚔️ Ultimate Share War 2026',
    bannerUrl: '',
    description: 'Join Team Red or Team Blue! Complete daily tasks, referrals, and votes to earn points for your team and claim the ₹500 prize pool!',
    rules: '1. Choose 1 team (locked after joining).\n2. Complete verified votes, referrals & tasks to earn points.\n3. Fake referrals & duplicate votes will be disqualified.',
    prizePool: 500,
    totalTeams: 2,
    teams: [
      { id: 'team_red', name: '🔴 Team Red', color: '#EF4444', score: 0, membersCount: 0, maxMembers: 50 },
      { id: 'team_blue', name: '🔵 Team Blue', color: '#3B82F6', score: 0, membersCount: 0, maxMembers: 50 }
    ],
    pointRules: { ...DEFAULT_POINT_RULES },
    rewards: { ...DEFAULT_REWARD_CONFIG }
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<'scores' | 'contrib' | 'entire' | null>(null);

  // Quick Point Simulator State
  const [simActivity, setSimActivity] = useState<
    'registration' | 'referral' | 'verified_vote' | 'feedback' | 'daily_login' | 'wallet_task'
  >('verified_vote');

  // Load Wars on Mount
  useEffect(() => {
    loadAllWars();
  }, []);

  // Reload data when selected war changes
  useEffect(() => {
    if (selectedWarId) {
      loadWarData(selectedWarId);
    }
  }, [selectedWarId, currentUserTgId]);

  const loadAllWars = async () => {
    setIsLoading(true);
    try {
      const list = await getGiveawayWars();
      setWars(list);
      if (list.length > 0) {
        const liveWar = list.find((w) => w.status === 'live') || list[0];
        setSelectedWarId(liveWar.id);
      }
      const hof = await getHallOfFameWars();
      setHallOfFameWars(hof);
    } catch (err: any) {
      showToast('Error loading Giveaway Wars: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 3: Activate Double Point Booster
  const handleActivateBooster = async () => {
    if (!selectedWarId) return;
    try {
      const res = await activatePointBooster(selectedWarId, boosterDuration, {
        multiplier: boosterMultiplier,
        boostReferrals: true,
        boostVotes: true,
        boostFeedbacks: true
      });
      if (res.success) {
        showToast(res.message, 'success');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error activating booster: ' + err.message, 'error');
    }
  };

  // Phase 3: Download High-Res PNG Winner Poster via Canvas
  const handleDownloadWinnerPoster = (war: GiveawayWar) => {
    const sortedTeams = [...war.teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winningTeam = sortedTeams[0];
    const top5 = members.slice(0, 5);

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gradient Canvas Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Decorative Glows
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.beginPath();
    ctx.arc(540, 300, 280, 0, Math.PI * 2);
    ctx.fill();

    // Headers
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ ROY SHARE GIVEAWAY WAR ⚔️', 540, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px sans-serif';
    ctx.fillText(war.title.toUpperCase(), 540, 185);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 26px sans-serif';
    ctx.fillText('OFFICIAL CHAMPIONSHIP POSTER & RESULTS', 540, 235);

    // Winning Team Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(140, 280, 800, 240, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 34px sans-serif';
    ctx.fillText('🏆 WINNING TEAM CHAMPIONS 🏆', 540, 340);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 60px sans-serif';
    ctx.fillText(winningTeam ? winningTeam.name : 'CHAMPION TEAM', 540, 425);

    ctx.fillStyle = '#10b981';
    ctx.font = '800 34px sans-serif';
    ctx.fillText(`TOTAL TEAM SCORE: ${winningTeam ? winningTeam.score : 0} PTS`, 540, 485);

    // MVP Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(140, 550, 800, 200, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.font = '900 30px sans-serif';
    ctx.fillText('👑 MOST VALUABLE PLAYER (MVP) 👑', 540, 605);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.fillText(war.mvpUserName || (mvpMember ? mvpMember.name : 'N/A'), 540, 670);

    ctx.fillStyle = '#e9d5ff';
    ctx.font = '700 26px sans-serif';
    ctx.fillText(`CONTRIBUTION: ${war.mvpUserPoints || (mvpMember ? mvpMember.points : 0)} POINTS`, 540, 715);

    // Top Contributors Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(140, 780, 800, 380, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 28px sans-serif';
    ctx.fillText('🌟 TOP WAR CONTRIBUTORS 🌟', 540, 830);

    top5.forEach((c, idx) => {
      const y = 890 + idx * 52;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${medal} #${idx + 1}  ${c.name} (${c.teamName})`, 180, y);

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(`${c.points} Pts`, 900, y);
    });

    // Branding Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 22px sans-serif';
    ctx.fillText('ROY SHARE WALLET • OFFICIAL GIVEAWAY WAR SYSTEM', 540, 1280);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Giveaway_War_Winner_Poster_${war.id}.png`;
    link.href = dataUrl;
    link.click();
    showToast('🖼️ Winner Poster PNG downloaded successfully!', 'success');
  };

  const loadWarData = async (warId: string) => {
    setIsRefreshing(true);
    try {
      const warData = await getGiveawayWarById(warId);
      setActiveWar(warData);

      if (warData) {
        const warMembers = await getWarMembers(warId);
        setMembers(warMembers);

        const warLogs = await getWarActivityLogs(warId);
        setLogs(warLogs);

        const myMember = await getWarMemberByTelegramId(warId, currentUserTgId);
        setCurrentMember(myMember);

        // Load Advanced Statistics
        const adv = await getAdvancedWarStats(warId);
        setAdvancedStats(adv);

        if (warData.status === 'ended') {
          setActiveTab('results');
        }
      }
    } catch (err: any) {
      console.error('Error loading war details:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Phase 4 Handlers
  const handleCreateChallenge = async () => {
    if (!selectedWarId) return;
    try {
      const res = await createWarChallenge(selectedWarId, {
        title: chTitle,
        targetType: chTargetType,
        targetCount: chTargetCount,
        bonusPoints: chBonusPoints
      });
      if (res.success) {
        showToast(res.message, 'success');
        setShowCreateChallengeModal(false);
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error creating challenge: ' + err.message, 'error');
    }
  };

  const handleCreateSecretMission = async () => {
    if (!selectedWarId) return;
    try {
      const res = await createWarSecretMission(selectedWarId, {
        title: smTitle,
        description: smDesc,
        targetType: smTargetType,
        targetCount: smTargetCount,
        rewardAmount: smRewardAmount,
        rewardType: smRewardType
      });
      if (res.success) {
        showToast(res.message, 'success');
        setShowCreateSecretMissionModal(false);
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error creating secret mission: ' + err.message, 'error');
    }
  };

  const handleTriggerAirdrop = async () => {
    if (!selectedWarId) return;
    try {
      const res = await triggerWarAirdrop(selectedWarId, {
        amount: airdropAmount,
        rewardType: airdropType,
        count: airdropCount
      });
      if (res.success) {
        showToast(res.message, 'success');
        setShowAirdropModal(false);
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error triggering AirDrop: ' + err.message, 'error');
    }
  };

  const handleTriggerSurpriseBoosterAction = async () => {
    if (!selectedWarId) return;
    try {
      const res = await triggerSurpriseBooster(selectedWarId);
      if (res.success) {
        showToast(res.message, 'success');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error triggering surprise booster: ' + err.message, 'error');
    }
  };

  const handleSpinWheel = async () => {
    if (!selectedWarId || !currentUserTgId) return;
    setIsSpinning(true);
    setSpinOutcome(null);

    // Simulated wheel rotation delay
    setTimeout(async () => {
      try {
        const res = await spinDailyWarWheel(selectedWarId, currentUserTgId);
        setIsSpinning(false);
        if (res.success) {
          setSpinOutcome(res.outcome);
          showToast(res.message, 'success');
          await loadWarData(selectedWarId);
        } else {
          showToast(res.message, 'error');
        }
      } catch (err: any) {
        setIsSpinning(false);
        showToast('Error spinning wheel: ' + err.message, 'error');
      }
    }, 1500);
  };

  const handleClaimRewardItem = async (rewardId: string) => {
    if (!selectedWarId || !currentUserTgId) return;
    try {
      const res = await claimPendingReward(selectedWarId, currentUserTgId, rewardId);
      if (res.success) {
        showToast(res.message, 'success');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error claiming reward: ' + err.message, 'error');
    }
  };

  // Handle Joining Team
  const handleJoinTeam = async (teamId: string) => {
    if (!selectedWarId || !activeWar) return;
    setIsJoiningTeam(true);
    try {
      const res = await joinWarTeam(
        selectedWarId,
        {
          telegramId: currentUserTgId,
          name: currentUserName,
          username: 'warrior_' + currentUserTgId.slice(-4)
        },
        teamId
      );

      if (res.success) {
        showToast(res.message, 'success');
        await loadWarData(selectedWarId);
        await loadAllWars();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Failed to join team: ' + err.message, 'error');
    } finally {
      setIsJoiningTeam(false);
    }
  };

  // Handle Simulating Point Addition for current user
  const handleSimulatePoints = async () => {
    if (!selectedWarId || !currentUserTgId) {
      showToast('Select a war and user first', 'error');
      return;
    }

    try {
      const res = await addWarPointsForActivity({
        telegramId: currentUserTgId,
        activityType: simActivity,
        description: `Completed ${simActivity} activity`
      });

      if (res.success && res.pointsEarned > 0) {
        showToast(`🎉 Earned +${res.pointsEarned} points for ${simActivity}!`, 'success');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message || 'Points could not be added (check anti-fraud rules)', 'info');
      }
    } catch (err: any) {
      showToast('Error adding points: ' + err.message, 'error');
    }
  };

  // Copy Team Referral Link
  const handleCopyInviteLink = (teamId: string) => {
    if (!activeWar) return;
    const botUser = config.botUsername || 'RoyShareWalletBot';
    const link = `https://t.me/${botUser}?start=war_${activeWar.id}_team_${teamId}_ref_${currentUserTgId}`;
    navigator.clipboard.writeText(link);
    setCopiedInvite(true);
    showToast('📋 Team Referral Link copied to clipboard!', 'success');
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  // Save or Create War
  const handleSaveWarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warForm.title.trim()) {
      showToast('Please enter an Event Title', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<GiveawayWar> = {
        id: isEditing && editingWarId ? editingWarId : undefined,
        title: warForm.title,
        bannerUrl: warForm.bannerUrl,
        description: warForm.description,
        rules: warForm.rules,
        prizePool: Number(warForm.prizePool) || 0,
        totalTeams: warForm.teams.length,
        teams: warForm.teams,
        pointRules: warForm.pointRules,
        rewards: warForm.rewards,
        status: isEditing && activeWar ? activeWar.status : 'draft'
      };

      const warId = await saveGiveawayWar(payload);
      showToast(isEditing ? 'Giveaway War updated!' : 'New Giveaway War created!', 'success');

      setIsEditing(false);
      setEditingWarId(null);
      await loadAllWars();
      setSelectedWarId(warId);
      setActiveTab('arena');
    } catch (err: any) {
      showToast('Error saving Giveaway War: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Change (Start, Pause)
  const handleStatusChange = async (newStatus: GiveawayWar['status']) => {
    if (!selectedWarId) return;
    try {
      const success = await updateWarStatus(selectedWarId, newStatus);
      if (success) {
        showToast(`War status updated to "${newStatus.toUpperCase()}"`, 'success');
        await loadAllWars();
        await loadWarData(selectedWarId);
      } else {
        showToast('Failed to update war status', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // End War Execution
  const handleConfirmEndWar = async () => {
    if (!selectedWarId) return;
    try {
      const res = await endGiveawayWar(selectedWarId);
      if (res.success) {
        showToast(res.message, 'success');
        setShowEndConfirmModal(false);
        await loadAllWars();
        await loadWarData(selectedWarId);
        setActiveTab('results');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error ending war: ' + err.message, 'error');
    }
  };

  // Reset Handlers
  const handleExecuteReset = async () => {
    if (!selectedWarId || !showResetConfirmModal) return;
    try {
      let res = { success: false, message: '' };
      if (showResetConfirmModal === 'scores') {
        res = await resetWarTeamScores(selectedWarId);
      } else if (showResetConfirmModal === 'contrib') {
        res = await resetWarUserContributions(selectedWarId);
      } else if (showResetConfirmModal === 'entire') {
        res = await resetEntireWar(selectedWarId);
      }

      if (res.success) {
        showToast(res.message, 'success');
        setShowResetConfirmModal(null);
        await loadAllWars();
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Reset failed: ' + err.message, 'error');
    }
  };

  // Reset Single User Lock
  const handleResetSingleUser = async () => {
    if (!selectedWarId || !userResetTgId.trim()) {
      showToast('Enter a valid Telegram ID', 'error');
      return;
    }
    try {
      const res = await resetUserWarTeam(selectedWarId, userResetTgId.trim());
      if (res.success) {
        showToast(res.message, 'success');
        setUserResetTgId('');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('User reset error: ' + err.message, 'error');
    }
  };

  // Award Daily MVP
  const handleAwardDailyMvp = async () => {
    if (!selectedWarId) return;
    try {
      const res = await awardDailyMvp(selectedWarId);
      if (res.success) {
        showToast(res.message, 'success');
        await loadWarData(selectedWarId);
      } else {
        showToast(res.message, 'info');
      }
    } catch (err: any) {
      showToast('Daily MVP error: ' + err.message, 'error');
    }
  };

  // Download CSV Export
  const handleExportCSV = async (type: 'teams' | 'members' | 'contributions' | 'rewards') => {
    if (!selectedWarId) return;
    try {
      const csvContent = await exportWarDataCSV(selectedWarId, type);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GiveawayWar_${type}_${selectedWarId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${type.toUpperCase()} report successfully!`, 'success');
    } catch (err: any) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  // Prepare Edit Form
  const handleOpenEdit = (war: GiveawayWar) => {
    setEditingWarId(war.id);
    setIsEditing(true);
    setWarForm({
      title: war.title,
      bannerUrl: war.bannerUrl || '',
      description: war.description,
      rules: war.rules,
      prizePool: war.prizePool,
      totalTeams: war.teams.length,
      teams: war.teams,
      pointRules: war.pointRules || { ...DEFAULT_POINT_RULES },
      rewards: war.rewards || { ...DEFAULT_REWARD_CONFIG }
    });
    setActiveTab('admin');
  };

  // Print Results
  const handlePrintResults = () => {
    window.print();
  };

  // Total War Score Sum
  const totalWarScoreSum = (activeWar?.teams || []).reduce((sum, t) => sum + (t.score || 0), 0);

  // MVP Calculation
  const sortedMembers = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));
  const mvpMember = sortedMembers[0] || null;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-gradient-to-br from-red-500/10 via-amber-500/10 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 animate-pulse text-red-500" />
              Event Module Phase 2
            </span>
            {activeWar && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                  activeWar.status === 'live'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                    : activeWar.status === 'ended'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                ● {activeWar.status}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Swords className="w-8 h-8 text-amber-400 shrink-0" />
            <span>Giveaway War System ⚔️</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Team Lock, Capacity Limits, Live Team Milestones, Achievement Badges, Daily MVP, Anti-Abuse Shield, and Automated Results.
          </p>
        </div>

        {/* War Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {wars.length > 0 && (
            <select
              value={selectedWarId}
              onChange={(e) => setSelectedWarId(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {wars.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} ({w.status.toUpperCase()})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => loadWarData(selectedWarId)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Phase 4 Quick Action Buttons */}
          <button
            onClick={() => setShowSpinWheelModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Dices className="w-4 h-4 text-amber-400" />
            <span>Lucky Spin</span>
          </button>

          <button
            onClick={() => setShowClaimCenterModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5 relative"
          >
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Claim Rewards</span>
            {currentMember?.pendingRewards && currentMember.pendingRewards.filter((r) => !r.isClaimed).length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center -top-1 -right-1 shadow-md">
                {currentMember.pendingRewards.filter((r) => !r.isClaimed).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowEventReplayModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-400 border border-purple-500/30 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Tv className="w-4 h-4 text-purple-400" />
            <span>Event Replay</span>
          </button>

          <button
            onClick={() => {
              setIsEditing(false);
              setEditingWarId(null);
              setWarForm({
                title: '⚔️ New Giveaway War 2026',
                bannerUrl: '',
                description: 'Join Team Red or Team Blue and battle for the victory prize!',
                rules: '1. Select 1 team.\n2. Complete daily activities.\n3. Fair play strictly enforced.',
                prizePool: 1000,
                totalTeams: 2,
                teams: [
                  { id: 'team_red', name: '🔴 Team Red', color: '#EF4444', score: 0, membersCount: 0, maxMembers: 100 },
                  { id: 'team_blue', name: '🔵 Team Blue', color: '#3B82F6', score: 0, membersCount: 0, maxMembers: 100 }
                ],
                pointRules: { ...DEFAULT_POINT_RULES },
                rewards: { ...DEFAULT_REWARD_CONFIG }
              });
              setActiveTab('admin');
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New War</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('arena')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'arena'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>War Arena</span>
        </button>

        {activeWar?.status === 'ended' && (
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'results'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>🏆 War Results</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Live Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('antifraud')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'antifraud'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Anti-Abuse & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('halloffame')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'halloffame'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>🏛️ Hall of Fame</span>
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'admin'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Admin & Settings</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: WAR ARENA (USER VIEW) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'arena' && (
        <div className="space-y-6">
          {activeWar ? (
            <>
              {/* Event Banner & Overview Card */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" />
                        Prize Pool: ₹{activeWar.prizePool}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold">
                        👥 {activeWar.totalParticipants || members.length} Total Warriors
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white">{activeWar.title}</h2>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {activeWar.description}
                    </p>
                  </div>

                  {/* Simulator Controls */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 w-full md:w-80 shrink-0">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>👤 Simulator User</span>
                      <span className="text-amber-400">Tg ID: {currentUserTgId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentUserName}
                        onChange={(e) => setCurrentUserName(e.target.value)}
                        className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 w-1/2 focus:outline-none"
                        placeholder="User Name"
                      />
                      <input
                        type="text"
                        value={currentUserTgId}
                        onChange={(e) => setCurrentUserTgId(e.target.value)}
                        className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 w-1/2 focus:outline-none"
                        placeholder="Tg ID"
                      />
                    </div>

                    {currentMember ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Joined: {currentMember.teamName}</span>
                        </div>
                        <span>{currentMember.points} Pts</span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400 text-center font-medium">
                        ⚠️ Not in a team yet. Select a team below to join!
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Referral Link Banner (If joined) */}
                {currentMember && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <div className="text-xs font-black text-amber-400 flex items-center justify-center sm:justify-start gap-1.5">
                        <Share2 className="w-4 h-4" />
                        <span>Team Referral Link Active</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Share your unique team invite link. Friends joining will automatically join <strong className="text-white">{currentMember.teamName}</strong> and earn you +{activeWar.pointRules?.referralPoints || 10} referral points!
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopyInviteLink(currentMember.teamId)}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/20"
                    >
                      {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedInvite ? 'Copied!' : 'Copy Team Link'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* DOUBLE POINT BOOSTER BANNER (IF ACTIVE) */}
              {activeWar.booster && activeWar.booster.isActive && (
                <div className="p-5 rounded-3xl bg-gradient-to-r from-red-600/20 via-amber-500/20 to-orange-600/20 border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                      <Zap className="w-6 h-6 text-slate-950 fill-slate-950" />
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-widest">
                        🔥 DOUBLE POINT BOOSTER ACTIVE ({activeWar.booster.multiplier}X MULTIPLIER)
                      </span>
                      <h4 className="text-base font-black text-white mt-0.5">
                        Earn {activeWar.booster.multiplier}x Points on Referrals, Votes & Feedbacks!
                      </h4>
                      <p className="text-xs text-slate-300">
                        Expires at: {activeWar.booster.expiresAt ? new Date(activeWar.booster.expiresAt).toLocaleTimeString() : 'Active'}
                      </p>
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0">
                    ⚡ {activeWar.booster.multiplier}x Multiplier LIVE
                  </span>
                </div>
              )}

              {/* DAILY MVP BANNER */}
              {activeWar.dailyMvpHistory && activeWar.dailyMvpHistory.length > 0 && (
                <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-6 h-6 text-amber-400 animate-spin-slow" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        👑 Latest Daily MVP Winner
                      </span>
                      <h4 className="text-base font-black text-white">
                        {activeWar.dailyMvpHistory[activeWar.dailyMvpHistory.length - 1].name} ({activeWar.dailyMvpHistory[activeWar.dailyMvpHistory.length - 1].teamName})
                      </h4>
                      <p className="text-xs text-slate-400">
                        Earned {activeWar.dailyMvpHistory[activeWar.dailyMvpHistory.length - 1].points} Pts today • Rewarded ₹{activeWar.dailyMvpHistory[activeWar.dailyMvpHistory.length - 1].rewardAmount}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAwardDailyMvp}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition"
                  >
                    Refresh Daily MVP
                  </button>
                </div>
              )}

              {/* LIVE TEAMS & CAPACITY GRID */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Swords className="w-5 h-5 text-amber-400" />
                    <span>Choose / View Teams & Achievements</span>
                  </h3>
                  <span className="text-xs text-slate-400">Team choice is locked once selected</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeWar.teams.map((team) => {
                    const isMyTeam = currentMember?.teamId === team.id;
                    const badgeInfo = getTeamAchievementBadge(team.score || 0);
                    const isFull = team.maxMembers && team.maxMembers > 0 && (team.membersCount || 0) >= team.maxMembers;
                    const pctOfWar = totalWarScoreSum > 0 ? Math.round(((team.score || 0) / totalWarScoreSum) * 100) : 50;

                    return (
                      <div
                        key={team.id}
                        className={`p-6 rounded-3xl bg-slate-900 border transition-all relative overflow-hidden space-y-5 ${
                          isMyTeam
                            ? 'border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-md"
                              style={{ backgroundColor: team.color || '#3B82F6' }}
                            >
                              {team.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-black text-white">{team.name}</h4>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700 flex items-center gap-1">
                                  <span>{badgeInfo.icon}</span>
                                  <span>{badgeInfo.name}</span>
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                👥 {team.membersCount || 0} / {team.maxMembers || '∞'} Members
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-2xl font-black text-amber-400">{team.score || 0}</span>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Total Points</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-400">War Dominance</span>
                            <span className="text-white">{pctOfWar}%</span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pctOfWar}%`,
                                backgroundColor: team.color || '#3B82F6'
                              }}
                            />
                          </div>
                        </div>

                        {/* Team Shared Wallet Balance */}
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                            <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Team Wallet Pool:</span>
                          </div>
                          <span className="text-base font-black text-emerald-300">
                            💰 ₹{team.teamWalletBalance || 0}
                          </span>
                        </div>

                        {/* Active Team Missions (If configured) */}
                        {activeWar.missions && activeWar.missions.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                              <span className="flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" />
                                <span>Team Missions</span>
                              </span>
                              <span className="text-[10px] text-slate-400">Shared Objectives</span>
                            </div>
                            <div className="space-y-1.5">
                              {activeWar.missions.slice(0, 2).map((m) => {
                                let curr = 0;
                                if (m.targetType === 'referrals') curr = team.totalReferrals || 0;
                                if (m.targetType === 'votes') curr = team.totalVerifiedVotes || 0;
                                if (m.targetType === 'feedbacks') curr = team.totalFeedbacks || 0;
                                if (m.targetType === 'activities') curr = (team.totalReferrals || 0) + (team.totalVerifiedVotes || 0) + (team.totalFeedbacks || 0);

                                const mPct = Math.min(100, Math.round((curr / m.targetCount) * 100));

                                return (
                                  <div key={m.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-semibold text-slate-200">{m.title}</span>
                                      <span className={`font-black ${m.isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {m.isCompleted ? '✅ Unlocked (+₹' + m.rewardAmount + ')' : curr + '/' + m.targetCount}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${m.isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${mPct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Team Milestones & Lucky Member */}
                        {activeWar.milestones && activeWar.milestones.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                              <span className="flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5" />
                                <span>Milestones & Lucky Members</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {activeWar.milestones.map((ms) => {
                                const isReached = (team.score || 0) >= ms.pointThreshold;
                                return (
                                  <div
                                    key={ms.id}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
                                      isReached
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    <span>{isReached ? '🎉' : '🔒'}</span>
                                    <span>{ms.pointThreshold} Pts</span>
                                    {ms.luckyWinnerName && (
                                      <span className="text-[10px] text-amber-300 font-extrabold ml-1">
                                        (Winner: {ms.luckyWinnerName})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Join / Status Action */}
                        <div>
                          {currentMember ? (
                            isMyTeam ? (
                              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs text-center flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                                <span>Joined & Locked in {team.name}</span>
                              </div>
                            ) : (
                              <div className="p-3 rounded-2xl bg-slate-800/50 text-slate-500 font-medium text-xs text-center">
                                Team choice locked in {currentMember.teamName}
                              </div>
                            )
                          ) : isFull ? (
                            <button
                              disabled
                              className="w-full py-3 rounded-2xl bg-slate-800 text-slate-500 font-bold text-xs cursor-not-allowed"
                            >
                              ⚠️ Team Capacity Full ({team.maxMembers} max)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinTeam(team.id)}
                              disabled={isJoiningTeam || activeWar.status !== 'live'}
                              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span>Join {team.name} (Lock Choice)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PERSONAL CONTRIBUTION BREAKDOWN & SIMULATOR */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Personal Contribution Breakdown */}
                <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-400" />
                      <span>My Personal Contribution Breakdown</span>
                    </h3>
                    <span className="text-xs font-black text-amber-400">
                      Total: {currentMember?.points || 0} Pts
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Registration Points', pts: currentMember?.activityBreakdown?.registration || 0, icon: '📝' },
                      { label: 'Referral Points', pts: currentMember?.activityBreakdown?.referral || 0, icon: '👥' },
                      { label: 'Verified Vote Points', pts: currentMember?.activityBreakdown?.verifiedVote || 0, icon: '✅' },
                      { label: 'Feedback Points', pts: currentMember?.activityBreakdown?.feedback || 0, icon: '💬' },
                      { label: 'Daily Login Points', pts: currentMember?.activityBreakdown?.dailyLogin || 0, icon: '📅' },
                      { label: 'Wallet Task Points', pts: currentMember?.activityBreakdown?.walletTask || 0, icon: '👛' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <span>{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        <p className="text-lg font-black text-white">{item.pts} Pts</p>
                      </div>
                    ))}
                  </div>

                  {/* Activity History Timeline */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Recent Activity History
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {logs.filter((l) => l.telegramId === currentUserTgId).length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3 text-center">
                          No activity history logged for user {currentUserTgId} yet.
                        </p>
                      ) : (
                        logs
                          .filter((l) => l.telegramId === currentUserTgId)
                          .map((log) => (
                            <div
                              key={log.id}
                              className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-white">{log.description}</p>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <span
                                className={`font-black px-2.5 py-1 rounded-lg ${
                                  log.isValid
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {log.isValid ? `+${log.pointsEarned} Pts` : 'Rejected'}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Activity Test Simulator */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-black text-white">Earn / Test Points</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Simulate point triggers for registered tasks, votes, daily login, or referrals.
                  </p>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-300 block">Select Activity</label>
                    <select
                      value={simActivity}
                      onChange={(e) => setSimActivity(e.target.value as any)}
                      className="w-full bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      <option value="verified_vote">Verified Vote (+{activeWar.pointRules?.verifiedVotePoints} Pts)</option>
                      <option value="referral">Referral (+{activeWar.pointRules?.referralPoints} Pts)</option>
                      <option value="feedback">Feedback (+{activeWar.pointRules?.feedbackPoints} Pts)</option>
                      <option value="daily_login">Daily Login (+{activeWar.pointRules?.dailyLoginPoints} Pts)</option>
                      <option value="wallet_task">Wallet Task (+{activeWar.pointRules?.walletTaskPoints} Pts)</option>
                      <option value="registration">Registration (+{activeWar.pointRules?.registrationPoints} Pts)</option>
                    </select>

                    <button
                      onClick={handleSimulatePoints}
                      disabled={!currentMember || activeWar.status !== 'live'}
                      className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Simulate Activity Trigger</span>
                    </button>

                    {!currentMember && (
                      <p className="text-[11px] text-amber-400 text-center font-medium">
                        ⚠️ Must join a team first before earning points.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PHASE 4: TEAM VS TEAM CHALLENGES & SECRET MISSIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Challenges */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Swords className="w-5 h-5 text-amber-400" />
                      <span>Team vs Team Challenges</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                      LIVE RACES
                    </span>
                  </div>

                  {!activeWar.challenges || activeWar.challenges.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400">
                      No active team challenges right now. Admin can create race challenges!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeWar.challenges.map((ch) => (
                        <div key={ch.id} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{ch.title}</span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black">
                              +{ch.bonusPoints} PTS REWARD
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            First team to reach <strong className="text-white">{ch.targetCount} {ch.targetType}</strong> wins!
                          </p>
                          <div className="flex items-center justify-between text-[11px] font-bold pt-1">
                            <span className="text-slate-400">Winning Status:</span>
                            <span className={ch.isCompleted ? 'text-emerald-400' : 'text-amber-400'}>
                              {ch.isCompleted ? `🎉 Won by ${ch.winnerTeamName}` : '⚡ Race In Progress'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Secret Missions */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Lock className="w-5 h-5 text-purple-400" />
                      <span>Secret Missions & Hidden Rewards</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/30">
                      SURPRISE
                    </span>
                  </div>

                  {!activeWar.secretMissions || activeWar.secretMissions.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400">
                      No secret missions created yet. Admin can set hidden tasks!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeWar.secretMissions.map((sm) => (
                        <div key={sm.id} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                              <span>🕵️</span>
                              <span>{sm.title}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                              {sm.rewardType === 'wallet' ? `₹${sm.rewardAmount} CASH` : `+${sm.rewardAmount} PTS`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic">
                            {sm.description || 'Complete the target to unlock secret reward!'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* TEAM INVITATION & ACTIVITY LEADERBOARDS */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span>War Leaderboards & Team Rankings</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Live standings for Top Contributors, Top Inviters, Top Voters, and Feedbacks.
                    </p>
                  </div>

                  {/* Leaderboard Category Tabs */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/80 overflow-x-auto">
                    {[
                      { id: 'contributors', label: '🔥 Contributors' },
                      { id: 'inviters', label: '👥 Top Inviters' },
                      { id: 'voters', label: '✅ Top Voters' },
                      { id: 'feedbacks', label: '💬 Feedbacks' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setLeaderboardCategory(cat.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          leaderboardCategory === cat.id
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leaderboard Table / Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Warrior</th>
                        <th className="py-3 px-4">Team</th>
                        <th className="py-3 px-4 text-right">
                          {leaderboardCategory === 'contributors' && 'Total Points'}
                          {leaderboardCategory === 'inviters' && 'Referral Points'}
                          {leaderboardCategory === 'voters' && 'Verified Vote Pts'}
                          {leaderboardCategory === 'feedbacks' && 'Feedback Pts'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {[...members]
                        .sort((a, b) => {
                          if (leaderboardCategory === 'contributors') return (b.points || 0) - (a.points || 0);
                          if (leaderboardCategory === 'inviters') return (b.activityBreakdown?.referral || 0) - (a.activityBreakdown?.referral || 0);
                          if (leaderboardCategory === 'voters') return (b.activityBreakdown?.verifiedVote || 0) - (a.activityBreakdown?.verifiedVote || 0);
                          if (leaderboardCategory === 'feedbacks') return (b.activityBreakdown?.feedback || 0) - (a.activityBreakdown?.feedback || 0);
                          return 0;
                        })
                        .slice(0, 10)
                        .map((m, idx) => {
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                          let scoreVal = m.points || 0;
                          if (leaderboardCategory === 'inviters') scoreVal = m.activityBreakdown?.referral || 0;
                          if (leaderboardCategory === 'voters') scoreVal = m.activityBreakdown?.verifiedVote || 0;
                          if (leaderboardCategory === 'feedbacks') scoreVal = m.activityBreakdown?.feedback || 0;

                          return (
                            <tr key={m.id} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 font-black text-amber-400">{medal}</td>
                              <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                                <span>{m.name}</span>
                                {m.telegramId === currentUserTgId && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-300">{m.teamName}</td>
                              <td className="py-3 px-4 text-right font-black text-emerald-400">
                                {scoreVal} Pts
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Winner Poster Download Quick Action */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Generate high-res social media image poster for results</span>
                  <button
                    onClick={() => handleDownloadWinnerPoster(activeWar)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Winner Poster (PNG)</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
              <Swords className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Active Giveaway War</h3>
              <p className="text-xs text-slate-400">Create a new Giveaway War event from the top right button.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: RESULTS PAGE (PROFESSIONAL RESULTS REPORT) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'results' && activeWar && (
        <div className="space-y-6">
          <div id="war-results-print-area" className="p-8 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-8 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="space-y-1 text-center md:text-left">
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-black uppercase tracking-widest">
                  🏆 Official Event Final Results
                </span>
                <h2 className="text-3xl font-black text-white">{activeWar.title}</h2>
                <p className="text-xs text-slate-400">
                  Ended on: {activeWar.endDate ? new Date(activeWar.endDate).toLocaleString() : 'Recently Ended'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintResults}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => handleExportCSV('rewards')}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV Report</span>
                </button>
              </div>
            </div>

            {/* PODIUM SHOWCASE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Winner Team */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-amber-500/20 to-slate-950 border border-amber-500/50 text-center space-y-3 relative overflow-hidden shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/30 border border-amber-400 flex items-center justify-center mx-auto text-3xl">
                  🏆
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Winning Team
                </span>
                <h3 className="text-xl font-black text-white">
                  {activeWar.teams.find((t) => t.id === activeWar.winnerTeamId)?.name || 'Team Winner'}
                </h3>
                <p className="text-2xl font-black text-amber-400">
                  {activeWar.teams.find((t) => t.id === activeWar.winnerTeamId)?.score || 0} Pts
                </p>
                <p className="text-xs text-emerald-400 font-bold">
                  Prize Credited: ₹{activeWar.rewards?.winningTeamReward || 0} / member
                </p>
              </div>

              {/* MVP Spotlight */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-purple-500/20 to-slate-950 border border-purple-500/50 text-center space-y-3 relative overflow-hidden shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-purple-500/30 border border-purple-400 flex items-center justify-center mx-auto text-3xl">
                  👑
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                  Overall War MVP
                </span>
                <h3 className="text-xl font-black text-white">
                  {activeWar.mvpUserName || mvpMember?.name || 'Warrior MVP'}
                </h3>
                <p className="text-2xl font-black text-purple-400">
                  {activeWar.mvpUserPoints || mvpMember?.points || 0} Pts
                </p>
                <p className="text-xs text-purple-300 font-bold">
                  Prize Credited: ₹{activeWar.rewards?.mvpReward || 0}
                </p>
              </div>

              {/* Runner Up */}
              <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-500/20 to-slate-950 border border-blue-500/50 text-center space-y-3 relative overflow-hidden shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/30 border border-blue-400 flex items-center justify-center mx-auto text-3xl">
                  🥈
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Runner Up Team
                </span>
                <h3 className="text-xl font-black text-white">
                  {activeWar.teams.find((t) => t.id !== activeWar.winnerTeamId)?.name || 'Runner Up'}
                </h3>
                <p className="text-2xl font-black text-blue-400">
                  {activeWar.teams.find((t) => t.id !== activeWar.winnerTeamId)?.score || 0} Pts
                </p>
                <p className="text-xs text-blue-300 font-bold">
                  Prize Credited: ₹{activeWar.rewards?.runnerUpReward || 0} / member
                </p>
              </div>
            </div>

            {/* TOP CONTRIBUTORS TABLE */}
            <div className="space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-400" />
                <span>Top Individual Contributors Leaderboard</span>
              </h3>

              <div className="rounded-2xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Rank</th>
                      <th className="p-3.5">Warrior Name</th>
                      <th className="p-3.5">Team</th>
                      <th className="p-3.5">Total Points</th>
                      <th className="p-3.5">Prize Rewarded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {members.slice(0, 10).map((m, idx) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5 font-black text-amber-400">#{idx + 1}</td>
                        <td className="p-3.5 font-bold">{m.name}</td>
                        <td className="p-3.5">{m.teamName}</td>
                        <td className="p-3.5 font-black">{m.points} Pts</td>
                        <td className="p-3.5 text-emerald-400 font-bold">
                          {idx === 0 ? `₹${activeWar.rewards?.topContributorReward || 0}` : 'Standard Prize'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: LIVE ANALYTICS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'analytics' && activeWar && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span>Team Scores Comparison</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeWar.teams.map((t) => ({ name: t.name, Score: t.score || 0, Members: t.membersCount || 0 }))}>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                    <Bar dataKey="Score" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span>Member Distribution</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeWar.teams.map((t) => ({ name: t.name, value: t.membersCount || 0 }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {activeWar.teams.map((t, idx) => (
                        <Cell key={idx} fill={t.color || '#3B82F6'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Advanced Statistics Section */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                <span>Phase 4 Advanced Event Statistics & Intelligence</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black border border-amber-500/20">
                REAL-TIME METRICS
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">⏰ Most Active Hour</span>
                <p className="text-lg font-black text-amber-400">{advancedStats?.mostActiveHour || 'Calculating...'}</p>
                <p className="text-[10px] text-slate-500">Peak activity time window</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">📅 Best Activity Day</span>
                <p className="text-lg font-black text-emerald-400">{advancedStats?.bestDay || 'Calculating...'}</p>
                <p className="text-[10px] text-slate-500">Highest daily points earned</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">👥 Top Referral Warrior</span>
                <p className="text-base font-black text-white truncate">{advancedStats?.highestReferralUser?.name || 'None'}</p>
                <p className="text-[11px] font-bold text-blue-400">{advancedStats?.highestReferralUser?.count || 0} Referrals</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">✅ Top Vote Contributor</span>
                <p className="text-base font-black text-white truncate">{advancedStats?.highestVoteUser?.name || 'None'}</p>
                <p className="text-[11px] font-bold text-purple-400">{advancedStats?.highestVoteUser?.count || 0} Votes</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">💬 Top Feedback Giver</span>
                <p className="text-base font-black text-white truncate">{advancedStats?.highestFeedbackUser?.name || 'None'}</p>
                <p className="text-[11px] font-bold text-rose-400">{advancedStats?.highestFeedbackUser?.count || 0} Feedbacks</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">🚀 Top Growth Team</span>
                <p className="text-base font-black text-amber-300 truncate">{advancedStats?.topGrowthTeam?.name || 'N/A'}</p>
                <p className="text-[11px] font-bold text-amber-400">{advancedStats?.topGrowthTeam?.score || 0} Points</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: ANTI-ABUSE & LOGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'antifraud' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Anti-Abuse Audit Logs & Verification</span>
              </h3>
              <p className="text-xs text-slate-400">
                Prevents duplicate daily logins, multiple accounts on 1 device, and self-referral farming.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('contributions')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Audit Report</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-slate-300 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Telegram ID</th>
                  <th className="p-3.5">Activity</th>
                  <th className="p-3.5">Points</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No logs found for this war event yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      <td className="p-3.5 font-bold">{log.telegramId}</td>
                      <td className="p-3.5 uppercase text-[10px] font-bold">{log.activityType}</td>
                      <td className="p-3.5 font-black text-amber-400">+{log.pointsEarned}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.isValid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {log.isValid ? 'Valid' : 'Rejected'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">{log.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: ADMIN CONTROLS & RESETS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          {/* Status & Resets Toolbar */}
          {activeWar && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <h3 className="text-base font-black text-white">Event Controls & Status Management</h3>
                  <p className="text-xs text-slate-400">Manage live execution status or trigger administrative actions.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeWar.status === 'draft' && (
                    <button
                      onClick={() => handleStatusChange('live')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start Giveaway War</span>
                    </button>
                  )}

                  {activeWar.status === 'live' && (
                    <button
                      onClick={() => handleStatusChange('paused')}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pause War</span>
                    </button>
                  )}

                  {activeWar.status === 'paused' && (
                    <button
                      onClick={() => handleStatusChange('live')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Resume War</span>
                    </button>
                  )}

                  {activeWar.status !== 'ended' && (
                    <button
                      onClick={() => setShowEndConfirmModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black transition flex items-center gap-2"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>🛑 End War & Pay Rewards</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ADMIN RESETS SECTION */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  <span>Admin Reset Tools</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                    <h5 className="text-xs font-bold text-white">Reset Team Scores</h5>
                    <p className="text-[11px] text-slate-400">Resets scores of all teams back to 0.</p>
                    <button
                      onClick={() => setShowResetConfirmModal('scores')}
                      className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-400 text-xs font-bold transition"
                    >
                      Reset Team Scores
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                    <h5 className="text-xs font-bold text-white">Reset User Contributions</h5>
                    <p className="text-[11px] text-slate-400">Resets points of all members to 0.</p>
                    <button
                      onClick={() => setShowResetConfirmModal('contrib')}
                      className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-400 text-xs font-bold transition"
                    >
                      Reset Member Contributions
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                    <h5 className="text-xs font-bold text-white">Reset Entire War</h5>
                    <p className="text-[11px] text-slate-400">Deletes members & clears war completely.</p>
                    <button
                      onClick={() => setShowResetConfirmModal('entire')}
                      className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold transition border border-rose-500/30"
                    >
                      Reset Entire War
                    </button>
                  </div>
                </div>

                {/* Reset Single User Team Lock */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <h5 className="text-xs font-bold text-white">Reset Single User Team Lock</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userResetTgId}
                      onChange={(e) => setUserResetTgId(e.target.value)}
                      placeholder="Enter User Telegram ID (e.g. 123456789)"
                      className="bg-slate-900 text-white text-xs px-3.5 py-2 rounded-xl border border-slate-700 w-full focus:outline-none"
                    />
                    <button
                      onClick={handleResetSingleUser}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                    >
                      Reset User Lock
                    </button>
                  </div>
                </div>

                {/* Double Point Booster Controls */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-red-600/10 via-amber-500/10 to-orange-600/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Double Point Booster Activator</span>
                    </h5>
                    {activeWar?.booster?.isActive && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                        BOOSTER LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Temporarily multiply activity points (Referrals, Votes & Feedbacks) for all warriors to boost event engagement.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 font-bold">Multiplier:</label>
                      <select
                        value={boosterMultiplier}
                        onChange={(e) => setBoosterMultiplier(Number(e.target.value))}
                        className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700"
                      >
                        <option value={2}>2x Double Points</option>
                        <option value={3}>3x Triple Points</option>
                        <option value={5}>5x Mega Multiplier</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 font-bold">Duration:</label>
                      <select
                        value={boosterDuration}
                        onChange={(e) => setBoosterDuration(Number(e.target.value))}
                        className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour</option>
                        <option value={120}>2 Hours</option>
                        <option value={360}>6 Hours</option>
                      </select>
                    </div>

                    <button
                      onClick={handleActivateBooster}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-2 ml-auto"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Trigger Point Booster</span>
                    </button>
                  </div>
                </div>

                {/* Phase 4 Admin Elite Controls */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Phase 4 Elite Event Controls</span>
                  </h5>
                  <p className="text-xs text-slate-300">
                    Launch mini challenges, hidden secret missions, instant random airdrops, or surprise multiplier boosters.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setShowCreateChallengeModal(true)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Swords className="w-4 h-4" />
                      <span>+ Team Challenge</span>
                    </button>

                    <button
                      onClick={() => setShowCreateSecretMissionModal(true)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-400 border border-purple-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Lock className="w-4 h-4" />
                      <span>+ Secret Mission</span>
                    </button>

                    <button
                      onClick={() => setShowAirdropModal(true)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Gift className="w-4 h-4 text-emerald-400" />
                      <span>🎁 Random AirDrop</span>
                    </button>

                    <button
                      onClick={handleTriggerSurpriseBoosterAction}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>⚡ Surprise Booster</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Creator / Editor */}
          <form onSubmit={handleSaveWarForm} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-lg font-black text-white">
              {isEditing ? '✏️ Edit Giveaway War Configuration' : '➕ Create New Giveaway War'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Event Title</label>
                <input
                  type="text"
                  value={warForm.title}
                  onChange={(e) => setWarForm({ ...warForm, title: e.target.value })}
                  className="w-full bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Prize Pool (₹)</label>
                <input
                  type="number"
                  value={warForm.prizePool}
                  onChange={(e) => setWarForm({ ...warForm, prizePool: Number(e.target.value) })}
                  className="w-full bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Description</label>
              <textarea
                value={warForm.description}
                onChange={(e) => setWarForm({ ...warForm, description: e.target.value })}
                rows={2}
                className="w-full bg-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700"
              />
            </div>

            {/* Teams Configuration */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-amber-400">Teams & Capacity Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warForm.teams.map((t, idx) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Team #{idx + 1}</span>
                      <input
                        type="color"
                        value={t.color || '#3B82F6'}
                        onChange={(e) => {
                          const updated = [...warForm.teams];
                          updated[idx].color = e.target.value;
                          setWarForm({ ...warForm, teams: updated });
                        }}
                        className="w-6 h-6 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => {
                        const updated = [...warForm.teams];
                        updated[idx].name = e.target.value;
                        setWarForm({ ...warForm, teams: updated });
                      }}
                      className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700"
                      placeholder="Team Name"
                    />
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Max Capacity (Members)</label>
                      <input
                        type="number"
                        value={t.maxMembers || 50}
                        onChange={(e) => {
                          const updated = [...warForm.teams];
                          updated[idx].maxMembers = Number(e.target.value);
                          setWarForm({ ...warForm, teams: updated });
                        }}
                        className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700"
                        placeholder="Max Capacity (0 = unlimited)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20"
            >
              {isSaving ? 'Saving Configuration...' : 'Save & Publish Giveaway War'}
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: HALL OF FAME & PAST WARS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'halloffame' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">🏛️ Giveaway War Hall of Fame</h2>
                <p className="text-xs text-slate-400">
                  Permanent record of all past champions, winning teams, MVPs, and distribution posters.
                </p>
              </div>
            </div>
          </div>

          {hallOfFameWars.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Completed Wars Yet</h3>
              <p className="text-xs text-slate-400">
                Completed events will appear here once an active Giveaway War is ended by Admin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hallOfFameWars.map((war) => {
                const winningTeam = war.teams ? [...war.teams].sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;

                return (
                  <div
                    key={war.id}
                    className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition space-y-5 relative overflow-hidden shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase">
                        Ended Event
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Prize: ₹{war.prizePool}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white">{war.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{war.description}</p>
                    </div>

                    {/* Winner Info Box */}
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">🏆 Champion Team</span>
                        <span className="text-sm font-black text-white">{winningTeam?.name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-amber-500/20 pt-2">
                        <span className="text-xs font-bold text-purple-400">👑 Event MVP</span>
                        <span className="text-xs font-black text-white">
                          {war.mvpUserName || 'N/A'} ({war.mvpUserPoints || 0} Pts)
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadWinnerPoster(war)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-black text-xs transition border border-slate-700 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Poster (PNG)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODALS */}
      {showEndConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4 text-center">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="text-xl font-black text-white">🛑 End Giveaway War & Pay Prizes?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This action will freeze points, calculate the Winning Team & MVP, and credit wallet prizes to winners automatically.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndWar}
                className="w-1/2 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs"
              >
                Confirm End War
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* PHASE 4 MODALS (CLAIM CENTER, LUCKY SPIN, REPLAY, ADMIN)     */}
      {/* ============================================================= */}

      {/* 1. REWARD CLAIM CENTER MODAL */}
      {showClaimCenterModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-lg w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowClaimCenterModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">🎁 Reward Claim Center</h3>
                <p className="text-xs text-slate-400">Claim your pending AirDrops, Milestones, and Secret Mission rewards</p>
              </div>
            </div>

            {!currentMember || !currentMember.pendingRewards || currentMember.pendingRewards.length === 0 ? (
              <div className="p-8 text-center bg-slate-800/40 rounded-2xl border border-slate-800 space-y-2">
                <Gift className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-white">No Pending Rewards</p>
                <p className="text-[11px] text-slate-400">Participate in team activities, spin the wheel, or complete missions to earn rewards!</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {currentMember.pendingRewards.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      item.isClaimed
                        ? 'bg-slate-800/30 border-slate-800 opacity-60'
                        : 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-black text-white">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">
                        Reward: <strong className="text-emerald-400">{item.rewardType === 'wallet' ? `₹${item.amount} CASH` : `+${item.amount} PTS`}</strong>
                      </p>
                      <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>

                    <button
                      onClick={() => handleClaimRewardItem(item.id)}
                      disabled={item.isClaimed}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                        item.isClaimed
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                      }`}
                    >
                      {item.isClaimed ? 'Claimed' : 'Claim Now'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowClaimCenterModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
            >
              Close Claim Center
            </button>
          </div>
        </div>
      )}

      {/* 2. DAILY LUCKY SPIN MODAL */}
      {showSpinWheelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/30 max-w-md w-full space-y-5 text-center relative shadow-2xl">
            <button
              onClick={() => setShowSpinWheelModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black border border-amber-500/30 uppercase">
                🎰 Free Daily Spin
              </span>
              <h3 className="text-xl font-black text-white">Daily Lucky Spin Wheel</h3>
              <p className="text-xs text-slate-400">Spin the wheel once per day to win free points, cash rewards, or boosters!</p>
            </div>

            {/* Wheel Visual */}
            <div className="relative w-48 h-48 mx-auto my-4 flex items-center justify-center">
              <div
                className={`w-44 h-44 rounded-full border-4 border-amber-500 bg-gradient-to-tr from-amber-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl transition-all duration-1000 ${
                  isSpinning ? 'animate-spin' : ''
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-slate-950 text-amber-400 font-black text-xs flex items-center justify-center shadow-inner">
                  {isSpinning ? 'SPINNING' : 'LUCKY'}
                </div>
              </div>
              <div className="absolute -top-2 text-2xl">👇</div>
            </div>

            {spinOutcome && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black animate-bounce">
                🎉 YOU WON: {spinOutcome.rewardType === 'wallet' ? `₹${spinOutcome.amount} Cash!` : `+${spinOutcome.amount} Points!`}
              </div>
            )}

            <button
              onClick={handleSpinWheel}
              disabled={isSpinning || !currentMember}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs transition shadow-xl shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Dices className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Spinning Wheel...' : 'SPIN WHEEL NOW'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. EVENT REPLAY & TIMELINE MODAL */}
      {showEventReplayModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-xl w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowEventReplayModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">🎬 Event Replay & Timeline</h3>
                <p className="text-xs text-slate-400">Chronological history of major milestones and activity triggers</p>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1 custom-scrollbar border-l-2 border-purple-500/40 pl-4">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No timeline events recorded yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="relative space-y-1">
                    <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-purple-500 border-2 border-slate-900" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{log.description}</span>
                      <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Warrior: <span className="text-purple-300 font-semibold">{log.userName}</span> (+{log.pointsEarned} Pts)
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowEventReplayModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
            >
              Close Replay
            </button>
          </div>
        </div>
      )}

      {/* 4. ADMIN CREATE TEAM CHALLENGE MODAL */}
      {showCreateChallengeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowCreateChallengeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white">⚔️ Create Team vs Team Challenge</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Challenge Title</label>
                <input
                  type="text"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Target Type</label>
                  <select
                    value={chTargetType}
                    onChange={(e) => setChTargetType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  >
                    <option value="referrals">Referrals</option>
                    <option value="votes">Verified Votes</option>
                    <option value="feedbacks">Feedbacks</option>
                    <option value="points">Total Points</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Target Count</label>
                  <input
                    type="number"
                    value={chTargetCount}
                    onChange={(e) => setChTargetCount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Bonus Reward Points</label>
                <input
                  type="number"
                  value={chBonusPoints}
                  onChange={(e) => setChBonusPoints(Number(e.target.value))}
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateChallengeModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChallenge}
                className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
              >
                Launch Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADMIN CREATE SECRET MISSION MODAL */}
      {showCreateSecretMissionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowCreateSecretMissionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white">🕵️ Create Secret Mission</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Mission Title</label>
                <input
                  type="text"
                  value={smTitle}
                  onChange={(e) => setSmTitle(e.target.value)}
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Description / Hint</label>
                <input
                  type="text"
                  value={smDesc}
                  onChange={(e) => setSmDesc(e.target.value)}
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Target Type</label>
                  <select
                    value={smTargetType}
                    onChange={(e) => setSmTargetType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  >
                    <option value="referrals">Referrals</option>
                    <option value="votes">Verified Votes</option>
                    <option value="feedbacks">Feedbacks</option>
                    <option value="points">Total Points</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Target Count</label>
                  <input
                    type="number"
                    value={smTargetCount}
                    onChange={(e) => setSmTargetCount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Reward Amount</label>
                  <input
                    type="number"
                    value={smRewardAmount}
                    onChange={(e) => setSmRewardAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Reward Type</label>
                  <select
                    value={smRewardType}
                    onChange={(e) => setSmRewardType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  >
                    <option value="points">Points</option>
                    <option value="wallet">Wallet Cash (₹)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateSecretMissionModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSecretMission}
                className="w-1/2 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs"
              >
                Save Secret Mission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADMIN TRIGGER AIRDROP MODAL */}
      {showAirdropModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowAirdropModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white">🎁 Trigger Random AirDrop</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Reward Amount per User</label>
                <input
                  type="number"
                  value={airdropAmount}
                  onChange={(e) => setAirdropAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Reward Type</label>
                  <select
                    value={airdropType}
                    onChange={(e) => setAirdropType(e.target.value as any)}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  >
                    <option value="points">Points</option>
                    <option value="wallet">Wallet Cash (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Lucky Warriors Count</label>
                  <input
                    type="number"
                    value={airdropCount}
                    onChange={(e) => setAirdropCount(Number(e.target.value))}
                    className="w-full bg-slate-800 text-white px-3.5 py-2.5 rounded-xl border border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAirdropModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerAirdrop}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
              >
                Trigger AirDrop Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
