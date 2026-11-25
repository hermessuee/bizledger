'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Business, MenuKey, MENU_LABELS, MENU_KEYS } from '@bizledger/shared';
import {
  ShieldAlert,
  Building2,
  Users,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Search,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface DistributorWithStats extends Business {
  stats: {
    users: number;
    customers: number;
    vendors: number;
    invoices: number;
    cheques: number;
  };
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<DistributorWithStats[]>([]);
  const [availableMenus, setAvailableMenus] = useState<MenuKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected business for Module Management Modal
  const [selectedBusiness, setSelectedBusiness] = useState<DistributorWithStats | null>(null);
  const [activeMenus, setActiveMenus] = useState<MenuKey[]>([]);
  const [savingModules, setSavingModules] = useState(false);

  const fetchDistributors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/admin/businesses');
      setBusinesses(res.businesses || []);
      setAvailableMenus(res.availableMenus || []);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch distributors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const handleOpenModuleModal = (b: DistributorWithStats) => {
    setSelectedBusiness(b);
    setActiveMenus(b.enabledMenus && b.enabledMenus.length > 0 ? b.enabledMenus : [...MENU_KEYS]);
  };

  const handleToggleMenu = (menuKey: MenuKey) => {
    if (activeMenus.includes(menuKey)) {
      setActiveMenus(activeMenus.filter((k) => k !== menuKey));
    } else {
      setActiveMenus([...activeMenus, menuKey]);
    }
  };

  const handleSaveModules = async () => {
    if (!selectedBusiness) return;
    try {
      setSavingModules(true);
      await api.put(`/api/v1/admin/businesses/${selectedBusiness.id}/modules`, {
        enabledMenus: activeMenus,
      });
      setSelectedBusiness(null);
      fetchDistributors();
    } catch (err: any) {
      alert(err.message || 'Failed to update modules');
    } finally {
      setSavingModules(false);
    }
  };

  const handleStatusChange = async (businessId: string, status: 'active' | 'suspended' | 'trial') => {
    try {
      await api.put(`/api/v1/admin/businesses/${businessId}/status`, { status });
      fetchDistributors();
    } catch (err: any) {
      alert(err.message || 'Failed to update distributor status');
    }
  };

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.gstin && b.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell currentMenu="admin_portal">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Hermes Super-Admin Portal
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global multi-tenant governance, module access toggles, and distributor management.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search distributor or GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total Distributors</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{businesses.length}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Active Businesses</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {businesses.filter((b) => b.status === 'active' || !b.status).length}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total Distributor Users</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {businesses.reduce((sum, b) => sum + (b.stats?.users || 0), 0)}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Platform Invoices Generated</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {businesses.reduce((sum, b) => sum + (b.stats?.invoices || 0), 0)}
            </p>
          </div>
        </div>

        {/* Distributor Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Registered Distributor Businesses</h2>
            <span className="text-xs text-slate-500">{filteredBusinesses.length} firm(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Distributor / Business Name</th>
                  <th className="py-3 px-4">GSTIN & State</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Users</th>
                  <th className="py-3 px-4 text-center">Customers</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 text-center">Cheques</th>
                  <th className="py-3 px-4 text-center">Modules Enabled</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBusinesses.map((b) => {
                  const enabledCount = b.enabledMenus ? b.enabledMenus.length : availableMenus.length;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div>
                            <p>{b.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {b.id.slice(0, 13)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-slate-800 dark:text-slate-200">{b.gstin || 'Unregistered'}</p>
                        <p className="text-[10px] text-slate-400">State: {b.stateCode || '27'}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={b.status || 'active'}
                          onChange={(e) => handleStatusChange(b.id, e.target.value as any)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border focus:outline-none cursor-pointer ${
                            b.status === 'suspended'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : b.status === 'trial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="trial">Trial</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{b.stats?.users || 0}</td>
                      <td className="py-3 px-4 text-center">{b.stats?.customers || 0}</td>
                      <td className="py-3 px-4 text-center font-mono">{b.stats?.invoices || 0}</td>
                      <td className="py-3 px-4 text-center font-mono">{b.stats?.cheques || 0}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900/50 text-[11px]">
                          {enabledCount} of {availableMenus.length}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenModuleModal(b)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition inline-flex items-center space-x-1"
                          title="Manage Modules and Features for this distributor"
                        >
                          <Sliders className="w-3.5 h-3.5 text-blue-600" />
                          <span>Configure Modules</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module Management Modal */}
        {selectedBusiness && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Module Permissions: {selectedBusiness.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enable or disable specific features/menus for this distributor.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Available Module</span>
                  <div className="space-x-2">
                    <button
                      onClick={() => setActiveMenus([...MENU_KEYS].filter((k) => k !== 'admin_portal'))}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Enable All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setActiveMenus(['dashboard'])}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Disable All Optional
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(MENU_LABELS).map(([key, label]) => {
                    const menuKey = key as MenuKey;
                    if (menuKey === 'admin_portal') return null; // do not assign super-admin to distributor
                    const isEnabled = activeMenus.includes(menuKey);

                    return (
                      <div
                        key={menuKey}
                        onClick={() => handleToggleMenu(menuKey)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition ${
                          isEnabled
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 text-slate-900 dark:text-white font-medium'
                            : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <span>{label}</span>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                            isEnabled
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModules}
                  disabled={savingModules}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {savingModules ? 'Saving Changes...' : 'Save Module Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
