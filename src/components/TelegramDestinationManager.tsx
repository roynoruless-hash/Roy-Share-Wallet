import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Send,
  Users2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Zap,
  Info,
  Check,
  X,
  Bot,
} from 'lucide-react';
import { AdminConfig, TelegramChannelItem } from '../types';
import {
  getTelegramChannels,
  saveTelegramChannel,
  deleteTelegramChannel,
  verifySingleChannelGroup,
} from '../services/channelService';
import { formatTelegramUsername } from '../services/telegramService';

interface TelegramDestinationManagerProps {
  config: AdminConfig;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDestinationsUpdated?: (channels: TelegramChannelItem[]) => void;
}

export const TelegramDestinationManager: React.FC<TelegramDestinationManagerProps> = ({
  config,
  showToast,
  onDestinationsUpdated,
}) => {
  const [channels, setChannels] = useState<TelegramChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TelegramChannelItem | null>(null);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);
  const [isTestingModalConnection, setIsTestingModalConnection] = useState<boolean>(false);

  // Form fields
  const [formData, setFormData] = useState<{
    type: 'channel' | 'group';
    displayName: string;
    username: string;
    chatId: string;
    active: boolean;
  }>({
    type: 'channel',
    displayName: '',
    username: '',
    chatId: '',
    active: true,
  });

  // Modal verification status feedback
  const [modalTestStatus, setModalTestStatus] = useState<{
    tested: boolean;
    success: boolean;
    status: 'Connected' | 'Chat Not Found' | 'Bot is not Admin' | 'Invalid Chat ID' | 'Checking';
    message: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadDestinations();
  }, []);

  const loadDestinations = async () => {
    setIsLoading(true);
    try {
      let list = await getTelegramChannels();

      // Seed default items if collection empty but config usernames exist
      if (list.length === 0 && (config.mainChannelUsername || config.mainGroupUsername)) {
        const seeded: TelegramChannelItem[] = [];
        if (config.mainChannelUsername) {
          const c1 = await saveTelegramChannel({
            type: 'channel',
            displayName: 'Main Channel',
            username: config.mainChannelUsername,
            chatId: config.mainChannelUsername,
            required: true,
            active: true,
            position: 0,
            createdAt: new Date().toISOString(),
            status: 'unverified',
          });
          seeded.push(c1);
        }
        if (config.mainGroupUsername) {
          const g1 = await saveTelegramChannel({
            type: 'group',
            displayName: 'Main Group',
            username: config.mainGroupUsername,
            chatId: config.mainGroupUsername,
            required: true,
            active: true,
            position: 1,
            createdAt: new Date().toISOString(),
            status: 'unverified',
          });
          seeded.push(g1);
        }
        list = seeded;
      }

      setChannels(list);
      if (onDestinationsUpdated) {
        onDestinationsUpdated(list);
      }
    } catch (err: any) {
      console.error('Failed to load destinations:', err);
      showToast('Error loading Telegram destinations.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = (type: 'channel' | 'group' = 'channel') => {
    setEditingItem(null);
    setModalTestStatus(null);
    setFormData({
      type,
      displayName: type === 'channel' ? `Channel ${channels.filter((c) => c.type === 'channel').length + 1}` : `Group ${channels.filter((c) => c.type === 'group').length + 1}`,
      username: '',
      chatId: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: TelegramChannelItem) => {
    setEditingItem(item);
    setModalTestStatus(item.status === 'verified' ? {
      tested: true,
      success: true,
      status: 'Connected',
      message: '✅ Connected',
    } : item.status === 'error' ? {
      tested: true,
      success: false,
      status: 'Bot is not Admin',
      message: item.verifyError || '❌ Verification Failed',
      error: item.verifyError,
    } : null);

    setFormData({
      type: item.type,
      displayName: item.displayName,
      username: item.username,
      chatId: item.chatId || item.username,
      active: item.active,
    });
    setIsModalOpen(true);
  };

  // Test single destination connection (for table row button)
  const handleTestRowConnection = async (item: TelegramChannelItem) => {
    if (!config.botToken) {
      showToast('Please set Telegram Bot Token in Settings first.', 'error');
      return;
    }

    setTestingId(item.id);
    try {
      const res = await verifySingleChannelGroup(config.botToken, item);
      const updatedList = channels.map((c) => {
        if (c.id === item.id) {
          return {
            ...c,
            status: (res.success ? 'verified' : 'error') as 'verified' | 'error',
            verifyError: res.error || (res.success ? '' : res.statusMessage),
          };
        }
        return c;
      });

      setChannels(updatedList);
      if (onDestinationsUpdated) {
        onDestinationsUpdated(updatedList);
      }

      // Update in Firestore
      await saveTelegramChannel({
        ...item,
        status: res.success ? 'verified' : 'error',
        verifyError: res.error || res.statusMessage,
      });

      if (res.success) {
        showToast(`✅ ${item.displayName}: Connected Successfully!`, 'success');
      } else {
        showToast(`❌ ${item.displayName}: ${res.statusMessage}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error testing ${item.displayName}: ${err.message}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  // Test connection inside Modal before saving
  const handleTestModalConnection = async (): Promise<boolean> => {
    if (!config.botToken) {
      showToast('Bot Token is required. Set Bot Token in Telegram Settings.', 'error');
      setModalTestStatus({
        tested: true,
        success: false,
        status: 'Bot is not Admin',
        message: '❌ Bot Token Missing in Settings',
        error: 'Configure Telegram Bot Token before validating access.',
      });
      return false;
    }

    if (!formData.username.trim() && !formData.chatId.trim()) {
      showToast('Channel Username or Chat ID is required.', 'error');
      setModalTestStatus({
        tested: true,
        success: false,
        status: 'Invalid Chat ID',
        message: '❌ Invalid Chat ID / Missing Username',
        error: 'Provide a valid @username or Chat ID (e.g. -100xxxxxxxxxx).',
      });
      return false;
    }

    setIsTestingModalConnection(true);
    setModalTestStatus({
      tested: false,
      success: false,
      status: 'Checking',
      message: '⏳ Validating Bot access, Chat ID & Username...',
    });

    const tempItem: TelegramChannelItem = {
      id: editingItem?.id || 'temp',
      type: formData.type,
      displayName: formData.displayName || 'Test Channel',
      username: formData.username,
      chatId: formData.chatId || formData.username,
      required: true,
      active: formData.active,
      position: 0,
      createdAt: new Date().toISOString(),
    };

    const res = await verifySingleChannelGroup(config.botToken, tempItem);
    setIsTestingModalConnection(false);

    setModalTestStatus({
      tested: true,
      success: res.success,
      status: res.status,
      message: res.statusMessage,
      error: res.error,
    });

    if (res.success) {
      showToast(`✅ Connected! Validated bot access for ${formData.displayName || 'Destination'}.`, 'success');
      return true;
    } else {
      showToast(`${res.statusMessage}: ${res.error || 'Validation failed'}`, 'error');
      return false;
    }
  };

  // Save Modal Destination
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.displayName.trim()) {
      showToast('Channel / Group Name is required.', 'error');
      return;
    }

    if (!formData.username.trim() && !formData.chatId.trim()) {
      showToast('Channel Username or Chat ID is required.', 'error');
      return;
    }

    setIsSavingItem(true);
    try {
      // Step 1: Perform live validation before saving
      let verifyStatus: 'verified' | 'error' | 'unverified' = 'unverified';
      let verifyErr = '';

      if (config.botToken) {
        const testRes = await verifySingleChannelGroup(config.botToken, {
          id: editingItem?.id || 'temp',
          type: formData.type,
          displayName: formData.displayName,
          username: formData.username,
          chatId: formData.chatId || formData.username,
          required: true,
          active: formData.active,
          position: 0,
          createdAt: new Date().toISOString(),
        });

        verifyStatus = testRes.success ? 'verified' : 'error';
        verifyErr = testRes.error || testRes.statusMessage;

        setModalTestStatus({
          tested: true,
          success: testRes.success,
          status: testRes.status,
          message: testRes.statusMessage,
          error: testRes.error,
        });

        if (!testRes.success) {
          showToast(`Warning: Saving destination with status: ${testRes.statusMessage}`, 'info');
        }
      }

      // Step 2: Save item to Firestore
      const saved = await saveTelegramChannel({
        id: editingItem?.id,
        type: formData.type,
        displayName: formData.displayName,
        username: formData.username,
        chatId: formData.chatId || formData.username,
        required: true,
        active: formData.active,
        position: editingItem ? editingItem.position : channels.length,
        createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
        status: verifyStatus,
        verifyError: verifyErr,
      });

      showToast(`Saved ${saved.displayName} successfully!`, 'success');
      setIsModalOpen(false);
      loadDestinations();
    } catch (err: any) {
      console.error('Save destination error:', err);
      showToast(`Failed to save destination: ${err.message}`, 'error');
    } finally {
      setIsSavingItem(false);
    }
  };

  // Toggle Active State directly in row
  const handleToggleActiveRow = async (item: TelegramChannelItem) => {
    const updated = { ...item, active: !item.active };
    try {
      await saveTelegramChannel(updated);
      const list = channels.map((c) => (c.id === item.id ? updated : c));
      setChannels(list);
      if (onDestinationsUpdated) {
        onDestinationsUpdated(list);
      }
      showToast(`${item.displayName} is now ${updated.active ? 'Active' : 'Inactive'}.`, 'info');
    } catch (err: any) {
      showToast(`Error updating active state: ${err.message}`, 'error');
    }
  };

  // Delete Destination
  const handleDeleteRow = async (item: TelegramChannelItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.displayName}"?`)) {
      return;
    }

    try {
      await deleteTelegramChannel(item.id);
      const updated = channels.filter((c) => c.id !== item.id);
      setChannels(updated);
      if (onDestinationsUpdated) {
        onDestinationsUpdated(updated);
      }
      showToast(`Deleted ${item.displayName} successfully.`, 'success');
    } catch (err: any) {
      showToast(`Failed to delete destination: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Box */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📢 Telegram Destinations</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold">
                  {channels.length} Configured
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage unlimited channels and groups for broadcasts, notifications, and force-join checks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenAdd('channel')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>➕ Add More</span>
            </button>
          </div>
        </div>

        {/* Destination List Table / Cards */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading Telegram destinations...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mx-auto">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">No Telegram Destinations Added Yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Add More" above to configure channels or groups.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAdd('channel')}
              className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold text-xs hover:bg-sky-500/30 transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Destination</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Username / Chat ID</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Active</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {channels.map((item) => {
                  const isTesting = testingId === item.id;
                  const cleanUser = item.username ? `@${item.username.replace(/^@/, '')}` : 'N/A';
                  const cleanChat = item.chatId || cleanUser;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      {/* Type Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            item.type === 'channel'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {item.type === 'channel' ? '📢 Channel' : '👥 Group'}
                        </span>
                      </td>

                      {/* Display Name */}
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {item.displayName}
                      </td>

                      {/* Username & Chat ID */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="text-sky-400 font-bold flex items-center gap-1">
                            <span>{cleanUser}</span>
                            {item.username && (
                              <a
                                href={`https://t.me/${item.username.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-sky-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-slate-500 text-[10px]">ID: {cleanChat}</div>
                        </div>
                      </td>

                      {/* Live Validation Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>✅ Connected</span>
                          </span>
                        ) : item.status === 'error' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[11px]"
                            title={item.verifyError || 'Verification failed'}
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>{item.verifyError || '❌ Verification Failed'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-medium text-[11px]">
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </td>

                      {/* Active Toggle Switch */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActiveRow(item)}
                          className={`p-1 rounded-lg transition ${
                            item.active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={item.active ? 'Active (Click to disable)' : 'Inactive (Click to enable)'}
                        >
                          {item.active ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Connection Button */}
                          <button
                            type="button"
                            onClick={() => handleTestRowConnection(item)}
                            disabled={isTesting}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 font-bold text-[11px] transition flex items-center gap-1 disabled:opacity-50"
                            title="Test Bot Connection & Permissions"
                          >
                            <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                            <span>Test</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            title="Edit Destination"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                            title="Delete Destination"
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

      {/* ADD / EDIT DESTINATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-sky-400" />
                <span>{editingItem ? 'Edit Telegram Destination' : 'Add New Telegram Destination'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
              {/* Type Selection Radio Group */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">Destination Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'channel' }))}
                    className={`p-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                      formData.type === 'channel'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    <span>📢 Channel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'group' }))}
                    className={`p-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                      formData.type === 'group'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Users2 className="w-4 h-4" />
                    <span>👥 Group</span>
                  </button>
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">
                  Channel / Group Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g. Main Announcements Channel"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">
                  Channel Username (@username)
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      username: formatTelegramUsername(e.target.value),
                    }))
                  }
                  placeholder="e.g. @roy_official_channel"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sky-300 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Chat ID Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">
                  Channel / Group ID (e.g. -100xxxxxxxxxx)
                </label>
                <input
                  type="text"
                  value={formData.chatId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, chatId: e.target.value }))}
                  placeholder="e.g. -1001234567890 or @roy_official_channel"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-500">
                  Tip: Required for private groups/channels. For public channels, username works automatically.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Active Status</span>
                  <span className="text-[11px] text-slate-400">Enable to include in broadcasts & checks</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, active: !prev.active }))}
                  className={`p-1 rounded-lg transition ${
                    formData.active ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  {formData.active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              {/* Test Connection Result Box inside Modal */}
              {modalTestStatus && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium space-y-1 ${
                    modalTestStatus.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {modalTestStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{modalTestStatus.message}</span>
                  </p>
                  {modalTestStatus.error && (
                    <p className="text-[11px] text-slate-300 pl-5">{modalTestStatus.error}</p>
                  )}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestModalConnection}
                  disabled={isTestingModalConnection}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTestingModalConnection ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Test Connection</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingItem}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingItem ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Destination</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
