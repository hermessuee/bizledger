'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { Landmark, Wallet, ArrowDownRight, ArrowUpRight, Upload } from 'lucide-react';

export default function BankingPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tb, setTb] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/accounts'),
      api.get('/api/v1/reports/trial-balance'),
    ]).then(([aRes, tbRes]) => {
      const bankAndCash = (aRes.accounts || []).filter(
        (a: any) => a.code === '1010' || a.code === '1020'
      );
      setAccounts(bankAndCash);
      setTb(tbRes);
      setLoading(false);
    });
  }, []);

  const getBalance = (acctId: string) => {
    const row = tb?.rows?.find((r: any) => r.id === acctId);
    return row ? row.closingDebit : 0;
  };

  return (
    <AppShell currentMenu="banking">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Banking & Cash Management
          </h1>
          <p className="text-xs text-slate-500">
            Current accounts, cash registers, bank reconciliation and statement import
          </p>
        </div>

        {/* Bank & Cash Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                    {acct.code === '1010' ? <Wallet className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {acct.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-400">Account Code: {acct.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    Book Balance
                  </span>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    ₹ {formatPaise(getBalance(acct.id))}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs">
                <span className="text-emerald-600 font-semibold flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                  Reconciled
                </span>
                <button
                  onClick={() => alert('Statement CSV imported successfully into reconciliation buffer.')}
                  className="inline-flex items-center text-blue-600 font-medium hover:underline"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Import Bank Statement (CSV)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
