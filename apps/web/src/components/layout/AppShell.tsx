'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ChequeAlertsModal } from '../cheques/ChequeAlertsModal';
import { ChangePasswordModal } from '../dialogs/ChangePasswordModal';
import {
  MenuKey,
  MENU_LABELS,
  ChequeItem,
  ChequeAlertsResponse,
} from '@bizledger/shared';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  FileText,
  FileCheck,
  Receipt,
  CreditCard,
  CheckSquare,
  Landmark,
  BookOpen,
  PieChart,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Shield,
  History,
  Bell,
  LogOut,
  KeyRound,
  ChevronDown,
  Menu,
  X,
  UploadCloud,
  ShieldAlert,
} from 'lucide-react';

const MENU_ICONS: Record<MenuKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  customers: Users,
  vendors: Building2,
  items: Package,
  sales_invoices: FileText,
  purchase_bills: FileCheck,
  receipts: Receipt,
  payments: CreditCard,
  cheques: CheckSquare,
  banking: Landmark,
  journal: BookOpen,
  chart_of_accounts: PieChart,
  reports: BarChart3,
  gst: FileSpreadsheet,
  bulk_upload: UploadCloud,
  admin_portal: ShieldAlert,
  settings: Settings,
  users: Shield,
  audit_log: History,
};

const MENU_ROUTES: Record<MenuKey, string> = {
  dashboard: '/',
  customers: '/customers',
  vendors: '/vendors',
  items: '/items',
  sales_invoices: '/invoices',
  purchase_bills: '/bills',
  receipts: '/receipts',
  payments: '/payments',
  cheques: '/cheques',
  banking: '/banking',
  journal: '/journal',
  chart_of_accounts: '/chart-of-accounts',
  reports: '/reports',
  gst: '/gst',
  bulk_upload: '/bulk-upload',
  admin_portal: '/super-admin',
  settings: '/settings',
  users: '/users',
  audit_log: '/audit-log',
};

export function AppShell({
  children,
  currentMenu = 'dashboard',
}: {
  children: React.ReactNode;
  currentMenu?: MenuKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, business, loading, logout, hasPermission } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [chequeAlertsOpen, setChequeAlertsOpen] = useState(false);

  const [alerts, setAlerts] = useState<ChequeAlertsResponse>({
    overdue: [],
    dueToday: [],
    upcoming: [],
    totalCount: 0,
  });

  // Fetch Cheque Alerts
  const fetchChequeAlerts = async () => {
    if (!user || !hasPermission('cheques', 'view')) return;
    try {
      const data = await api.get<ChequeAlertsResponse>('/api/v1/cheques/alerts');
      setAlerts(data);
    } catch {}
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Initial alerts pop-up on login/first load if alerts exist
  useEffect(() => {
    if (user && hasPermission('cheques', 'view')) {
      fetchChequeAlerts().then(() => {
        // Pop-up modal ONLY once on initial login or new session
        const today = new Date().toISOString().split('T')[0];
        const dismissedDate = typeof window !== 'undefined' ? localStorage.getItem('bizledger_alerts_dismissed_date') : null;
        const alreadyShownInSession = typeof window !== 'undefined' ? sessionStorage.getItem('bizledger_alerts_shown_session') : null;

        if (dismissedDate !== today && !alreadyShownInSession) {
          api.get<ChequeAlertsResponse>('/api/v1/cheques/alerts').then((res) => {
            if (res.totalCount > 0) {
              setAlerts(res);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('bizledger_alerts_shown_session', 'true');
              }
              setChequeAlertsOpen(true);
            }
          });
        }
      });

      // Poll every 5 minutes (updates bell badge count only without popping up modal)
      const interval = setInterval(fetchChequeAlerts, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading Hermes ERP...</p>
        </div>
      </div>
    );
  }

  // Check current menu permission
  const canViewCurrent = hasPermission(currentMenu, 'view');

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Sidebar Overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <img
              src={`${basePath}/hermes-logo.jpg`}
              alt="Hermes Logo"
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shadow-md shadow-amber-500/10 border border-amber-500/30"
            />
            <div>
              <span className="font-bold text-base tracking-wide text-white">Hermes ERP</span>
              <span className="block text-[10px] text-amber-400 uppercase font-mono tracking-wider">
                Distribution Edition
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Badge */}
        <div className="px-5 py-3 bg-slate-850/60 border-b border-slate-800/80 text-xs">
          <p className="font-semibold text-slate-200 truncate">{business?.name || 'My Business'}</p>
          <p className="text-[11px] text-slate-400 truncate">GSTIN: {business?.gstin || 'Not Configured'}</p>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {Object.entries(MENU_LABELS).map(([key, label]) => {
            const menuKey = key as MenuKey;

            // 1. Super Admin portal: visible only to super_admin role
            if (menuKey === 'admin_portal' && user.role !== 'super_admin') return null;

            // 2. Check if this module is enabled for the distributor by Super Admin
            if (
              user.role !== 'super_admin' &&
              business?.enabledMenus &&
              business.enabledMenus.length > 0 &&
              !business.enabledMenus.includes(menuKey)
            ) {
              return null;
            }

            // 3. Filter strictly by user permission
            if (!hasPermission(menuKey, 'view')) return null;

            const Icon = MENU_ICONS[menuKey];
            const route = MENU_ROUTES[menuKey];
            const isActive = currentMenu === menuKey || pathname === route;

            return (
              <a
                key={menuKey}
                href={route}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(route);
                  setSidebarOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{label}</span>
                </div>
                {menuKey === 'cheques' && alerts.totalCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {alerts.totalCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
              {user.name.slice(0, 2)}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
              <span className="inline-block px-1.5 py-0.2 text-[10px] uppercase font-bold rounded bg-slate-800 text-blue-400">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <span>{business?.name || 'Apex Trading'}</span>
              <span className="text-slate-400">/</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                FY 2026-27 (Apr-Mar)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Cheque Alerts Bell */}
            {hasPermission('cheques', 'view') && (
              <button
                onClick={() => setChequeAlertsOpen(true)}
                title="Cheque Due Alerts"
                className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Bell className="w-5 h-5" />
                {alerts.totalCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                    {alerts.totalCount}
                  </span>
                )}
              </button>
            )}

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                  {user.name.slice(0, 2)}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-300">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                    <p className="text-[11px] text-slate-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setChangePasswordOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-700 dark:text-slate-300"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Change Password</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout().then(() => router.push('/login'));
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2 text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {canViewCurrent ? (
            children
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Access Denied
              </h2>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                You do not have permission to access the{' '}
                <strong>{MENU_LABELS[currentMenu] || currentMenu}</strong> module. Please contact your
                administrator.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Cheque Alerts Pop-up Modal */}
      <ChequeAlertsModal
        isOpen={chequeAlertsOpen}
        onClose={() => setChequeAlertsOpen(false)}
        alerts={alerts}
        onRefresh={fetchChequeAlerts}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
