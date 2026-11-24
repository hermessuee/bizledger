'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  ROLES,
  MENU_KEYS,
  MENU_LABELS,
  Role,
  MenuKey,
} from '@bizledger/shared';
import {
  Shield,
  UserPlus,
  KeyRound,
  Check,
  X,
  RefreshCw,
  Lock,
} from 'lucide-react';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Granular permissions matrix for the new user or editing user
  const [permissionsState, setPermissionsState] = useState<
    Record<MenuKey, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean }>
  >(() => {
    const p: any = {};
    for (const key of MENU_KEYS) {
      p[key] = { canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false };
    }
    return p;
  });

  // Edit Permissions Modal
  const [editPermsUser, setEditPermsUser] = useState<any | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/users');
      setUsers(res.users || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generateSecurePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const special = '@#$%&*!';
    let pass = '';
    pass += upper[Math.floor(Math.random() * upper.length)];
    pass += lower[Math.floor(Math.random() * lower.length)];
    pass += numbers[Math.floor(Math.random() * numbers.length)];
    pass += special[Math.floor(Math.random() * special.length)];
    const all = upper + lower + numbers + special;
    for (let i = 4; i < 12; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }
    setPassword(pass);
  };

  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 5
  };

  const strength = calculatePasswordStrength(password);
  const strengthLabels = ['Too Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-blue-500', 'bg-emerald-500', 'bg-green-600'];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const permsArray = Object.entries(permissionsState).map(([menuKey, perms]) => ({
        menuKey: menuKey as MenuKey,
        ...perms,
      }));

      await api.post('/api/v1/users', {
        name,
        username,
        email,
        role,
        password,
        isActive,
        mustChangePassword,
        permissions: permsArray,
      });

      setIsAddOpen(false);
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      await api.put(`/api/v1/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleSavePermissions = async () => {
    if (!editPermsUser) return;
    try {
      const permsArray = Object.entries(editPermsUser.permissions).map(([menuKey, perms]: any) => ({
        menuKey: menuKey as MenuKey,
        ...perms,
      }));
      await api.put(`/api/v1/users/${editPermsUser.id}/permissions`, {
        permissions: permsArray,
      });
      setEditPermsUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update permissions');
    }
  };

  return (
    <AppShell currentMenu="users">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              User Management & Access Control
            </h1>
            <p className="text-xs text-slate-500">
              Configure user roles and granular per-menu permissions (View, Create, Edit, Delete, Export)
            </p>
          </div>

          {hasPermission('users', 'create') && (
            <button
              onClick={() => {
                generateSecurePassword();
                setIsAddOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Add User
            </button>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {u.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      @{u.username}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {hasPermission('users', 'edit') && (
                        <>
                          <button
                            onClick={() => {
                              setEditPermsUser(JSON.parse(JSON.stringify(u)));
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold"
                          >
                            Permissions Matrix
                          </button>
                          {u.role !== 'owner' && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold ${
                                u.isActive
                                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Add New User & Assign Permissions
              </h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ananya"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ananya@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white font-medium"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password with generator & strength meter */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg space-y-2 border">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Initial Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-blue-600 font-semibold inline-flex items-center hover:underline"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Generate Strong Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg font-mono outline-none"
                />
                {/* Strength Meter */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Strength:</span>
                    <span className="font-semibold">{strengthLabels[strength]}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strengthColors[strength]} transition-all duration-300`}
                      style={{ width: `${(strength / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Force password change on first login</span>
                </label>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold">
                  Menu-Level Permissions Checklist
                </div>
                <div className="max-h-56 overflow-y-auto divide-y">
                  {MENU_KEYS.map((key) => (
                    <div key={key} className="px-3 py-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{MENU_LABELS[key]}</span>
                      <div className="flex space-x-3 text-[11px]">
                        {(['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport'] as const).map(
                          (act) => (
                            <label key={act} className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                checked={permissionsState[key]?.[act] || false}
                                onChange={(e) => {
                                  const updated = { ...permissionsState };
                                  updated[key] = {
                                    ...updated[key],
                                    [act]: e.target.checked,
                                  };
                                  setPermissionsState(updated);
                                }}
                              />
                              <span className="capitalize">{act.replace('can', '')}</span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Matrix Modal */}
      {editPermsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-sm">
                Permissions Matrix for {editPermsUser.name} (@{editPermsUser.username})
              </h3>
              <button onClick={() => setEditPermsUser(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs divide-y">
              {MENU_KEYS.map((key) => {
                const p = editPermsUser.permissions?.[key] || {
                  canView: false,
                  canCreate: false,
                  canEdit: false,
                  canDelete: false,
                  canExport: false,
                };
                return (
                  <div key={key} className="pt-2 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{MENU_LABELS[key]}</span>
                    <div className="flex space-x-3 text-[11px]">
                      {(['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport'] as const).map(
                        (act) => (
                          <label key={act} className="flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={Boolean(p[act])}
                              onChange={(e) => {
                                const updated = { ...editPermsUser.permissions };
                                updated[key] = {
                                  ...(updated[key] || {}),
                                  [act]: e.target.checked,
                                };
                                setEditPermsUser({ ...editPermsUser, permissions: updated });
                              }}
                            />
                            <span className="capitalize">{act.replace('can', '')}</span>
                          </label>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditPermsUser(null)}
                className="px-4 py-2 border rounded-lg text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
