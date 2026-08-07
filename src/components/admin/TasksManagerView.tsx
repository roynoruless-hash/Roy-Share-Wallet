import React, { useState, useEffect } from 'react';
import {
  fetchTasksFromDb,
  saveTaskToDb,
  deleteTaskFromDb
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
  ExternalLink
} from 'lucide-react';
import { TaskItem } from '../../types';

interface TasksManagerViewProps {
  config: any;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const TasksManagerView: React.FC<TasksManagerViewProps> = ({
  config,
  showToast
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState<number>(10);
  const [coins, setCoins] = useState<number>(25);
  const [verificationType, setVerificationType] = useState<'automatic' | 'manual' | 'none'>('none');
  const [icon, setIcon] = useState('CheckSquare');
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [url, setUrl] = useState('');
  const [active, setActive] = useState<boolean>(true);

  const iconsList = [
    { name: 'CheckSquare', icon: CheckSquare, desc: 'Generic Check' },
    { name: 'Users', icon: Users, desc: 'Invite / Group' },
    { name: 'Tv', icon: Tv, desc: 'Watch Video' },
    { name: 'Share2', icon: Share2, desc: 'Share / Social' },
  ];

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const list = await fetchTasksFromDb();
      setTasks(list);
    } catch (err: any) {
      showToast('Error loading tasks: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleEdit = (task: TaskItem) => {
    setEditingId(task.id);
    setTitle(task.title);
    setReward(task.reward);
    setCoins(task.coins);
    setVerificationType(task.verificationType);
    setIcon(task.icon);
    setSortOrder(task.sortOrder);
    setUrl(task.url || '');
    setActive(task.active);
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
    setActive(true);
    setShowForm(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Task title is required', 'error');
      return;
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
        active,
      };

      if (editingId) {
        taskData.id = editingId;
      }

      await saveTaskToDb(taskData);
      showToast(editingId ? 'Task updated successfully' : 'Task created successfully', 'success');
      setShowForm(false);
      loadTasks();
    } catch (err: any) {
      showToast('Error saving task: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this task? This is irreversible.')) {
      return;
    }

    try {
      await deleteTaskFromDb(id);
      showToast('Task deleted successfully', 'success');
      loadTasks();
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
      loadTasks();
    } catch (err: any) {
      showToast('Error toggling task status: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/40 border border-slate-800/60">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-amber-500" />
            <span>Task Management Suite</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create, manage, and monitor custom, real-time user tasks credited with custom cash and coins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/10 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Task</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSaveTask} className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-sm font-black text-white">
              {editingId ? '✏️ Edit Task Details' : '➕ Create Dynamic Task'}
            </span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-400 block">Task Title / Instruction</label>
              <input
                type="text"
                placeholder="e.g. Join Our Telegram Official News Channel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block">Cash Reward (₹)</label>
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
              <label className="text-xs font-bold text-slate-400 block">Coins Reward</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={coins}
                onChange={(e) => setCoins(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                min="0"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block">Verification Type</label>
              <select
                value={verificationType}
                onChange={(e) => setVerificationType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none"
              >
                <option value="none">None (Instant Reward)</option>
                <option value="automatic">Automatic System Verification</option>
                <option value="manual">Manual Admin Audit Approval</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block">Sort Order (Rank)</label>
              <input
                type="number"
                placeholder="e.g. 10"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none"
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-400 block">External Destination Link (URL - Optional)</label>
              <input
                type="url"
                placeholder="e.g. https://t.me/news_channel"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-white outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-400 block">Select Task Visual Theme Icon</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {iconsList.map((ic) => {
                  const IconComp = ic.icon;
                  const isSelected = icon === ic.name;
                  return (
                    <button
                      key={ic.name}
                      type="button"
                      onClick={() => setIcon(ic.name)}
                      className={`flex items-center gap-2 p-2.5 border rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{ic.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2.5 py-2 sm:col-span-2">
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
                <span>Task is active and visible to app users</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
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

      {isLoading ? (
        <div className="p-10 rounded-3xl bg-slate-900/20 border border-slate-800/40 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading dynamic tasks from ledger...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-10 rounded-3xl bg-slate-900/20 border border-slate-800/40 text-center space-y-2">
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
                className={`p-5 rounded-3xl border transition flex flex-col justify-between gap-4 ${
                  task.active
                    ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-950/20 border-slate-900 opacity-65'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl text-amber-400">
                        <IconComponent className="w-5 h-5" />
                      </div>
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

                  <div className="flex items-center gap-4 text-xs font-bold pt-1.5">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>₹{task.reward}</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-400">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{task.coins} Coins</span>
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize px-2 py-0.5 bg-slate-950 rounded">
                      {task.verificationType === 'none' ? 'Instant' : task.verificationType === 'manual' ? 'Audit' : 'Auto'}
                    </span>
                  </div>

                  {task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono break-all"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>{task.url}</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-850">
                  <button
                    onClick={() => handleToggleActive(task)}
                    className={`flex items-center gap-1 text-[10px] font-bold transition ${
                      task.active ? 'text-slate-400 hover:text-amber-400' : 'text-emerald-500 hover:text-emerald-400'
                    }`}
                  >
                    {task.active ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Disable Task</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Enable Task</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                      title="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
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
  );
};
