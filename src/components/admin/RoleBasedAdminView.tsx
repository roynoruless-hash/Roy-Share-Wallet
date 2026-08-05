import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, Key, Lock, CheckCircle2, AlertCircle, Plus, Users } from 'lucide-react';
import { AdminRole } from '../../types';

export const RoleBasedAdminView: React.FC = () => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; username: string; roleId: string; assignedAt: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Assign Role Form
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('event_manager');

  const allPermissions = [
    { key: 'manage_events', label: 'Manage Events & Drops' },
    { key: 'manage_users', label: 'User Management & Bans' },
    { key: 'manage_withdrawals', label: 'Approve & Process Withdrawals' },
    { key: 'manage_roles', label: 'Manage Roles & Permissions' },
    { key: 'manage_backups', label: 'Backup & Restore Data' },
    { key: 'view_audit_logs', label: 'View Audit Logs' },
    { key: 'manage_settings', label: 'System Settings & Config' },
    { key: 'toggle_feature_flags', label: 'Toggle Feature Flags' },
  ];

  const fetchRbacData = async () => {
    setLoading(true);
    try {
      const [roleRes, userRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/users/roles'),
      ]);
      const roleData = await roleRes.json();
      const userData = await userRes.json();
      if (roleData.success) setRoles(roleData.roleMatrix.roles || []);
      if (userData.success) setAdminUsers(userData.adminUsers || []);
    } catch (err) {
      console.error('Failed to load RBAC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRbacData();
  }, []);

  const handleTogglePermission = (roleId: string, permKey: string) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;
        const hasPerm = role.permissions.includes(permKey);
        const updatedPerms = hasPerm
          ? role.permissions.filter((p) => p !== permKey)
          : [...role.permissions, permKey];
        return { ...role, permissions: updatedPerms };
      })
    );
  };

  const handleSaveRolePermissions = async () => {
    try {
      const res = await fetch('/api/admin/roles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Role permissions updated successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update roles' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    try {
      const res = await fetch('/api/admin/users/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUsername, roleId: selectedRoleId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Role ${selectedRoleId} assigned to ${targetUsername}` });
        setTargetUsername('');
        fetchRbacData();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to assign role' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Phase XIII Enterprise Operations</span>
          </div>
          <h2 className="text-xl font-black text-white">Role-Based Access Control (RBAC)</h2>
          <p className="text-xs text-slate-400 mt-1">
            Granular permission matrix for Super Admin, Event Manager, Support, and Moderator roles.
          </p>
        </div>

        <button
          onClick={handleSaveRolePermissions}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition"
        >
          <Lock className="w-4 h-4" />
          <span>Save Role Matrix</span>
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

      {/* Permissions Matrix */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading RBAC system...</div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Role Permissions Matrix</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold">
                  <th className="p-3">Permission Capability</th>
                  {roles.map((r) => (
                    <th key={r.id} className="p-3 text-center min-w-[120px]">
                      <span className="text-white block font-bold">{r.name}</span>
                      <span className="text-[10px] font-normal text-slate-500 block truncate max-w-[120px]">
                        {r.description}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allPermissions.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-800/30 transition">
                    <td className="p-3 font-semibold text-slate-300">{perm.label}</td>
                    {roles.map((r) => {
                      const isAllowed = r.permissions.includes(perm.key);
                      const isSuperAdmin = r.id === 'super_admin';
                      return (
                        <td key={r.id} className="p-3 text-center">
                          <button
                            disabled={isSuperAdmin}
                            onClick={() => handleTogglePermission(r.id, perm.key)}
                            className={`w-6 h-6 rounded-lg inline-flex items-center justify-center transition ${
                              isAllowed
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                                : 'bg-slate-950 text-slate-600 border border-slate-800'
                            }`}
                          >
                            {isAllowed ? '✓' : '✕'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin User Assignment Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form: Assign Role */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Assign Role to Admin User</span>
          </h3>

          <form onSubmit={handleAssignRole} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Admin Username</label>
              <input
                type="text"
                required
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="e.g. event_manager_1"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Select Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold shadow-md transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Admin Role</span>
            </button>
          </form>
        </div>

        {/* Assigned Admin Accounts */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <span>Assigned Admin Accounts ({adminUsers.length})</span>
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {adminUsers.map((usr) => (
              <div
                key={usr.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-white">{usr.username}</p>
                  <p className="text-[10px] text-slate-500">
                    Assigned: {new Date(usr.assignedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {roles.find((r) => r.id === usr.roleId)?.name || usr.roleId}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
