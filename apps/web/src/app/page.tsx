'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  Clock,
  PlusCircle,
  FileText,
  CreditCard,
  CheckSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/v1/dashboard')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = data?.monthlyTrend?.map((m: any) => ({
    name: m.month,
    Sales: m.sales / 100, // into rupees
    Purchases: m.purchases / 100,
  })) || [];

  return (
    <AppShell currentMenu="dashboard">
      <div className="space-y-6">
        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Financial Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Real-time summary of sales, expenses, cashflow and cheque liabilities
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('sales_invoices', 'create') && (
              <button
                onClick={() => router.push('/invoices')}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                New Invoice
              </button>
            )}
            {hasPermission('cheques', 'create') && (
              <button
                onClick={() => router.push('/cheques')}
                className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                Add Cheque
              </button>
            )}
            {hasPermission('payments', 'create') && (
              <button
                onClick={() => router.push('/payments')}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Record Payment
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Total Sales</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ₹ {formatPaise(data?.kpis?.totalSales || 0)}
              </h3>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium">B2B & B2C Invoiced</p>
            </div>
          </div>

          {/* Total Purchases */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Purchases & Expenses</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ₹ {formatPaise(data?.kpis?.totalPurchases || 0)}
              </h3>
              <p className="mt-1 text-[11px] text-blue-600 font-medium">Bills & Vendor Outflows</p>
            </div>
          </div>

          {/* Cash & Bank Balance */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Cash & Bank</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ₹ {formatPaise(data?.kpis?.cashBankBalance || 0)}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 font-medium">Liquid working capital</p>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Net Profit</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                ₹ {formatPaise(data?.kpis?.netProfit || 0)}
              </h3>
              <p className="mt-1 text-[11px] text-indigo-600 font-medium">Before Taxes</p>
            </div>
          </div>
        </div>

        {/* Cheques Attention Widget (Key Spec Requirement) */}
        {hasPermission('cheques', 'view') && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-5 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Cheque & PDC Attention Center
                </h3>
              </div>
              <button
                onClick={() => router.push('/cheques')}
                className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline"
              >
                View Cheque Register →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-red-200 dark:border-red-900/40">
                <span className="text-[11px] font-semibold text-red-600 uppercase">Overdue Cheques</span>
                <p className="text-lg font-bold text-red-700 mt-1">
                  {data?.chequesWidget?.overdueCount || 0}
                </p>
                <p className="text-[10px] text-slate-500">
                  ₹ {formatPaise(data?.chequesWidget?.overdueAmount || 0)}
                </p>
              </div>

              <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40">
                <span className="text-[11px] font-semibold text-amber-600 uppercase">Due Today</span>
                <p className="text-lg font-bold text-amber-700 mt-1">
                  {data?.chequesWidget?.dueTodayCount || 0}
                </p>
                <p className="text-[10px] text-slate-500">
                  ₹ {formatPaise(data?.chequesWidget?.dueTodayAmount || 0)}
                </p>
              </div>

              <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/40">
                <span className="text-[11px] font-semibold text-yellow-600 uppercase">Due Next 7 Days</span>
                <p className="text-lg font-bold text-yellow-700 mt-1">
                  {data?.chequesWidget?.due7DaysCount || 0}
                </p>
                <p className="text-[10px] text-slate-500">
                  ₹ {formatPaise(data?.chequesWidget?.due7DaysAmount || 0)}
                </p>
              </div>

              <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-blue-200 dark:border-blue-900/40">
                <span className="text-[11px] font-semibold text-blue-600 uppercase">PDC In Hand</span>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  ₹ {formatPaise(data?.chequesWidget?.pdcInHandAmount || 0)}
                </p>
                <p className="text-[10px] text-slate-500">Post-dated cheques held</p>
              </div>
            </div>
          </div>
        )}

        {/* Charts & Outstanding Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Trend Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4">
              Sales vs Purchases Trend (INR)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹ ${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Purchases" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Receivables & Payables Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4">
                Working Capital Balances
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span>Accounts Receivable</span>
                    <span className="text-emerald-600">Pending Receipt</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    ₹ {formatPaise(data?.kpis?.receivables || 0)}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span>Accounts Payable</span>
                    <span className="text-red-600">Pending Payment</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    ₹ {formatPaise(data?.kpis?.payables || 0)}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span>GST Net Payable</span>
                    <span className="text-blue-600">Govt Liability</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    ₹ {formatPaise(data?.kpis?.gstPayable || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <button
                onClick={() => router.push('/reports')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-800 dark:text-slate-200 transition"
              >
                View Full Financial Reports →
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
