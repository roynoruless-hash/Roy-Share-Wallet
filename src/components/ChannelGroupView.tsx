import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Download,
  Upload,
  ToggleLeft,
  ToggleRight,
  Radio,
  Users2,
  ShieldCheck,
  Layers,
  Info,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Play,
} from 'lucide-react';
import { AdminConfig, TelegramChannelItem } from '../types';
import {
  getTelegramChannels,
  saveTelegramChannel,
  deleteTelegramChannel,
  updateChannelsPositions,
  setAllChannelsActiveStatus,
  verifySingleChannelGroup,
  verifyAndSyncAllChannels,
} from '../services/channelService';
import { formatTelegramUsername } from '../services/telegramService';

interface ChannelGroupViewProps {
  config: AdminConfig;
  updateConfig: (fields: Partial<AdminConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ChannelGroupView: React.FC<ChannelGroupViewProps> = ({
  config,
  updateConfig,
  onSave,
  isSaving,
  showToast,
}) => {
  const [channels, setChannels] = useState<TelegramChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifyingAll, setIsVerifyingAll] = useState<boolean>(false);
  const [testingItemId, setTestingItemId] = useState<string | null>(null);

  // Modal States
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TelegramChannelItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<{
    type: 'channel' | 'group';
    displayName: string;
    username: string;
    chatId: string;
    required: boolean;
    active: boolean;
  }>({
    type: 'channel',
    displayName: '',
    username: '',
    chatId: '',
    required: true,
    active: true,
  });

  // Import / Export / Preview Modal States
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<TelegramChannelItem | null>(null);

  // Load channels on mount
  useEffect(() => {
    loadChannelsList();
  }, []);

  const loadChannelsList = async () => {
    setIsLoading(true);
    try {
      let list = await getTelegramChannels();

      // Seeding default items if database collection is empty but legacy config usernames exist
      if (list.length === 0 && (config.mainChannelUsername || config.mainGroupUsername)) {
        const seeded: TelegramChannelItem[] = [];
        if (config.mainChannelUsername) {
          const item1 = await saveTelegramChannel({
            type: 'channel',
            displayName: 'Main Channel 1',
            username: config.mainChannelUsername,
            chatId: config.mainChannelUsername,
            required: true,
            active: true,
            position: 0,
            createdAt: new Date().toISOString(),
            status: 'unverified',
          });
          seeded.push(item1);
        }
        if (config.mainGroupUsername) {
          const item2 = await saveTelegramChannel({
            type: 'group',
            displayName: 'Main Group 1',
            username: config.mainGroupUsername,
            chatId: config.mainGroupUsername,
            required: true,
            active: true,
            position: 1,
            createdAt: new Date().toISOString(),
            status: 'unverified',
          });
          seeded.push(item2);
        }
        list = seeded;
      }

      setChannels(list);
    } catch (err: any) {
      console.error('Failed to load channels:', err);
      showToast('Error loading channels from database.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = (type: 'channel' | 'group') => {
    setEditingItem(null);
    setFormData({
      type,
      displayName: type === 'channel' ? `Channel ${channels.filter(c => c.type === 'channel').length + 1}` : `Group ${channels.filter(c => c.type === 'group').length + 1}`,
      username: '',
      chatId: '',
      required: true,
      active: true,
    });
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: TelegramChannelItem) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      displayName: item.displayName,
      username: item.username,
      chatId: item.chatId || item.username,
      required: item.required,
      active: item.active,
    });
    setIsAddEditOpen(true);
  };

