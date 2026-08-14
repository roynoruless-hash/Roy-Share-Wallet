import React, { useState, useEffect } from 'react';
import {
  fetchTasksFromDb,
  saveTaskToDb,
  deleteTaskFromDb,
  fetchManualSubmissionsFromDb,
} from '../../services/taskService';
import { uploadImageToImgBB } from '../../services/storageService';
import { loadAdminConfig } from '../../services/configService';
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
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  BarChart3,
  Megaphone,
  AlertTriangle,
  Send,
  Settings,
  RotateCcw,
  Link2,
  Activity,
} from 'lucide-react';
import { TaskItem, ManualTaskSubmission } from '../../types';
import { apiFetch } from '../../utils/api';

interface TasksManagerViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const TasksManagerView: React.FC<TasksManagerViewProps> = ({
  config,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'submissions' | 'channels'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [submissions, setSubmissions] = useState<ManualTaskSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Promotion Channels states
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelChatId, setNewChannelChatId] = useState('');
  const [newChannelUsername, setNewChannelUsername] = useState('');
  const [newChannelInviteUrl, setNewChannelInviteUrl] = useState('');
  const [newAutoPromotion, setNewAutoPromotion] = useState(true);
  const [newTestNotifications, setNewTestNotifications] = useState(true);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [addChannelErrorDiagnostic, setAddChannelErrorDiagnostic] = useState<any>(null);
  const [isVerifyingAllChannels, setIsVerifyingAllChannels] = useState(false);

  // Channel Settings Modal
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState<any | null>(null);

  // Post History states
  const [postHistory, setPostHistory] = useState<any[]>([]);
  const [isLoadingPostHistory, setIsLoadingPostHistory] = useState(false);
  const [retryingPostId, setRetryingPostId] = useState<string | null>(null);

  // Task Distribution History states
  const [distributionHistory, setDistributionHistory] = useState<any[]>([]);
  const [showDistributionHistory, setShowDistributionHistory] = useState(false);
  const [isLoadingDistHistory, setIsLoadingDistHistory] = useState(false);

  // Task Preview Modal state
  const [previewTaskModal, setPreviewTaskModal] = useState<TaskItem | null>(null);

  // Task Publishing Modal states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingTask, setPublishingTask] = useState<TaskItem | null>(null);
  const [notifyUsersCheck, setNotifyUsersCheck] = useState(true);
  const [postChannelsCheck, setPostChannelsCheck] = useState(true);
  const [includeImageCheck, setIncludeImageCheck] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<any | null>(null);

  // Task Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublishingTask, setIsPublishingTask] = useState(false);
  const [publishFormError, setPublishFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState<number>(10);
  const [coins, setCoins] = useState<number>(25);
  const [verificationType, setVerificationType] = useState<'automatic' | 'manual' | 'none'>('none');
  const [icon, setIcon] = useState('CheckSquare');
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [url, setUrl] = useState('');
  const [taskImage, setTaskImage] = useState('');
  const [description, setDescription] = useState('');
  const [proofDemoImage, setProofDemoImage] = useState('');
  const [privateAdminGroupChatId, setPrivateAdminGroupChatId] = useState('');
  const [telegramAdminChatId, setTelegramAdminChatId] = useState('');
  const [allowResubmission, setAllowResubmission] = useState<boolean>(true);
  const [maxSubmissionsPerUser, setMaxSubmissionsPerUser] = useState<number>(1);
  const [active, setActive] = useState<boolean>(true);
  const [isUploadingTaskImage, setIsUploadingTaskImage] = useState(false);
  const [isUploadingProofImage, setIsUploadingProofImage] = useState(false);

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

  const loadPostHistory = async () => {
    setIsLoadingPostHistory(true);
    try {
      const res = await apiFetch('/api/admin/promotion-channels/post-history');
      const data = await res.json();
      if (data.success) {
        setPostHistory(data.posts || []);
      }
    } catch (err) {
      console.error('Error loading post history:', err);
    } finally {
      setIsLoadingPostHistory(false);
    }
  };

  const loadDistributionHistory = async () => {
    setIsLoadingDistHistory(true);
    try {
      const res = await apiFetch('/api/admin/task-distribution-history');
      const data = await res.json();
      if (data.success) {
        setDistributionHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error loading distribution history:', err);
    } finally {
      setIsLoadingDistHistory(false);
    }
  };

  const handleVerifyAllChannels = async () => {
    setIsVerifyingAllChannels(true);
    try {
      const res = await apiFetch('/api/admin/promotion-channels/verify-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 All channels verified successfully!', 'success');
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Verification failed'), 'error');
      }
    } catch (err: any) {
      showToast('Error verifying channels: ' + err.message, 'error');
    } finally {
      setIsVerifyingAllChannels(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddChannelErrorDiagnostic(null);
    if (!newChannelChatId.trim()) {
      showToast('Telegram Chat ID or Username is required', 'error');
      return;
    }
    setIsAddingChannel(true);
    try {
      const res = await apiFetch('/api/admin/promotion-channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          chatId: newChannelChatId.trim(),
          username: newChannelUsername.trim(),
          inviteUrl: newChannelInviteUrl.trim(),
          autoPromotion: newAutoPromotion,
          testNotifications: newTestNotifications,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 Channel Connected Successfully!', 'success');
        setShowAddChannelModal(false);
        setNewChannelName('');
        setNewChannelChatId('');
        setNewChannelUsername('');
        setNewChannelInviteUrl('');
        loadPromotionChannels();
      } else {
        setAddChannelErrorDiagnostic(data);
        showToast('❌ Verification Failed. Check diagnostic details below.', 'error');
      }
    } catch (err: any) {
      showToast('Error adding channel: ' + err.message, 'error');
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleUpdateChannelSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelForSettings) return;
    try {
      const res = await apiFetch('/api/admin/promotion-channels/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelForSettings.id,
          autoPromotion: selectedChannelForSettings.autoPromotion,
          testNotifications: selectedChannelForSettings.testNotifications,
          inviteUrl: selectedChannelForSettings.inviteUrl,
          active: selectedChannelForSettings.active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 Channel settings saved!', 'success');
        setSelectedChannelForSettings(null);
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Failed to update settings'), 'error');
      }
    } catch (err: any) {
      showToast('Error saving channel settings: ' + err.message, 'error');
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
        showToast('Channel removed', 'success');
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
        showToast('🟢 Test message sent successfully!', 'success');
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Test failed'), 'error');
      }
    } catch (err: any) {
      showToast('Error testing channel: ' + err.message, 'error');
    }
  };

  const handleRetryPost = async (postId: string) => {
    setRetryingPostId(postId);
    try {
      const res = await apiFetch('/api/admin/promotion-channels/retry-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 Post retried successfully!', 'success');
        loadPostHistory();
        loadPromotionChannels();
      } else {
        showToast('❌ ' + (data.error || 'Retry failed'), 'error');
      }
    } catch (err: any) {
      showToast('Error retrying post: ' + err.message, 'error');
    } finally {
      setRetryingPostId(null);
    }
  };

  const handleOpenPublishModal = (task: TaskItem) => {
    setPublishingTask(task);
    setNotifyUsersCheck(true);
    setPostChannelsCheck(true);
    setIncludeImageCheck(!!task.taskImage);
    setPublishProgress(null);
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
        setPublishProgress(data);
        showToast('🎉 Task Published & Distribution Initiated!', 'success');
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
    setPublishFormError(null);
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
    setPublishFormError(null);
    setShowForm(true);
  };

  // Helper to retrieve ImgBB API key
  const getImgbbApiKey = async (): Promise<string> => {
    let apiKey = config?.imgbbApiKey?.trim() || '';
    if (!apiKey) {
      try {
        const loaded = await loadAdminConfig();
        if (loaded?.config?.imgbbApiKey) {
          apiKey = loaded.config.imgbbApiKey.trim();
        }
      } catch (e) {}
    }
    if (!apiKey) {
      apiKey = ((import.meta as any).env?.VITE_IMGBB_API_KEY || '').trim();
    }
    return apiKey;
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'taskImage' | 'proofDemoImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Please select a valid JPG, PNG, or WEBP image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size should be less than 10MB', 'error');
      return;
    }

    if (type === 'taskImage') {
      setIsUploadingTaskImage(true);
    } else {
      setIsUploadingProofImage(true);
    }
    setPublishFormError(null);

    try {
      const apiKey = await getImgbbApiKey();
      if (!apiKey) {
        const errMsg = 'ImgBB API Key is not configured in System Settings (Security tab). Please set your ImgBB API Key first.';
        setPublishFormError(errMsg);
        showToast('❌ ' + errMsg, 'error');
        return;
      }

      showToast('Compressing & uploading image to ImgBB CDN...', 'info');

      // Upload directly to ImgBB API
      const cdnUrl = await uploadImageToImgBB(file, apiKey);

      if (!cdnUrl || !cdnUrl.startsWith('http')) {
        throw new Error('ImgBB API returned an invalid response or missing image URL.');
      }

      if (type === 'taskImage') {
        setTaskImage(cdnUrl);
      } else {
        setProofDemoImage(cdnUrl);
      }

      showToast('✅ Image uploaded successfully to ImgBB CDN!', 'success');
    } catch (err: any) {
      console.error('ImgBB Upload Error:', err);
      const errMsg = err?.message || 'Failed to upload image to ImgBB CDN.';
      setPublishFormError('Image upload failed: ' + errMsg);
      showToast('❌ Image upload failed: ' + errMsg, 'error');
    } finally {
      if (type === 'taskImage') {
        setIsUploadingTaskImage(false);
      } else {
        setIsUploadingProofImage(false);
      }
      e.target.value = '';
    }
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
    if (isPublishingTask) return; // Prevent double submission

    setPublishFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      const msg = 'Task title is required';
      setPublishFormError(msg);
      showToast(msg, 'error');
      return;
    }

    const numReward = Number(reward);
    if (isNaN(numReward) || numReward < 0) {
      const msg = 'Cash reward must be a valid non-negative number';
      setPublishFormError(msg);
      showToast(msg, 'error');
      return;
    }

    if (verificationType === 'manual') {
      if (!privateAdminGroupChatId.trim()) {
        const msg = 'PRIVATE REVIEW GROUP CHAT ID is required when Manual Admin Audit is selected';
        setPublishFormError(msg);
        showToast(msg, 'error');
        return;
      }
    }

    setIsPublishingTask(true);

    try {
      const apiKey = await getImgbbApiKey();

      let finalTaskImage = taskImage.trim();
      let finalProofDemoImage = proofDemoImage.trim();

      // Convert any Base64 data string to ImgBB URL before writing to Firestore
      if (finalTaskImage.startsWith('data:image/')) {
        if (!apiKey) {
          const msg = 'ImgBB API Key is required to convert Task Image Base64 data. Please set ImgBB API Key in System Settings.';
          setPublishFormError(msg);
          showToast('❌ ' + msg, 'error');
          setIsPublishingTask(false);
          return;
        }
        showToast('Uploading Task Image Base64 data to ImgBB CDN...', 'info');
        try {
          finalTaskImage = await uploadImageToImgBB(finalTaskImage, apiKey);
          setTaskImage(finalTaskImage);
        } catch (err: any) {
          const msg = 'Task Image upload to ImgBB failed: ' + (err.message || 'Error');
          setPublishFormError(msg);
          showToast('❌ ' + msg, 'error');
          setIsPublishingTask(false);
          return;
        }
      }

      if (finalProofDemoImage.startsWith('data:image/')) {
        if (!apiKey) {
          const msg = 'ImgBB API Key is required to convert Proof Demo Image Base64 data. Please set ImgBB API Key in System Settings.';
          setPublishFormError(msg);
          showToast('❌ ' + msg, 'error');
          setIsPublishingTask(false);
          return;
        }
        showToast('Uploading Proof Demo Image Base64 data to ImgBB CDN...', 'info');
        try {
          finalProofDemoImage = await uploadImageToImgBB(finalProofDemoImage, apiKey);
          setProofDemoImage(finalProofDemoImage);
        } catch (err: any) {
          const msg = 'Proof Demo Image upload to ImgBB failed: ' + (err.message || 'Error');
          setPublishFormError(msg);
          showToast('❌ ' + msg, 'error');
          setIsPublishingTask(false);
          return;
        }
      }

      // STRICT VALIDATION: BLOCK FIRESTORE WRITE IF ANY IMAGE IS STILL BASE64
      if (finalTaskImage.startsWith('data:image/') || finalProofDemoImage.startsWith('data:image/')) {
        const msg = 'Image upload failed. Base64 images cannot be saved to Firestore. Please upload images to ImgBB CDN first.';
        setPublishFormError(msg);
        showToast('❌ ' + msg, 'error');
        setIsPublishingTask(false);
        return;
      }

      const taskData: Partial<TaskItem> = {
        title: cleanTitle,
        reward: numReward,
        coins: Number(coins) || 0,
        verificationType,
        icon,
        sortOrder: Number(sortOrder) || 10,
        url: url.trim(),
        externalDestinationUrl: url.trim(),
        taskImage: finalTaskImage,
        taskImageUrl: finalTaskImage,
        description: description.trim(),
        proofDemoImage: finalProofDemoImage,
        proofDemoImageUrl: finalProofDemoImage,
        privateAdminGroupChatId: privateAdminGroupChatId.trim(),
        telegramAdminChatId: telegramAdminChatId.trim(),
        allowResubmission,
        maxSubmissionsPerUser: Number(maxSubmissionsPerUser) || 1,
        active,
        published: true,
        status: active ? 'ACTIVE' : 'DISABLED',
        earningBotId: 'roy_share_wallet',
      };

      if (editingId) {
        taskData.id = editingId;
      }

      await saveTaskToDb(taskData);

      showToast(editingId ? '✅ Task Updated & Published Successfully' : '✅ Task Published Successfully', 'success');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to publish task';
      setPublishFormError(errMsg);
      showToast('❌ Failed to publish task: ' + errMsg, 'error');
    } finally {
      setIsPublishingTask(false);
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
  const totalTasksCount = tasks.length;
  const activeTasksCount = tasks.filter(t => t.active).length;
  const totalApprovedRewards = submissions.filter(s => s.status === 'APPROVED').reduce((sum, s) => sum + (s.reward || 0), 0);
  const totalStartsCount = tasks.reduce((acc, t) => acc + (t.startsCount || 0), 0);

  // Connected Channels Summary Metrics
  const activeChannelsCount = channels.filter(c => c.active !== false && c.botAdminStatus).length;
  const failedChannelsCount = channels.filter(c => !c.botAdminStatus || c.lastError).length;
  const totalPostsSentCount = channels.reduce((acc, c) => acc + (c.postsSentCount || 0), 0);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden text-slate-100">
      {/* Top Header & Sub-Tab Navigation Bar */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-amber-500" />
            <span>Roy Share Task Management Suite</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Roy Share Wallet exclusive earning tasks, manual screenshot audits, and multi-channel Telegram auto promotion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('tasks')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'tasks'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📋 Tasks Config</span>
            </button>

            <button
              onClick={() => setActiveSubTab('submissions')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                activeSubTab === 'submissions'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>🛡 Manual Audits</span>
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
                loadPostHistory();
              }}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'channels'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>📢 Connected Channels</span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh Task Data"
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
        <div className="space-y-5">
          {/* Top Task Management Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tasks</span>
              <p className="text-lg font-black text-amber-400">{totalTasksCount}</p>
              <span className="text-[10px] text-slate-500 block">{activeTasksCount} Active Now</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Audits</span>
              <p className="text-lg font-black text-rose-400">{pendingCount}</p>
              <span className="text-[10px] text-slate-500 block">Requires Manual Review</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rewards Approved</span>
              <p className="text-lg font-black text-emerald-400">₹{totalApprovedRewards}</p>
              <span className="text-[10px] text-slate-500 block">Credited to Users</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Task Starts</span>
              <p className="text-lg font-black text-purple-400">{totalStartsCount}</p>
              <span className="text-[10px] text-slate-500 block">User Interactions</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actions</span>
              <button
                onClick={() => {
                  setShowDistributionHistory(!showDistributionHistory);
                  if (!showDistributionHistory) loadDistributionHistory();
                }}
                className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>{showDistributionHistory ? 'Hide History' : 'Distribution Logs'}</span>
              </button>
            </div>
          </div>

          {/* Distribution History Panel */}
          {showDistributionHistory && (
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Task Distribution & Broadcast Logs</span>
                </h4>
                <button
                  onClick={loadDistributionHistory}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingDistHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingDistHistory ? (
                <p className="text-xs text-slate-400 py-4 text-center">Loading logs...</p>
              ) : distributionHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No distribution records found yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {distributionHistory.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400">{item.taskTitle}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(item.publishedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                        <span>👥 Users Sent: <strong className="text-emerald-400">{item.usersSent || 0}</strong></span>
                        <span>📢 Channels Sent: <strong className="text-purple-400">{item.channelsSuccess || 0}</strong></span>
                        {item.channelsFailed > 0 && <span className="text-rose-400 font-bold">Failed Channels: {item.channelsFailed}</span>}
                        <span className="text-slate-500 uppercase font-mono text-[9px]">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create / Edit Task Form */}
          {showForm && (
            <form onSubmit={handleSaveTask} className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 backdrop-blur-md shadow-2xl">
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
                    placeholder="e.g. Complete Registration on Partner Site"
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
                      <label className="text-xs font-bold text-slate-300 block">Task Image (Hosted on ImgBB CDN)</label>
                      <div className="flex items-center gap-3">
                        {isUploadingTaskImage ? (
                          <div className="w-16 h-16 rounded-xl border border-amber-500/30 bg-slate-950 flex flex-col items-center justify-center shrink-0">
                            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                            <span className="text-[8px] font-bold text-amber-400 mt-1">ImgBB...</span>
                          </div>
                        ) : taskImage ? (
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
                              disabled={isUploadingTaskImage}
                              onChange={(e) => handleImageUpload(e, 'taskImage')}
                            />
                          </label>
                        )}
                        <input
                          type="url"
                          placeholder="Or paste Task Image URL (https://i.ibb.co/...)"
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
                      <label className="text-xs font-bold text-slate-300 block">Proof Screenshot Demo Image (Hosted on ImgBB CDN)</label>
                      <div className="flex items-center gap-3">
                        {isUploadingProofImage ? (
                          <div className="w-20 h-20 rounded-xl border border-amber-500/30 bg-slate-950 flex flex-col items-center justify-center shrink-0">
                            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                            <span className="text-[8px] font-bold text-amber-400 mt-1">ImgBB...</span>
                          </div>
                        ) : proofDemoImage ? (
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
                              disabled={isUploadingProofImage}
                              onChange={(e) => handleImageUpload(e, 'proofDemoImage')}
                            />
                          </label>
                        )}
                        <input
                          type="url"
                          placeholder="Or paste Proof Demo Image URL (https://i.ibb.co/...)"
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
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyTelegramGroup}
                          disabled={isVerifyingGroup}
                          className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        >
                          {isVerifyingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          <span>VERIFY & SAVE TELEGRAM CONFIG</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendTestMessage}
                          disabled={isSendingTestMsg}
                          className="py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
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
                        <span className="text-xs font-bold text-slate-300">Allow Resubmission</span>
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
                          <option value={1}>1 Submission</option>
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
                      placeholder="e.g. https://t.me/royshare_channel"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                )}

                {/* Sort Order & Icon */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Sort Order Index</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Task Icon</label>
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
                    <span>Task is active and available to Roy Share Wallet users</span>
                  </button>
                </div>
              </div>

              {publishFormError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>❌ Failed to publish task: {publishFormError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishFormError(null)}
                    className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800/80 rounded-lg"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={isPublishingTask}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishingTask}
                  className={`py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/10 transition ${
                    isPublishingTask ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                  }`}
                >
                  {isPublishingTask ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publishing Task...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{editingId ? 'Save & Publish Edits' : 'Publish Task'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Tasks List */}
          {isLoading ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading Roy Share Wallet earning tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
              <p className="text-xs text-slate-500">No earning tasks created yet.</p>
              <button
                onClick={handleCreateNew}
                className="text-xs text-amber-400 hover:underline font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add your first earning task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task) => {
                const IconComponent = iconsList.find(i => i.name === task.icon)?.icon || CheckSquare;
                return (
                  <div
                    key={task.id}
                    className={`p-5 rounded-3xl border transition flex flex-col justify-between gap-4 backdrop-blur-md shadow-lg ${
                      task.active
                        ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-65'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {task.taskImage ? (
                            <img src={task.taskImage} alt="Task" className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0" />
                          ) : (
                            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 shrink-0">
                              <IconComponent className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-black text-white line-clamp-1">{task.title}</h4>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Sort Index: {task.sortOrder}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          task.active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}>
                          {task.active ? '🟢 ACTIVE' : '🔴 DISABLED'}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold pt-1">
                        <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>₹{task.reward} Reward</span>
                        </div>
                        {task.coins > 0 && (
                          <div className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                            <Coins className="w-3.5 h-3.5" />
                            <span>+{task.coins} Coins</span>
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
                          className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{task.externalDestinationUrl || task.url}</span>
                        </a>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewTaskModal(task)}
                          className="flex items-center gap-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        <button
                          onClick={() => handleToggleActive(task)}
                          className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition ${
                            task.active ? 'text-slate-400 hover:text-amber-400 bg-slate-950' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          }`}
                        >
                          {task.active ? 'Disable' : 'Activate'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenPublishModal(task)}
                          className="flex items-center gap-1 py-1 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-black transition"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>Publish & Promote</span>
                        </button>
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Edit task"
                        >
                          <Edit2 className="w-3 h-3.5" />
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
        </div>
      )}

      {/* SUBTAB 2: MANUAL SUBMISSIONS AUDIT */}
      {activeSubTab === 'submissions' && (
        <div className="space-y-4">
          {/* Filters & Search Bar */}
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
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

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search mobile, username, TG ID, UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Submissions Cards */}
          {isLoading ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading manual proof submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
              <p className="text-xs text-slate-500">No screenshot submissions found for this filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex flex-col justify-between gap-3 hover:border-slate-700 transition shadow-lg"
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
                          🔍 Click to View Full Screenshot
                        </div>
                      </div>
                    )}

                    {/* User & Mobile details */}
                    <div className="space-y-1 p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Reg Mobile:</span>
                        <span className="font-bold text-amber-400">{sub.registrationMobile}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">User:</span>
                        <span className="truncate max-w-[130px] text-slate-200">{sub.userFullName || sub.telegramUsername || sub.userId}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Telegram ID:</span>
                        <span className="text-slate-400">{sub.telegramUserId}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">User UID:</span>
                        <span className="text-slate-400">{sub.userAppUid || sub.userId}</span>
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

      {/* SUBTAB 3: CONNECTED PROMOTION CHANNELS */}
      {activeSubTab === 'channels' && (
        <div className="space-y-5">
          {/* Header & Main Actions */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-amber-400" />
                <span>Connected Telegram Channels</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                New tasks will automatically be promoted to all active connected channels.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleVerifyAllChannels}
                disabled={isVerifyingAllChannels}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingAllChannels ? 'animate-spin text-amber-400' : ''}`} />
                <span>VERIFY ALL CHANNELS</span>
              </button>

              <button
                onClick={() => {
                  setAddChannelErrorDiagnostic(null);
                  setShowAddChannelModal(true);
                }}
                className="flex items-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>ADD CHANNEL</span>
              </button>
            </div>
          </div>

          {/* Connected Channels Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Connected</span>
              <p className="text-lg font-black text-amber-400">{channels.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Channels</span>
              <p className="text-lg font-black text-emerald-400">{activeChannelsCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed / Issues</span>
              <p className="text-lg font-black text-rose-400">{failedChannelsCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Posts Sent</span>
              <p className="text-lg font-black text-purple-400">{totalPostsSentCount}</p>
            </div>
          </div>

          {/* Channel Cards Grid */}
          {isLoadingChannels ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading promotion channels...</span>
            </div>
          ) : channels.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
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
                  className={`p-5 rounded-3xl border transition space-y-3 shadow-lg ${
                    ch.active && ch.botAdminStatus
                      ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-amber-400" />
                        <span>{ch.title || ch.name}</span>
                      </h4>
                      <p className="text-xs text-sky-400 font-mono mt-0.5">{ch.username || ch.chatId}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        ch.active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {ch.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                      </span>
                    </div>
                  </div>

                  {/* Channel Health Status Tags */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className={`p-2 rounded-xl border flex items-center justify-between ${
                      ch.botAdminStatus ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      <span>🤖 Bot Admin:</span>
                      <strong>{ch.botAdminStatus ? 'YES' : 'NO'}</strong>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center justify-between ${
                      ch.canPost ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      <span>📤 Can Post:</span>
                      <strong>{ch.canPost ? 'YES' : 'NO'}</strong>
                    </div>
                  </div>

                  {ch.lastError && (
                    <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl space-y-0.5 font-mono">
                      <span className="font-bold block">⚠️ Telegram Error:</span>
                      <p>{ch.lastError}</p>
                    </div>
                  )}

                  {/* Stats line */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>Auto Promote: <strong className="text-amber-400">{ch.autoPromotion !== false ? 'ON' : 'OFF'}</strong></span>
                    <span>Posts Sent: <strong className="text-emerald-400">{ch.postsSentCount || 0}</strong></span>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs flex-wrap gap-2">
                    <button
                      onClick={() => handleToggleChannel(ch.id, ch.active)}
                      className={`flex items-center gap-1 font-bold ${
                        ch.active ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {ch.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{ch.active ? 'Disable' : 'Enable'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTestChannel(ch.id)}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition text-[11px]"
                      >
                        🧪 Test
                      </button>

                      <button
                        onClick={() => setSelectedChannelForSettings(ch)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Channel Settings"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        title="Remove Channel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* POST HISTORY SECTION */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>📜 Channel Auto-Post History</span>
              </h4>
              <button
                onClick={loadPostHistory}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-bold"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingPostHistory ? 'animate-spin' : ''}`} />
                <span>Refresh History</span>
              </button>
            </div>

            {isLoadingPostHistory ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading post history...</p>
            ) : postHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No channel posts executed yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {postHistory.map((post) => (
                  <div key={post.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-850 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{post.taskTitle || 'Earning Task'}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-sky-400 font-bold">{post.channelTitle || post.channelChatId}</span>
                      </div>
                      {post.lastError && (
                        <p className="text-[11px] text-rose-400 font-mono">Error: {post.lastError}</p>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {new Date(post.postedAt || post.failedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        post.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {post.status}
                      </span>

                      {post.status !== 'SUCCESS' && (
                        <button
                          onClick={() => handleRetryPost(post.id)}
                          disabled={retryingPostId === post.id}
                          className="py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black rounded-lg transition flex items-center gap-1"
                        >
                          <RotateCcw className={`w-3 h-3 ${retryingPostId === post.id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TASK PREVIEW MODAL */}
      {previewTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Task Preview</span>
              </h3>
              <button
                onClick={() => setPreviewTaskModal(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-3">
              {previewTaskModal.taskImage && (
                <img src={previewTaskModal.taskImage} alt="Task" className="w-full h-32 object-cover rounded-xl border border-slate-800" />
              )}
              <h4 className="text-sm font-black text-white">{previewTaskModal.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{previewTaskModal.description}</p>
              <div className="flex items-center gap-3 text-xs font-bold pt-1">
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">₹{previewTaskModal.reward} Reward</span>
                <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">+{previewTaskModal.coins} Coins</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewTaskModal(null)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH & PROMOTIONS REAL-TIME MODAL */}
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

            {!publishProgress ? (
              <>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-2">
                  <h4 className="text-sm font-black text-amber-400">{publishingTask.title}</h4>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
                    <span>Reward: ₹{publishingTask.reward}</span>
                    <span>Coins: +{publishingTask.coins || 0}</span>
                  </div>
                  <p className="text-[11px] text-sky-400 font-mono break-all pt-1">
                    Deep Link: https://t.me/Roy_wallett_bot?start=task_{publishingTask.id}
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">Distribution Settings:</span>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">Notify Roy Share Wallet Users</span>
                      <span className="text-[10px] text-slate-400 block">Send task notification in background to active users</span>
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
                      <span className="text-xs font-bold text-white block">Post to Connected Channels</span>
                      <span className="text-[10px] text-slate-400 block">Auto-post task card with Start Task deep link to active channels</span>
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
                        <span className="text-[10px] text-slate-400 block">Send task photo card in channel posts</span>
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
                    <span>🚀 Publish & Broadcast Now</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-1">
                  <h4 className="text-sm font-black flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>TASK PUBLISHED SUCCESSFULLY</span>
                  </h4>
                  <p className="text-xs">Task is now live for Roy Share Wallet users.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Eligible Users Target:</span>
                    <strong className="text-sky-400">{publishProgress.eligibleUsersCount}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Channels Posted:</span>
                    <strong className="text-emerald-400">{publishProgress.channelsSuccess} / {publishProgress.channelsTargeted}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    User notification broadcast is processing in background queue.
                  </p>
                </div>

                {publishProgress.channelResults && publishProgress.channelResults.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-300 block">Channel Posting Results:</span>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {publishProgress.channelResults.map((chRes: any) => (
                        <div key={chRes.channelId} className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs flex items-center justify-between">
                          <span className="font-bold text-white">{chRes.title}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            chRes.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {chRes.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="py-2.5 px-5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CHANNEL MODAL WITH DIAGNOSTIC BOX */}
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
                <label className="text-xs font-bold text-slate-300 block mb-1">Channel Label / Name</label>
                <input
                  type="text"
                  placeholder="e.g. Roy Share Official Channel"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Telegram Chat ID or Username *</label>
                <input
                  type="text"
                  placeholder="e.g. @royshare_channel or -1001234567890"
                  value={newChannelChatId}
                  onChange={(e) => setNewChannelChatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Invite URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://t.me/+xxxxxx"
                  value={newChannelInviteUrl}
                  onChange={(e) => setNewChannelInviteUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-300">Auto Task Promotion</span>
                <button
                  type="button"
                  onClick={() => setNewAutoPromotion(!newAutoPromotion)}
                  className={`text-xs font-black px-3 py-1 rounded-lg transition ${
                    newAutoPromotion ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {newAutoPromotion ? 'ON' : 'OFF'}
                </button>
              </div>

              {addChannelErrorDiagnostic && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs">
                  <div className="font-black text-rose-400">{addChannelErrorDiagnostic.error}</div>
                  {addChannelErrorDiagnostic.diagnostic?.reasons && (
                    <div className="space-y-1 text-[11px] text-rose-200">
                      <span className="font-bold block">Possible Reasons:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                        {addChannelErrorDiagnostic.diagnostic.reasons.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
                {isAddingChannel ? 'Verifying...' : 'VERIFY & CONNECT CHANNEL'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CHANNEL SETTINGS MODAL */}
      {selectedChannelForSettings && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleUpdateChannelSettings} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Channel Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedChannelForSettings(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
                <span className="text-xs font-bold text-white block">{selectedChannelForSettings.title}</span>
                <span className="text-[11px] font-mono text-sky-400 block">{selectedChannelForSettings.username || selectedChannelForSettings.chatId}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Invite URL</label>
                <input
                  type="url"
                  placeholder="https://t.me/..."
                  value={selectedChannelForSettings.inviteUrl || ''}
                  onChange={(e) => setSelectedChannelForSettings({ ...selectedChannelForSettings, inviteUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-300">Auto Task Promotion</span>
                <button
                  type="button"
                  onClick={() => setSelectedChannelForSettings({ ...selectedChannelForSettings, autoPromotion: !selectedChannelForSettings.autoPromotion })}
                  className={`text-xs font-black px-3 py-1 rounded-lg transition ${
                    selectedChannelForSettings.autoPromotion ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {selectedChannelForSettings.autoPromotion ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedChannelForSettings(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FULL-SIZE PROOF SCREENSHOT MODAL */}
      {selectedSubmissionForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
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
    </div>
  );
};
