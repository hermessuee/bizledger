'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Business, MenuKey, MENU_LABELS, MENU_KEYS, INDIAN_STATES } from '@bizledger/shared';
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
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Plus,
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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<DistributorWithStats[]>([]);
  const [availableMenus, setAvailableMenus] = useState<MenuKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Admin inline login state if unauthenticated
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Selected business for Module Management Modal
  const [selectedBusiness, setSelectedBusiness] = useState<DistributorWithStats | null>(null);
  const [activeMenus, setActiveMenus] = useState<MenuKey[]>([]);
  const [savingModules, setSavingModules] = useState(false);

  // Registration Modal State for Super Admin onboarding
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regStateCode, setRegStateCode] = useState('27');
  const [regAddress, setRegAddress] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 15);
    setRegGstin(upper);
    if (upper.length >= 2 && INDIAN_STATES[upper.slice(0, 2)]) {
      setRegStateCode(upper.slice(0, 2));
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters long');
      return;
    }

    try {
      setRegSubmitting(true);
      await api.post('/api/v1/admin/businesses', {
        businessName: regBusinessName,
        gstin: regGstin || undefined,
        stateCode: regStateCode,
        address: regAddress || undefined,
        ownerName: regOwnerName,
        email: regEmail,
        username: regUsername,
        password: regPassword,
      });

      setSuccessMessage(`Distributor "${regBusinessName}" registered successfully!`);
      setRegisterModalOpen(false);
      setRegBusinessName('');
      setRegGstin('');
      setRegAddress('');
      setRegOwnerName('');
      setRegEmail('');
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
      fetchDistributors();
    } catch (err: any) {
      setRegError(err.message || 'Failed to register distributor');
    } finally {
      setRegSubmitting(false);
    }
  };

  const fetchDistributors = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/v1/admin/businesses');
      setBusinesses(res.businesses || []);
      setAvailableMenus(res.availableMenus || []);
    } catch (err: any) {
      if (err?.status !== 401 && !err?.message?.includes('Authorization')) {
        setError(err.message || 'Failed to fetch distributors');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && (user.role === 'super_admin' || user.username === 'anoopsue')) {
      fetchDistributors();
    }
  }, [user, authLoading]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    setAdminLoggingIn(true);
    try {
      await login(adminUsername, adminPassword);
    } catch (err: any) {
      setAdminLoginError(err.message || 'Invalid administrator credentials');
    } finally {
      setAdminLoggingIn(false);
    }
  };

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
      setError(err.message || 'Failed to update modules');
    } finally {
      setSavingModules(false);
    }
  };

  const handleStatusChange = async (businessId: string, status: 'active' | 'suspended' | 'trial') => {
    try {
      await api.put(`/api/v1/admin/businesses/${businessId}/status`, { status });
      fetchDistributors();
    } catch (err: any) {
      setError(err.message || 'Failed to update distributor status');
    }
  };

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.gstin && b.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  // Instant render: only show loading spinner if a token exists and auth is actively resolving
  const token = typeof window !== 'undefined' ? localStorage.getItem('bizledger_access_token') : null;
  const showLoading = authLoading && Boolean(token);

  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071322] text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading Hermes Admin Portal...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'super_admin' && user.username !== 'anoopsue')) {
    return (
      <div className="h-screen max-h-screen w-full flex flex-col justify-between bg-[#071322] text-slate-100 relative overflow-hidden select-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] max-w-full h-[500px] bg-gradient-to-b from-amber-500/10 via-blue-900/15 to-transparent blur-3xl pointer-events-none -z-0" />
        <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 py-2 sm:py-3 w-full overflow-hidden">
          <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto">
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-block p-1.5 sm:p-2 rounded-2xl bg-white shadow-2xl shadow-amber-500/10 border-2 border-amber-500/30 mb-2 hover:scale-105 transition-transform duration-300">
                <img
                  src={`${basePath}/hermes-logo.jpg`}
                  alt="Hermes Logo"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Admin <span className="text-amber-400">Portal</span>
              </h1>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 tracking-wide font-normal px-2">
                Master Platform Multi-Distributor Governance
              </p>
            </div>

            <div className="glass-card py-5 px-5 sm:py-6 sm:px-7 rounded-2xl shadow-2xl animate-glass-in">
              <form className="space-y-3.5" onSubmit={handleAdminSignIn}>
                {adminLoginError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5 animate-glass-in">
                    <span className="font-medium">{adminLoginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider mb-1">
                    Admin Username
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder=""
                      className="block w-full pl-10 pr-3 py-2 glass-input rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-10 py-2 glass-input rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-amber-300 transition"
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminLoggingIn}
                  className="w-full mt-2 flex justify-center items-center py-2.5 px-4 rounded-lg shadow-lg shadow-amber-500/20 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-60"
                >
                  {adminLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Enter Admin Portal</span>
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3.5 border-t border-slate-800/80 text-xs text-center">
                <Link
                  href="/login"
                  className="text-amber-400 hover:text-amber-300 hover:underline transition"
                >
                  ← Return to Distributor Sign In
                </Link>
              </div>
            </div>
          </div>
        </main>

        <footer className="relative z-10 w-full py-2.5 px-4 sm:px-6 border-t border-slate-800/80 bg-[#050e18]/90 backdrop-blur-md flex-shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-slate-400 gap-1.5 sm:gap-0 text-center sm:text-left">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-slate-400">Version 1.0.4 • Hermes ERP</span>
            </div>
            <div className="font-medium text-slate-300">
              © {new Date().getFullYear()} • Powered by <span className="text-amber-400 font-semibold">@anoopsue</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">Contact:</span>
              <a
                href="mailto:hermes.suee@gmail.com"
                className="text-amber-400 hover:text-amber-300 hover:underline font-mono"
              >
                hermes.suee@gmail.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <AppShell currentMenu="admin_portal">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-glass-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 w-56 sm:w-64"
              />
            </div>

            <button
              onClick={() => {
                setRegisterModalOpen(true);
                setRegError(null);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 shadow-md shadow-amber-500/20 transition-all duration-200 transform active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Register Distributor</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 glass-card rounded-xl shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Distributors</p>
            <p className="text-2xl font-bold text-white mt-1">{businesses.length}</p>
          </div>
          <div className="p-4 glass-card rounded-xl shadow-sm">
            <p className="text-xs font-medium text-slate-400">Active Businesses</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {businesses.filter((b) => b.status === 'active' || !b.status).length}
            </p>
          </div>
          <div className="p-4 glass-card rounded-xl shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Distributor Users</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {businesses.reduce((sum, b) => sum + (b.stats?.users || 0), 0)}
            </p>
          </div>
          <div className="p-4 glass-card rounded-xl shadow-sm">
            <p className="text-xs font-medium text-slate-400">Platform Invoices Generated</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {businesses.reduce((sum, b) => sum + (b.stats?.invoices || 0), 0)}
            </p>
          </div>
        </div>

        {/* Distributor Table */}
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
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

        {/* Onboard / Register New Distributor Modal */}
        {registerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-glass-in overflow-y-auto">
            <div className="glass-menu rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-amber-500/30 overflow-hidden my-auto">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Register New Distributor Business</h3>
                    <p className="text-[11px] text-slate-400">
                      Create an isolated multi-tenant distributor firm and administrator login.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRegisterModalOpen(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDistributor} className="flex-1 overflow-y-auto p-6 space-y-4">
                {regError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2 animate-glass-in">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Section 1: Firm Profile */}
                <div>
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                    1. Distributor Business Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Distributor Firm Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        placeholder="e.g. Metro Pharma & Healthcare Distributors"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        GSTIN (15 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={regGstin}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        placeholder="27ABCDE1234F1Z5"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white uppercase font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        State & Code *
                      </label>
                      <select
                        value={regStateCode}
                        onChange={(e) => setRegStateCode(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      >
                        {Object.entries(INDIAN_STATES).map(([code, name]) => (
                          <option key={code} value={code} className="bg-slate-900 text-white">
                            {code} - {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Registered Address
                      </label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="e.g. Gala 12, APMC Market, Vashi, Navi Mumbai"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Owner / Admin Account */}
                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                    2. Primary Administrator Account
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Proprietor / Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        placeholder="e.g. Ramesh Shah"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Business Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="accounts@metropharma.in"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Distributor Username *
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="e.g. metropharma"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Password (Min 8 chars) *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regSubmitting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {regSubmitting ? 'Registering Distributor...' : 'Register & Onboard Distributor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