  // Save Add/Edit Form
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      showToast('Username is required.', 'error');
      return;
    }
    if (!formData.displayName.trim()) {
      showToast('Display Name is required.', 'error');
      return;
    }

    const cleanUsername = formatTelegramUsername(formData.username);
    const cleanChatId = formData.chatId.trim() || cleanUsername;

    try {
      const position = editingItem ? editingItem.position : channels.length;

      const saved = await saveTelegramChannel({
        id: editingItem?.id,
        type: formData.type,
        displayName: formData.displayName.trim(),
        username: cleanUsername,
        chatId: cleanChatId,
        required: formData.required,
        active: formData.active,
        position,
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        status: editingItem?.status || 'unverified',
        verifyError: editingItem?.verifyError || '',
      });

      if (editingItem) {
        setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        showToast(`Updated ${saved.displayName} successfully!`, 'success');
      } else {
        setChannels((prev) => [...prev, saved]);
        showToast(`Added ${saved.displayName} successfully!`, 'success');
      }

      // Sync primary main usernames to config for backwards compatibility
      if (channels.length === 0 || position === 0) {
        if (saved.type === 'channel') updateConfig({ mainChannelUsername: saved.username });
        if (saved.type === 'group') updateConfig({ mainGroupUsername: saved.username });
      }

      setIsAddEditOpen(false);
    } catch (err: any) {
      console.error('Error saving channel item:', err);
      showToast(`Failed to save item: ${err.message}`, 'error');
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: TelegramChannelItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.displayName}"?`)) return;

    try {
      await deleteTelegramChannel(item.id);
      const updated = channels.filter((c) => c.id !== item.id);
      setChannels(updated);
      await updateChannelsPositions(updated);
      showToast(`Deleted ${item.displayName}.`, 'info');
    } catch (err: any) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    }
  };

  // Toggle item active
  const handleToggleItemActive = async (item: TelegramChannelItem) => {
    const newActive = !item.active;
    try {
      const saved = await saveTelegramChannel({ ...item, active: newActive });
      setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      showToast(`${item.displayName} set to ${newActive ? 'Active (ON)' : 'Inactive (OFF)'}`, 'info');
    } catch (err: any) {
      showToast(`Error toggling status: ${err.message}`, 'error');
    }
  };

  // Toggle item required
  const handleToggleItemRequired = async (item: TelegramChannelItem) => {
    const newRequired = !item.required;
    try {
      const saved = await saveTelegramChannel({ ...item, required: newRequired });
      setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      showToast(`${item.displayName} set to ${newRequired ? 'Required Join' : 'Optional Join'}`, 'info');
    } catch (err: any) {
      showToast(`Error toggling required status: ${err.message}`, 'error');
    }
  };

  // Move Up
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newArr = [...channels];
    const temp = newArr[index - 1];
    newArr[index - 1] = newArr[index];
    newArr[index] = temp;

    // re-index positions
    const reindexed = newArr.map((item, idx) => ({ ...item, position: idx }));
    setChannels(reindexed);
    await updateChannelsPositions(reindexed);
  };

  // Move Down
  const handleMoveDown = async (index: number) => {
    if (index >= channels.length - 1) return;
    const newArr = [...channels];
    const temp = newArr[index + 1];
    newArr[index + 1] = newArr[index];
    newArr[index] = temp;

    const reindexed = newArr.map((item, idx) => ({ ...item, position: idx }));
    setChannels(reindexed);
    await updateChannelsPositions(reindexed);
  };

  // Single Item Test
  const handleTestItem = async (item: TelegramChannelItem) => {
    if (!config.botToken.trim()) {
      showToast('Bot Token is required before testing. Please set it in Telegram Config.', 'error');
      return;
    }

    setTestingItemId(item.id);
    const testRes = await verifySingleChannelGroup(config.botToken, item);
    setTestingItemId(null);

    const newStatus = testRes.success ? 'verified' : 'error';
    const newError = testRes.error || '';

    const saved = await saveTelegramChannel({
      ...item,
      status: newStatus as any,
      verifyError: newError,
    });

    setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));

    if (testRes.success) {
      showToast(`✅ ${item.displayName} tested successfully! Bot is Admin/Member.`, 'success');
    } else {
      showToast(`❌ ${item.displayName} test failed: ${testRes.error}`, 'error');
    }
  };

  // Enable All
  const handleEnableAll = async () => {
    try {
      const updated = await setAllChannelsActiveStatus(channels, true);
      setChannels(updated);
      showToast('Enabled all channels and groups.', 'success');
    } catch (err: any) {
      showToast(`Failed to enable all: ${err.message}`, 'error');
    }
  };

  // Disable All
  const handleDisableAll = async () => {
    try {
      const updated = await setAllChannelsActiveStatus(channels, false);
      setChannels(updated);
      showToast('Disabled all channels and groups.', 'info');
    } catch (err: any) {
      showToast(`Failed to disable all: ${err.message}`, 'error');
    }
  };

  // Test All / Sync All
  const handleTestAll = async () => {
    if (!config.botToken.trim()) {
      showToast('Bot Token is required before testing all channels.', 'error');
      return;
    }

    setIsVerifyingAll(true);
    showToast('Testing all active channels and groups with Telegram API...', 'info');

    try {
      const tested = await verifyAndSyncAllChannels(config.botToken, channels);
      setChannels(tested);
      const verifiedCount = tested.filter((t) => t.status === 'verified').length;
      showToast(`Verification complete: ${verifiedCount}/${tested.length} active chats passed!`, 'success');
    } catch (err: any) {
      showToast(`Error testing all: ${err.message}`, 'error');
    } finally {
      setIsVerifyingAll(false);
    }
  };

  // Export List JSON
  const handleExportList = () => {
    const exportData = channels.map(({ id, status, verifyError, ...rest }) => rest);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'telegram_channels_groups_export.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported channels list to JSON file.', 'success');
  };

  // Import List JSON
  const handleImportSubmit = async () => {
    if (!importJsonText.trim()) {
      showToast('Please paste valid JSON array content.', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText.trim());
      if (!Array.isArray(parsed)) {
        showToast('Imported JSON must be an array of objects.', 'error');
        return;
      }

      let count = 0;
      for (const item of parsed) {
        if (item.username) {
          await saveTelegramChannel({
            type: item.type === 'group' ? 'group' : 'channel',
            displayName: item.displayName || item.username,
            username: item.username,
            chatId: item.chatId || item.username,
            required: item.required !== false,
            active: item.active !== false,
            position: typeof item.position === 'number' ? item.position : channels.length + count,
            createdAt: new Date().toISOString(),
            status: 'unverified',
          });
          count++;
        }
      }

      await loadChannelsList();
      setIsImportOpen(false);
      setImportJsonText('');
      showToast(`Successfully imported ${count} items!`, 'success');
    } catch (err: any) {
      showToast(`Invalid JSON format: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">Telegram Channels & Groups</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Multi-Join
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure unlimited Force Join channels & groups with automatic member verification.
              </p>
            </div>
          </div>

          {/* Add Buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              id="add-channel-btn"
              onClick={() => handleOpenAdd('channel')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Channel</span>
            </button>
            <button
              type="button"
              id="add-group-btn"
              onClick={() => handleOpenAdd('group')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700/80 flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Add Group</span>
            </button>
          </div>
        </div>

        {/* Global Settings & Toggles Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
          {/* Force Join Enable */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Force Join System</p>
              <p className="text-[11px] text-slate-400">Enforce channel & group membership on onboarding.</p>
            </div>
            <button
              type="button"
              id="global-force-join-toggle"
              onClick={() => updateConfig({ forceJoinEnabled: !config.forceJoinEnabled })}
              className={`p-1.5 rounded-lg transition ${
                config.forceJoinEnabled ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.forceJoinEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Auto Verification Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Auto Member Verification</p>
              <p className="text-[11px] text-slate-400">Query Telegram getChatMember automatically.</p>
            </div>
            <button
              type="button"
              id="global-auto-verify-toggle"
              onClick={() => updateConfig({ autoVerificationEnabled: !config.autoVerificationEnabled })}
              className={`p-1.5 rounded-lg transition ${
                config.autoVerificationEnabled ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {config.autoVerificationEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Verification Version Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex-1 mr-2">
              <p className="text-xs font-bold text-slate-200">Verification Version</p>
              <p className="text-[11px] text-slate-400">Version requirement for force join checks.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                id="verification-version-input"
                value={config.verificationVersion || 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  updateConfig({ verificationVersion: val });
                }}
                className="w-12 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs text-center font-bold font-mono focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                id="increment-version-btn"
                onClick={() => {
                  const current = config.verificationVersion || 1;
                  updateConfig({ verificationVersion: current + 1 });
                }}
                className="p-1 px-2 rounded bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 text-[11px] font-bold transition"
              >
                +1
              </button>
            </div>
          </div>
        </div>

        {/* Admin Extras Control Toolbar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="enable-all-btn"
              onClick={handleEnableAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" /> Enable All
            </button>
            <button
              type="button"
              id="disable-all-btn"
              onClick={handleDisableAll}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/30 flex items-center gap-1.5 transition"
            >
              <X className="w-3.5 h-3.5" /> Disable All
            </button>
            <button
              type="button"
              id="test-all-btn"
              onClick={handleTestAll}
              disabled={isVerifyingAll}
              className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold border border-sky-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isVerifyingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Test All</span>
            </button>
            <button
              type="button"
              id="sync-all-btn"
              onClick={handleTestAll}
              disabled={isVerifyingAll}
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingAll ? 'animate-spin' : ''}`} />
              <span>Sync All</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="import-list-btn"
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" /> Import List
            </button>
            <button
              type="button"
              id="export-list-btn"
              onClick={handleExportList}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Export List
            </button>
          </div>
        </div>
      </div>

      {/* Main Channels & Groups Card List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Active Items ({channels.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Drag or use ⬆ ⬇ arrows to reorder verification priority
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading Telegram Channels & Groups...</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">No Channels or Groups Configured</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Add your official Telegram channels and groups to start forcing users to join before accessing the bot.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleOpenAdd('channel')}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white font-bold text-xs hover:bg-sky-400 transition"
              >
                + Add First Channel
              </button>
              <button
                type="button"
                onClick={() => handleOpenAdd('group')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 border border-slate-700 transition"
              >
                + Add First Group
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((item, index) => {
              const formattedUser = item.username.startsWith('@') ? item.username : `@${item.username}`;
              const isChannel = item.type === 'channel';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 shadow-lg ${
                    item.active
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Item Info */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Badge Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isChannel
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                        }`}
                      >
                        {isChannel ? <Radio className="w-5 h-5" /> : <Users2 className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-100 truncate">
                            {item.displayName}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              isChannel
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                            }`}
                          >
                            {item.type}
                          </span>

                          {/* Required status badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleItemRequired(item)}
                            title="Click to toggle Required status"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition cursor-pointer ${
                              item.required
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {item.required ? 'Required Join' : 'Optional Join'}
                          </button>

                          {/* Verification status badge */}
                          {item.status === 'verified' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Bot Admin Verified
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Admin Missing / Error
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono text-slate-400 flex-wrap">
                          <span className="text-sky-300 font-medium">{formattedUser}</span>
                          {item.chatId && item.chatId !== formattedUser && (
                            <span className="text-slate-500">Chat ID: {item.chatId}</span>
                          )}
                        </div>

                        {item.verifyError && (
                          <p className="text-[11px] text-rose-400/90 font-mono pt-1">
                            ⚠️ {item.verifyError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 flex-wrap">
                      {/* Active Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemActive(item)}
                        title={item.active ? 'Disable item' : 'Enable item'}
                        className={`p-2 rounded-xl border transition ${
                          item.active
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {item.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>

                      {/* Up & Down Reorder Buttons */}
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === channels.length - 1}
                        title="Move Down"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800 transition"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Test single item */}
                      <button
                        type="button"
                        onClick={() => handleTestItem(item)}
                        disabled={testingItemId === item.id}
                        title="Test Bot Permissions"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 hover:text-sky-300 transition"
                      >
                        {testingItemId === item.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </button>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        title="Preview Telegram Card"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-400 hover:text-indigo-300 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Details"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 transition"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        title="Delete Item"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800 text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Save Changes */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            All additions and changes are synced directly to Firestore database.
          </p>

          <button
            type="button"
            id="save-channels-config-btn"
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* ================= ADD / EDIT MODAL ================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  {formData.type === 'channel' ? <Radio className="w-4 h-4" /> : <Users2 className="w-4 h-4" />}
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingItem ? 'Edit Telegram Item' : `Add Telegram ${formData.type === 'channel' ? 'Channel' : 'Group'}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'channel' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      formData.type === 'channel'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Radio className="w-4 h-4" /> Channel
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'group' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      formData.type === 'group'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users2 className="w-4 h-4" /> Group
                  </button>
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Roy Share Updates or Channel 1"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Telegram Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. @royshare_wallet"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Chat ID (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Telegram Chat ID (Optional)</label>
                <input
                  type="text"
                  value={formData.chatId}
                  onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                  placeholder="e.g. -100123456789 or @royshare_wallet"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-500">
                  Leave empty to automatically use the Username for member checking.
                </p>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Required Join</p>
                    <p className="text-[10px] text-slate-400">Must join to pass</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, required: !formData.required })}
                    className={`p-1 ${formData.required ? 'text-amber-400' : 'text-slate-600'}`}
                  >
                    {formData.required ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Active</p>
                    <p className="text-[10px] text-slate-400">Show in bot</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`p-1 ${formData.active ? 'text-emerald-400' : 'text-slate-600'}`}
                  >
                    {formData.active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= IMPORT JSON MODAL ================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Import Channels JSON</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste a JSON array of channel objects below to import in bulk:
            </p>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={`[\n  {\n    "displayName": "RoyShare Channel",\n    "type": "channel",\n    "username": "@royshare_wallet",\n    "required": true,\n    "active": true\n  }\n]`}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs"
              >
                Import List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TELEGRAM PREVIEW MODAL ================= */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Eye className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Telegram UI Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telegram Chat Bubble Mockup */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/30 space-y-3 font-sans">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Radio className="w-4 h-4" />
                <span>Roy Share Wallet Bot</span>
              </div>

              <div className="text-xs text-slate-200 leading-relaxed space-y-2">
                <p>👋 <b>Welcome to Roy Share Wallet Bot!</b></p>
                <p>To continue using this bot, please join our official chat:</p>
                <p className="font-semibold text-sky-300">
                  {previewItem.type === 'channel' ? '📢' : '👥'} {previewItem.displayName}:{' '}
                  <span className="font-mono">{previewItem.username}</span>
                </p>
              </div>

              {/* Inline Buttons Mockup */}
              <div className="space-y-1.5 pt-2">
                <a
                  href={`https://t.me/${previewItem.username.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  {previewItem.type === 'channel' ? '📢' : '👥'} Join {previewItem.displayName}
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>

                <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                  ✅ Verify Join
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
