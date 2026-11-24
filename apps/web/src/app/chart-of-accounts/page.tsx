'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ACCOUNT_TYPES, AccountType } from '@bizledger/shared';
import { Plus, PieChart, X } from 'lucide-react';

export default function ChartOfAccountsPage() {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Account Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('asset');

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/accounts');
      setAccounts(res.accounts || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/accounts', { code, name, type });
      setIsAddOpen(false);
      setCode('');
      setName('');
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to create account');
    }
  };

  const grouped = {
    asset: accounts.filter((a) => a.type === 'asset'),
    liability: accounts.filter((a) => a.type === 'liability'),
    equity: accounts.filter((a) => a.type === 'equity'),
    income: accounts.filter((a) => a.type === 'income'),
    expense: accounts.filter((a) => a.type === 'expense'),
  };

  return (
    <AppShell currentMenu="chart_of_accounts">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Chart of Accounts
            </h1>
            <p className="text-xs text-slate-500">
              Standard 5-category double-entry general ledger accounts (Assets, Liabilities, Equity, Income, Expenses)
            </p>
          </div>

          {hasPermission('chart_of_accounts', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Account
            </button>
          )}
        </div>

        {/* Grouped Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['asset', 'liability', 'equity', 'income', 'expense'] as const).map((cat) => (
            <div
              key={cat}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {cat.toUpperCase()}S ({grouped[cat].length})
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {cat === 'asset' || cat === 'expense' ? 'Debit Normal' : 'Credit Normal'}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {grouped[cat].map((acct) => (
                  <div key={acct.id} className="px-4 py-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono font-semibold text-blue-600 mr-2">{acct.code}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{acct.name}</span>
                    </div>
                    {acct.isSystem && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        System
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">Add New Ledger Account</h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Account Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5060"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software & Subscriptions"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Account Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 border rounded-lg outline-none bg-white font-medium capitalize"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
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
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
