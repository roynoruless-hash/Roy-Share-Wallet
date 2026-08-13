import React, { useState, useEffect } from 'react';
import {
  fetchTasksFromDb,
  saveTaskToDb,
  deleteTaskFromDb,
  fetchManualSubmissionsFromDb,
  fetchCampaignsFromDb,
  saveCampaignToDb,
  deleteCampaignFromDb
} from '../../services/taskService';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RefreshCw,
  CheckSquare,
  Users,
  Tv,
  Share2,
  ListTodo,
  Coins,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  ShieldCheck,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  BarChart3,
  Megaphone,
  AlertTriangle,
  Lock,
  Send
} from 'lucide-react';
import { TaskItem, ManualTaskSubmission, TaskCampaign, TaskAnalytics } from '../../types';
import { apiFetch } from '../../utils/api';

interface TasksManagerViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const TasksManagerView: React.FC<TasksManagerViewProps> = ({
  config,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'submissions' | 'channels' | 'analytics'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [submissions, setSubmissions] = useState<ManualTaskSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<TaskCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Promotion Channels states
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelChatId, setNewChannelChatId] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  // Task Publishing Modal states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingTask, setPublishingTask] = useState<TaskItem | null>(null);
  const [notifyUsersCheck, setNotifyUsersCheck] = useState(true);
  const [postChannelsCheck, setPostChannelsCheck] = useState(true);
  const [includeImageCheck, setIncludeImageCheck] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Distribution Analytics states
  const [overallStats, setOverallStats] = useState<any>(null);
  const [isLoadingOverallStats, setIsLoadingOverallStats] = useState(false);

  // Task Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState<number>(10);
  const [rewardType, setRewardType] = useState<'fixed' | 'custom'>('fixed');
  const [coins, setCoins] = useState<number>(25);
  const [verificationType, setVerificationType] = useState<'automatic' | 'manual' | 'none'>('none');
  const [icon, setIcon] = useState('CheckSquare');
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [url, setUrl] = useState('');
  const [taskImage, setTaskImage] = useState('');
  const [description, setDescription] = useState('');
  const [detailedInstructions, setDetailedInstructions] = useState('');
  const [proofDemoImage, setProofDemoImage] = useState('');
  const [privateAdminGroupChatId, setPrivateAdminGroupChatId] = useState('');
  const [telegramAdminChatId, setTelegramAdminChatId] = useState('');
  const [allowResubmission, setAllowResubmission] = useState<boolean>(true);
  const [maxResubmissions, setMaxResubmissions] = useState<number>(2);
  const [maxSubmissionsPerUser, setMaxSubmissionsPerUser] = useState<number>(1);
  const [deadlineEnabled, setDeadlineEnabled] = useState<boolean>(false);
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(1440);
  const [maxApprovedUsers, setMaxApprovedUsers] = useState<number>(0);
  const [campaignId, setCampaignId] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);

  // Campaign Form states
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campBudget, setCampBudget] = useState<number>(1000);
  const [campReward, setCampReward] = useState<number>(10);
  const [campMaxUsers, setCampMaxUsers] = useState<number>(100);
  const [campStartDate, setCampStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [campEndDate, setCampEndDate] = useState('');
  const [campStatus, setCampStatus] = useState<'DRAFT' | 'ACTIVE' | 'PAUSED'>('ACTIVE');

  // Analytics states
  const [selectedTaskForAnalytics, setSelectedTaskForAnalytics] = useState<string>('');
  const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Group Verification State
  const [isVerifyingGroup, setIsVerifyingGroup] = useState(false);
  const [groupVerifyStatus, setGroupVerifyStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // Submissions Audit Filter & Modal States
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmissionForModal, setSelectedSubmissionForModal] = useState<ManualTaskSubmission | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Screenshot does not match the required proof.');
  const [customReasonText, setCustomReasonText] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const loadPromotionChannels = async () => {
    setIsLoadingChannels(true);
    try {
      const res = await apiFetch('/api/admin/promotion-channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels || []);
      }
    } catch (err: any) {
      showToast('Error loading promotion channels: ' + err.message, 'error');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelChatId.trim()) {
      showToast('Channel Chat ID or Username is required', 'error');
      return;
    }
    setIsAddingChannel(true);
    try {
      const res = await apiFetch('/api/admin/promotion-channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: newChannelChatId.trim(),
          title: newChannelTitle.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ ' + data.message, 'success');
        setShowAddChannelModal(false);
        setNewChannelChatId('');
        setNewChannelTitle('');
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Failed to add channel'), 'error');
      }
    } catch (err: any) {
      showToast('Error adding channel: ' + err.message, 'error');
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleToggleChannel = async (channelId: string, currentActive: boolean) => {
    try {
      const res = await apiFetch('/api/admin/promotion-channels/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, active: !currentActive }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Updated channel status', 'success');
        setChannels(prev => prev.map(c => c.id === channelId ? { ...c, active: !currentActive } : c));
      }
    } catch (err: any) {
      showToast('Error updating channel', 'error');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm('Are you sure you want to remove this promotion channel?')) return;
    try {
      const res = await apiFetch('/api/admin/promotion-channels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Channel deleted', 'success');
        setChannels(prev => prev.filter(c => c.id !== channelId));
      }
    } catch (err: any) {
      showToast('Error deleting channel', 'error');
    }
  };

  const handleTestChannel = async (channelId: string) => {
    try {
      const res = await apiFetch('/api/admin/promotion-channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ ' + data.message, 'success');
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Test failed'), 'error');
      }
    } catch (err: any) {
      showToast('Error testing channel: ' + err.message, 'error');
    }
  };

  const handleOpenPublishModal = (task: TaskItem) => {
    setPublishingTask(task);
    setNotifyUsersCheck(true);
    setPostChannelsCheck(true);
    setIncludeImageCheck(!!task.taskImage);
    setShowPublishModal(true);
  };

  const handleExecutePublish = async () => {
    if (!publishingTask) return;
    setIsPublishing(true);
    try {
      const res = await apiFetch('/api/admin/publish-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: publishingTask.id,
          distributionSettings: {
            notifyActiveUsers: notifyUsersCheck,
            postToConnectedChannels: postChannelsCheck,
            useTaskImage: includeImageCheck,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 Published! Channels Target: ${data.channelsTargeted}, Success: ${data.channelsSuccess}`, 'success');
        setShowPublishModal(false);
        loadData();
      } else {
        showToast('❌ ' + (data.error || 'Failed to publish task'), 'error');
      }
    } catch (err: any) {
      showToast('Error publishing task: ' + err.message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const loadOverallStats = async () => {
    setIsLoadingOverallStats(true);
    try {
      const res = await apiFetch('/api/admin/task-distribution-analytics');
      const data = await res.json();
      if (data.success) {
        setOverallStats(data.stats);
      }
    } catch (err: any) {
      showToast('Error loading analytics stats', 'error');
    } finally {
      setIsLoadingOverallStats(false);
    }
  };

  const iconsList = [
    { name: 'CheckSquare', icon: CheckSquare, desc: 'Generic Check' },
    { name: 'Users', icon: Users, desc: 'Invite / Group' },
    { name: 'Tv', icon: Tv, desc: 'Watch Video' },
    { name: 'Share2', icon: Share2, desc: 'Share / Social' },
  ];

  const presetRejectionReasons = [
    'Screenshot does not match the required proof.',
    'Wrong mobile number entered.',
    'Invalid or blurry screenshot.',
    'Duplicate submission detected.',
    'Account registration was not completed on target website.',
    'Other'
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [taskList, subList] = await Promise.all([
        fetchTasksFromDb(),
        fetchManualSubmissionsFromDb()
      ]);
      setTasks(taskList);
      setSubmissions(subList);
    } catch (err: any) {
      showToast('Error loading task data: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const fetchBotTelegramConfig = async () => {
      try {
        const botId = config?.botId || 'roy_share_wallet';
        const res = await apiFetch(`/api/admin/get-telegram-config?botId=${botId}`);
        const data = await res.json();
        if (data.success && data.config) {
          if (data.config.privateReviewGroupChatId) {
            setPrivateAdminGroupChatId(data.config.privateReviewGroupChatId);
          }
          if (data.config.telegramAdminChatId) {
            setTelegramAdminChatId(data.config.telegramAdminChatId);
          }
        }
      } catch (err) {
        console.error('Error fetching bot telegram config:', err);
      }
    };
    fetchBotTelegramConfig();
  }, [config?.botId]);

  const handleEdit = (task: TaskItem) => {
    setEditingId(task.id);
    setTitle(task.title);
    setReward(task.reward);
    setCoins(task.coins);
    setVerificationType(task.verificationType);
    setIcon(task.icon);
    setSortOrder(task.sortOrder);
    setUrl(task.url || task.externalDestinationUrl || '');
    setTaskImage(task.taskImage || '');
    setDescription(task.description || '');
    setProofDemoImage(task.proofDemoImage || '');
    setPrivateAdminGroupChatId(task.privateAdminGroupChatId || '');
    setTelegramAdminChatId(task.telegramAdminChatId || '');
    setAllowResubmission(task.allowResubmission !== false);
    setMaxSubmissionsPerUser(task.maxSubmissionsPerUser || 1);
    setActive(task.active);
    setGroupVerifyStatus(null);
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setTitle('');
    setReward(10);
    setCoins(25);
    setVerificationType('none');
    setIcon('CheckSquare');
    const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sortOrder)) + 10 : 10;
    setSortOrder(nextOrder);
    setUrl('');
    setTaskImage('');
    setDescription('');
    setProofDemoImage('');
    setPrivateAdminGroupChatId('');
    setTelegramAdminChatId('');
    setAllowResubmission(true);
    setMaxSubmissionsPerUser(1);
    setActive(true);
    setGroupVerifyStatus(null);
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please select a valid JPG, PNG, or WEBP image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setter(String(reader.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyTelegramGroup = async () => {
    if (!privateAdminGroupChatId.trim()) {
      showToast('Please enter PRIVATE REVIEW GROUP CHAT ID (e.g. -1001234567890)', 'error');
      return;
    }

    setIsVerifyingGroup(true);
    setGroupVerifyStatus(null);
    try {
      const res = await apiFetch('/api/admin/verify-telegram-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateReviewGroupChatId: privateAdminGroupChatId.trim(),
          telegramAdminChatId: telegramAdminChatId.trim(),
          botId: config?.botId || 'roy_share_wallet'
        })
      });
      const data = await res.json();
      if (data.success) {
        setGroupVerifyStatus({
          success: true,
          msg: data.message || '✅ Telegram configuration verified successfully.'
        });
        showToast('✅ Roy Share Wallet Review Group Verified!', 'success');
      } else {
        setGroupVerifyStatus({
          success: false,
          msg: data.error || 'Verification failed'
        });
        showToast(data.error || 'Verification failed', 'error');
      }
    } catch (err: any) {
      setGroupVerifyStatus({
        success: false,
        msg: err.message || 'Error verifying Telegram configuration'
      });
      showToast(err.message || 'Error verifying Telegram configuration', 'error');
    } finally {
      setIsVerifyingGroup(false);
    }
  };

  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [testMsgStatus, setTestMsgStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const handleSendTestMessage = async () => {
    if (!privateAdminGroupChatId.trim()) {
      showToast('Please enter PRIVATE REVIEW GROUP CHAT ID first', 'error');
      return;
    }

    setIsSendingTestMsg(true);
    setTestMsgStatus(null);
    try {
      const res = await apiFetch('/api/admin/send-test-review-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateReviewGroupChatId: privateAdminGroupChatId.trim(),
          botId: config?.botId || 'roy_share_wallet'
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestMsgStatus({
          success: true,
          msg: data.message || '✅ Test message sent successfully to Private Review Group!'
        });
        showToast('✅ Test message sent to Telegram Review Group!', 'success');
      } else {
        setTestMsgStatus({
          success: false,
          msg: data.error || 'Test message failed to send.'
        });
        showToast(data.error || 'Test message failed', 'error');
      }
    } catch (err: any) {
      setTestMsgStatus({
        success: false,
        msg: err.message || 'Error sending test message'
      });
      showToast(err.message || 'Error sending test message', 'error');
    } finally {
      setIsSendingTestMsg(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Task title is required', 'error');
      return;
    }

    if (verificationType === 'manual') {
      if (!privateAdminGroupChatId.trim()) {
        showToast('PRIVATE REVIEW GROUP CHAT ID is required for manual audit tasks', 'error');
        return;
      }
    }

    try {
      const taskData: Partial<TaskItem> = {
        title: title.trim(),
        reward: Number(reward) || 0,
        coins: Number(coins) || 0,
        verificationType,
        icon,
        sortOrder: Number(sortOrder) || 10,
        url: url.trim(),
        externalDestinationUrl: url.trim(),
        taskImage,
        description: description.trim(),
        proofDemoImage,
        privateAdminGroupChatId: privateAdminGroupChatId.trim(),
        telegramAdminChatId: telegramAdminChatId.trim(),
        allowResubmission,
        maxSubmissionsPerUser: Number(maxSubmissionsPerUser) || 1,
        active,
      };

      if (editingId) {
        taskData.id = editingId;
      }

      await saveTaskToDb(taskData);
      showToast(editingId ? 'Task updated successfully' : 'Task created successfully', 'success');
      setShowForm(false);
      loadData();
    } catch (err: any) {
      showToast('Error saving task: ' + err.message, 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this task? This is irreversible.')) {
      return;
    }

    try {
      await deleteTaskFromDb(id);
      showToast('Task deleted successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast('Error deleting task: ' + err.message, 'error');
    }
  };

  const handleToggleActive = async (task: TaskItem) => {
    try {
      await saveTaskToDb({
        id: task.id,
        active: !task.active
      });
      showToast(`Task ${!task.active ? 'enabled' : 'disabled'} successfully`, 'success');
      loadData();
    } catch (err: any) {
      showToast('Error toggling task status: ' + err.message, 'error');
    }
  };

  // Submissions Audit Handlers
  const handleApproveSubmission = async (subId: string) => {
    if (!window.confirm('Approve this task proof submission? Wallet reward will be credited.')) {
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await apiFetch('/api/tasks/approve-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: subId, adminName: 'Admin' })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 Submission APPROVED! Task reward credited to user wallet.', 'success');
        setSelectedSubmissionForModal(null);
        loadData();
      } else {
        showToast(data.error || 'Failed to approve submission', 'error');
      }
    } catch (err) {
      showToast('Error approving submission', 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectingSubId) return;

    const finalReason = rejectionReason === 'Other' ? customReasonText.trim() : rejectionReason;
    if (!finalReason) {
      showToast('Please specify a rejection reason', 'error');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await apiFetch('/api/tasks/reject-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: rejectingSubId,
          reason: finalReason,
          adminName: 'Admin'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('❌ Submission REJECTED. User has been notified.', 'info');
        setShowRejectModal(false);
        setRejectingSubId(null);
        setSelectedSubmissionForModal(null);
        loadData();
      } else {
        showToast(data.error || 'Failed to reject submission', 'error');
      }
    } catch (err) {
      showToast('Error rejecting submission', 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((s) => {
    if (submissionStatusFilter !== 'ALL') {
      if (submissionStatusFilter === 'PENDING' && s.status !== 'PENDING_APPROVAL') return false;
      if (submissionStatusFilter === 'APPROVED' && s.status !== 'APPROVED') return false;
      if (submissionStatusFilter === 'REJECTED' && s.status !== 'REJECTED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMobile = (s.registrationMobile || '').toLowerCase().includes(q);
      const matchUser = (s.userFullName || '').toLowerCase().includes(q) || (s.telegramUsername || '').toLowerCase().includes(q);
      const matchUid = (s.userAppUid || s.userId || '').toLowerCase().includes(q);
      const matchTask = (s.taskTitle || '').toLowerCase().includes(q);
      const matchTgId = (s.telegramUserId || '').toLowerCase().includes(q);
      return matchMobile || matchUser || matchUid || matchTask || matchTgId;
    }

    return true;
  });

  const pendingCount = submissions.filter(s => s.status === 'PENDING_APPROVAL').length;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Top Header & Tab Switcher */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-amber-500" />
            <span>Task Management Suite</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure dynamic app tasks, manual screenshot audit workflows, and admin group approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('tasks')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'tasks'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tasks Config</span>
            </button>
            <button
              onClick={() => setActiveSubTab('submissions')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                activeSubTab === 'submissions'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manual Audits</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveSubTab('channels');
                loadPromotionChannels();
              }}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'channels'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Connected Channels</span>
            </button>
            <button
              onClick={() => {
                setActiveSubTab('analytics');
                loadOverallStats();
              }}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'analytics'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {activeSubTab === 'tasks' && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/10 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: TASKS CONFIGURATION */}
      {activeSubTab === 'tasks' && (
        <>
          {showForm && (
            <form onSubmit={handleSaveTask} className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-black text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  {editingId ? 'Edit Task Configuration' : 'Create Dynamic Task'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Task Title */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block">1. Task Title / Headline *</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete Account Registration"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                    required
                  />
                </div>

                {/* Rewards */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">2. Cash Reward (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={reward}
                    onChange={(e) => setReward(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                    min="0"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Coins Reward</label>
                  <input
                    type="number"
                    placeholder="e.g. 25"
                    value={coins}
                    onChange={(e) => setCoins(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                    min="0"
                  />
                </div>

                {/* Verification Type */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block">Verification Type *</label>
                  <select
                    value={verificationType}
                    onChange={(e) => setVerificationType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-xs font-bold text-amber-400 outline-none"
                  >
                    <option value="none">None (Instant User Reward)</option>
                    <option value="automatic">Automatic System Verification</option>
                    <option value="manual">Manual Admin Audit Approval (Screenshot Proof Workflow)</option>
                  </select>
                </div>

                {/* Additional Manual Audit Configuration Fields */}
                {verificationType === 'manual' && (
                  <div className="md:col-span-2 space-y-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>MANUAL ADMIN AUDIT APPROVAL CONFIGURATION</span>
                    </div>

                    {/* Task Image */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">Task Image (Displayed on user task card)</label>
                      <div className="flex items-center gap-3">
                        {taskImage ? (
                          <div className="relative w-16 h-16 rounded-xl border border-slate-700 overflow-hidden shrink-0">
                            <img src={taskImage} alt="Task Visual" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setTaskImage('')}
                              className="absolute top-0.5 right-0.5 bg-slate-950/80 text-rose-400 p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="w-16 h-16 rounded-xl border border-dashed border-slate-700 bg-slate-950 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 shrink-0">
                            <Upload className="w-4 h-4 text-slate-500" />
                            <span className="text-[9px] text-slate-500 mt-1">Upload</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, setTaskImage)}
                            />
                          </label>
                        )}
                        <input
                          type="url"
                          placeholder="Or paste Task Image URL (https://...)"
                          value={taskImage}
                          onChange={(e) => setTaskImage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Short Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">Short Description / Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="Open the website, complete your account registration and submit the required proof screenshot."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                      />
                    </div>

                    {/* External Destination URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">External Destination URL *</label>
                      <input
                        type="url"
                        placeholder="https://example.com/register"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-sky-400 outline-none"
                        required
                      />
                    </div>

                    {/* Proof Screenshot Demo Image */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">Proof Screenshot Demo Image (Example for Users)</label>
                      <div className="flex items-center gap-3">
                        {proofDemoImage ? (
                          <div className="relative w-20 h-20 rounded-xl border border-slate-700 overflow-hidden shrink-0">
                            <img src={proofDemoImage} alt="Demo Proof" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setProofDemoImage('')}
                              className="absolute top-0.5 right-0.5 bg-slate-950/80 text-rose-400 p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="w-20 h-20 rounded-xl border border-dashed border-slate-700 bg-slate-950 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 shrink-0">
                            <ImageIcon className="w-5 h-5 text-slate-500" />
                            <span className="text-[9px] text-slate-500 mt-1">Demo Image</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, setProofDemoImage)}
                            />
                          </label>
                        )}
                        <input
                          type="url"
                          placeholder="Or paste Proof Demo Image URL (https://...)"
                          value={proofDemoImage}
                          onChange={(e) => setProofDemoImage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Telegram Audit Configurations */}
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">Telegram Manual Verification Settings</span>
                        <span className="text-[10px] text-slate-400 font-medium">Scoped to Bot ID: {config?.botId || 'roy_share_wallet'}</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">
                          1. PRIVATE REVIEW GROUP CHAT ID *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. -1001234567890"
                          value={privateAdminGroupChatId}
                          onChange={(e) => setPrivateAdminGroupChatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-amber-400 outline-none"
                          required
                        />
                        <p className="text-[11px] text-slate-400">User proof submissions will be sent to this group.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">
                          2. TELEGRAM ADMIN/REVIEW CHAT ID *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. -1009876543210"
                          value={telegramAdminChatId}
                          onChange={(e) => setTelegramAdminChatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-amber-400 outline-none"
                        />
                        <p className="text-[11px] text-slate-400">Admin review notifications will be received here.</p>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyTelegramGroup}
                          disabled={isVerifyingGroup}
                          className="py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        >
                          {isVerifyingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          <span>VERIFY & SAVE TELEGRAM CONFIG</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendTestMessage}
                          disabled={isSendingTestMsg}
                          className="py-2.5 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        >
                          {isSendingTestMsg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>SEND TEST MESSAGE</span>
                        </button>
                      </div>

                      {groupVerifyStatus && (
                        <div className={`p-3 rounded-xl text-xs font-mono whitespace-pre-line leading-relaxed ${
                          groupVerifyStatus.success
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                        }`}>
                          {groupVerifyStatus.msg}
                        </div>
                      )}

                      {testMsgStatus && (
                        <div className={`p-3 rounded-xl text-xs font-mono whitespace-pre-line leading-relaxed ${
                          testMsgStatus.success
                            ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                        }`}>
                          {testMsgStatus.msg}
                        </div>
                      )}
                    </div>

                    {/* Settings: Resubmission & Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                        <span className="text-xs font-bold text-slate-300">Allow Resubmission After Rejection</span>
                        <button
                          type="button"
                          onClick={() => setAllowResubmission(!allowResubmission)}
                          className={`text-xs font-black px-3 py-1 rounded-lg transition ${
                            allowResubmission ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {allowResubmission ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                        <span className="text-xs font-bold text-slate-300">Max Submissions Per User</span>
                        <select
                          value={maxSubmissionsPerUser}
                          onChange={(e) => setMaxSubmissionsPerUser(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400 rounded-lg px-2.5 py-1 outline-none"
                        >
                          <option value={1}>1 Submissions</option>
                          <option value={2}>2 Submissions</option>
                          <option value={3}>3 Submissions</option>
                          <option value={999}>Unlimited</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* External URL for non-manual tasks */}
                {verificationType !== 'manual' && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block">External Link (URL - Optional)</label>
                    <input
                      type="url"
                      placeholder="e.g. https://t.me/news_channel"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                )}

                {/* Sort Order & Icon */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Sort Order (Rank Index)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Select Task Icon</label>
                  <div className="grid grid-cols-2 gap-2">
                    {iconsList.map((ic) => {
                      const IconComp = ic.icon;
                      const isSelected = icon === ic.name;
                      return (
                        <button
                          key={ic.name}
                          type="button"
                          onClick={() => setIcon(ic.name)}
                          className={`flex items-center gap-1.5 p-2 border rounded-xl text-xs font-bold transition ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span className="truncate">{ic.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2.5 py-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-300"
                  >
                    {active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                    <span>Task is active and published to users</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingId ? 'Save Edits' : 'Publish Task'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tasks List */}
          {isLoading ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading dynamic tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
              <p className="text-xs text-slate-500">No custom tasks published yet.</p>
              <button
                onClick={handleCreateNew}
                className="text-xs text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Publish your first task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task) => {
                const IconComponent = iconsList.find(i => i.name === task.icon)?.icon || CheckSquare;
                return (
                  <div
                    key={task.id}
                    className={`p-5 rounded-3xl border transition flex flex-col justify-between gap-4 backdrop-blur-md ${
                      task.active
                        ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-65'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {task.taskImage ? (
                            <img src={task.taskImage} alt="Task" className="w-10 h-10 rounded-xl object-cover border border-slate-800" />
                          ) : (
                            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-amber-400">
                              <IconComponent className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-black text-white line-clamp-1">{task.title}</h4>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Rank Order: {task.sortOrder}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          task.active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}>
                          {task.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold pt-1">
                        <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>₹{task.reward} Reward</span>
                        </div>
                        {task.coins > 0 && (
                          <div className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                            <Coins className="w-3.5 h-3.5" />
                            <span>{task.coins} Coins</span>
                          </div>
                        )}
                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                          task.verificationType === 'manual'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}>
                          {task.verificationType === 'manual' ? '🛡️ Manual Audit' : task.verificationType === 'automatic' ? '⚡ Auto' : '🚀 Instant'}
                        </span>
                      </div>

                      {(task.url || task.externalDestinationUrl) && (
                        <a
                          href={task.externalDestinationUrl || task.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono break-all"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span>{task.externalDestinationUrl || task.url}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <button
                        onClick={() => handleToggleActive(task)}
                        className={`flex items-center gap-1 text-[10px] font-bold transition ${
                          task.active ? 'text-slate-400 hover:text-amber-400' : 'text-emerald-500 hover:text-emerald-400'
                        }`}
                      >
                        {task.active ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenPublishModal(task)}
                          className="flex items-center gap-1 py-1 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-black transition"
                          title="Publish & Auto Promote Task"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>Publish & Promote</span>
                        </button>
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Edit task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Delete task"
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
        </>
      )}

      {/* SUBTAB 2: MANUAL SUBMISSIONS AUDIT */}
      {activeSubTab === 'submissions' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
                const isSelected = submissionStatusFilter === st;
                return (
                  <button
                    key={st}
                    onClick={() => setSubmissionStatusFilter(st)}
                    className={`py-1.5 px-3.5 rounded-xl text-xs font-black transition shrink-0 ${
                      isSelected
                        ? st === 'PENDING'
                          ? 'bg-amber-500 text-slate-950'
                          : st === 'APPROVED'
                          ? 'bg-emerald-500 text-slate-950'
                          : st === 'REJECTED'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-200 text-slate-950'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st === 'ALL' ? 'All Proofs' : st === 'PENDING' ? '⏳ Pending' : st === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search user, mobile, UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Submissions List */}
          {isLoading ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading manual task submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
              <p className="text-xs text-slate-500">No screenshot submissions found matching your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between gap-3 hover:border-slate-700 transition"
                >
                  <div className="space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white line-clamp-1">{sub.taskTitle}</h4>
                        <span className="text-[10px] font-bold text-amber-400">Reward: ₹{sub.reward}</span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        sub.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sub.status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {sub.status === 'APPROVED' ? 'APPROVED' : sub.status === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                      </span>
                    </div>

                    {/* Screenshot Preview */}
                    {sub.proofImageUrl && (
                      <div
                        onClick={() => setSelectedSubmissionForModal(sub)}
                        className="relative h-36 rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 cursor-pointer group"
                      >
                        <img src={sub.proofImageUrl} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition">
                          🔍 View Proof Screenshot
                        </div>
                      </div>
                    )}

                    {/* User & Mobile details */}
                    <div className="space-y-1 p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Mobile:</span>
                        <span className="font-bold text-amber-400">{sub.registrationMobile}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">User:</span>
                        <span className="truncate max-w-[140px] text-slate-200">{sub.userFullName || sub.telegramUsername || sub.userId}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">TG ID:</span>
                        <span className="text-slate-400">{sub.telegramUserId}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Submitted:</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sub.submittedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {sub.rejectionReason && (
                        <div className="pt-1 mt-1 border-t border-slate-900 text-rose-400 text-[10px] font-sans">
                          Reason: {sub.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setSelectedSubmissionForModal(sub)}
                      className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-xl transition text-center"
                    >
                      View
                    </button>

                    {sub.status === 'PENDING_APPROVAL' && (
                      <>
                        <button
                          onClick={() => handleApproveSubmission(sub.id)}
                          disabled={isProcessingAction}
                          className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black rounded-xl transition text-center shadow"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectingSubId(sub.id);
                            setShowRejectModal(true);
                          }}
                          disabled={isProcessingAction}
                          className="flex-1 py-1.5 px-2 bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-black rounded-xl transition text-center shadow"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FULL-SIZE PROOF SCREENSHOT MODAL */}
      {selectedSubmissionForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white">{selectedSubmissionForModal.taskTitle}</h3>
                <span className="text-xs font-bold text-amber-400">Reward: ₹{selectedSubmissionForModal.reward}</span>
              </div>
              <button
                onClick={() => setSelectedSubmissionForModal(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center">
              <img
                src={selectedSubmissionForModal.proofImageUrl}
                alt="Submitted Proof"
                className="max-h-[50vh] w-auto object-contain"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Registration Mobile:</span>
                <span className="text-amber-400 font-bold">{selectedSubmissionForModal.registrationMobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">User Full Name:</span>
                <span className="text-slate-200">{selectedSubmissionForModal.userFullName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Telegram Username:</span>
                <span className="text-sky-400">@{selectedSubmissionForModal.telegramUsername || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Telegram ID:</span>
                <span className="text-slate-300">{selectedSubmissionForModal.telegramUserId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UID:</span>
                <span className="text-slate-300">{selectedSubmissionForModal.userAppUid || selectedSubmissionForModal.userId}</span>
              </div>
            </div>

            {selectedSubmissionForModal.status === 'PENDING_APPROVAL' && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleApproveSubmission(selectedSubmissionForModal.id)}
                  disabled={isProcessingAction}
                  className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
                >
                  ✅ APPROVE SUBMISSION
                </button>
                <button
                  onClick={() => {
                    setRejectingSubId(selectedSubmissionForModal.id);
                    setShowRejectModal(true);
                  }}
                  disabled={isProcessingAction}
                  className="flex-1 py-2.5 px-4 bg-rose-500 hover:bg-rose-400 text-white font-black text-xs rounded-xl shadow transition"
                >
                  ❌ REJECT SUBMISSION
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>Select Rejection Reason</span>
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {presetRejectionReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                    rejectionReason === reason
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{reason}</span>
                  {rejectionReason === reason && <Check className="w-4 h-4 text-rose-400" />}
                </button>
              ))}
            </div>

            {rejectionReason === 'Other' && (
              <textarea
                rows={2}
                placeholder="Enter custom rejection reason..."
                value={customReasonText}
                onChange={(e) => setCustomReasonText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-3 text-xs text-white outline-none"
              />
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowRejectModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={isProcessingAction}
                className="py-2.5 px-5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition"
              >
                CONFIRM REJECTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CONNECTED PROMOTION CHANNELS */}
      {activeSubTab === 'channels' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between p-5 rounded-3xl bg-slate-900/60 border border-slate-800">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-amber-400" />
                <span>Connected Promotion Channels</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Auto-post published tasks directly to these connected Telegram channels.
              </p>
            </div>
            <button
              onClick={() => setShowAddChannelModal(true)}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Channel</span>
            </button>
          </div>

          {isLoadingChannels ? (
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
              Loading promotion channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">No promotion channels connected yet.</p>
              <button
                onClick={() => setShowAddChannelModal(true)}
                className="text-xs text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add your first Telegram channel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className={`p-5 rounded-3xl border transition space-y-3 ${
                    ch.active
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white">{ch.title}</h4>
                      <p className="text-xs text-sky-400 font-mono">{ch.username || ch.chatId}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      ch.canPost
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {ch.canPost ? 'Admin & Can Post' : ch.isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>

                  {ch.lastError && (
                    <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
                      ⚠️ {ch.lastError}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => handleToggleChannel(ch.id, ch.active)}
                      className={`flex items-center gap-1 font-bold ${
                        ch.active ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {ch.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{ch.active ? 'Active' : 'Disabled'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestChannel(ch.id)}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition"
                      >
                        Test Post
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: DISTRIBUTION ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Task & Promotion Distribution Analytics</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Performance metrics for Roy Share Wallet task system and promotion channel broadcasts.
            </p>
          </div>

          {isLoadingOverallStats ? (
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
              Loading distribution analytics...
            </div>
          ) : overallStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Tasks</span>
                <p className="text-xl font-black text-amber-400">{overallStats.totalTasks || 0}</p>
                <span className="text-[10px] text-slate-500">{overallStats.totalPublished || 0} Published</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Eligible Users</span>
                <p className="text-xl font-black text-sky-400">{overallStats.eligibleUsersCount || 0}</p>
                <span className="text-[10px] text-slate-500">Roy Share Wallet</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Channels</span>
                <p className="text-xl font-black text-purple-400">{overallStats.connectedChannelsCount || 0}</p>
                <span className="text-[10px] text-slate-500">Connected</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Audits Approved</span>
                <p className="text-xl font-black text-emerald-400">{overallStats.totalApproved || 0}</p>
                <span className="text-[10px] text-slate-500">{overallStats.totalPending || 0} Pending</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Paid Out</span>
                <p className="text-xl font-black text-amber-400">₹{overallStats.totalPaidOut || 0}</p>
                <span className="text-[10px] text-slate-500">Rewards</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* PUBLISH & PROMOTIONS MODAL */}
      {showPublishModal && publishingTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span>Publish & Broadcast Task</span>
              </h3>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-2">
              <h4 className="text-sm font-black text-amber-400">{publishingTask.title}</h4>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
                <span>Reward: ₹{publishingTask.reward}</span>
                <span>Coins: +{publishingTask.coins || 0}</span>
              </div>
              <p className="text-[11px] text-sky-400 font-mono break-all pt-1">
                Link: https://t.me/Roy_wallett_bot?start=task_{publishingTask.id}
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Distribution Settings:</span>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white block">Auto Broadcast to Eligible Users</span>
                  <span className="text-[10px] text-slate-400 block">Send task notification to all Roy Share Wallet users</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyUsersCheck}
                  onChange={(e) => setNotifyUsersCheck(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white block">Post to Promotion Channels</span>
                  <span className="text-[10px] text-slate-400 block">Auto-post task card with Start Task deep link to connected channels</span>
                </div>
                <input
                  type="checkbox"
                  checked={postChannelsCheck}
                  onChange={(e) => setPostChannelsCheck(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>

              {publishingTask.taskImage && (
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Include Task Image</span>
                    <span className="text-[10px] text-slate-400 block">Send task photo card in channel posts and messages</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeImageCheck}
                    onChange={(e) => setIncludeImageCheck(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePublish}
                disabled={isPublishing}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5"
              >
                {isPublishing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Confirm Publish & Broadcast Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CHANNEL MODAL */}
      {showAddChannelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAddChannel} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-amber-400" />
                <span>Connect Promotion Channel</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddChannelModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Telegram Channel Chat ID or Username *</label>
                <input
                  type="text"
                  placeholder="e.g. @royshare_announcements or -1001234567890"
                  value={newChannelChatId}
                  onChange={(e) => setNewChannelChatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Channel Label / Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Roy Share Official Channel"
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                />
              </div>
              <p className="text-[10px] text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                📌 Note: Make sure the Roy Share Wallet Bot is added as an <b>Admin</b> in the channel with permission to post messages.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddChannelModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAddingChannel}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
              >
                {isAddingChannel ? 'Connecting...' : 'Connect Channel'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
