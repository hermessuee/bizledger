'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { Plus, BookOpen, Trash2, X, CheckCircle } from 'lucide-react';

export default function JournalPage() {
  const { hasPermission } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Voucher Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<any[]>([
    { accountId: '', partyId: '', debitRupees: 0, creditRupees: 0 },
    { accountId: '', partyId: '', debitRupees: 0, creditRupees: 0 },
  ]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/journal');
      setEntries(res.entries || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [aRes, pRes] = await Promise.all([
        api.get('/api/v1/accounts'),
        api.get('/api/v1/parties'),
      ]);
      setAccounts(aRes.accounts || []);
      setParties(pRes.parties || []);
    } catch {}
  };

  useEffect(() => {
    fetchEntries();
    fetchMasters();
  }, []);

  const totalDebitPaise = lines.reduce(
    (acc, l) => acc + Math.round((Number(l.debitRupees) || 0) * 100),
    0
  );
  const totalCreditPaise = lines.reduce(
    (acc, l) => acc + Math.round((Number(l.creditRupees) || 0) * 100),
    0
  );
  const isBalanced = totalDebitPaise === totalCreditPaise && totalDebitPaise > 0;

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', partyId: '', debitRupees: 0, creditRupees: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Total Debits must exactly equal Total Credits and be greater than 0');
      return;
    }

    try {
      const payloadLines = lines.map((l) => ({
        accountId: l.accountId,
        partyId: l.partyId || undefined,
        debit: Math.round((Number(l.debitRupees) || 0) * 100),
        credit: Math.round((Number(l.creditRupees) || 0) * 100),
      }));

      await api.post('/api/v1/journal', {
        entryDate,
        narration,
        lines: payloadLines,
      });

      setIsAddOpen(false);
      setNarration('');
      setLines([
        { accountId: '', partyId: '', debitRupees: 0, creditRupees: 0 },
        { accountId: '', partyId: '', debitRupees: 0, creditRupees: 0 },
      ]);
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to post voucher');
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm('Void this journal entry? An exact reversal entry will be created.')) return;
    try {
      await api.post(`/api/v1/journal/${id}/void`);
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to void');
    }
  };

  return (
    <AppShell currentMenu="journal">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Journal Vouchers
            </h1>
            <p className="text-xs text-slate-500">
              General ledger manual journal entries with strict double-entry balancing guarantee
            </p>
          </div>

          {hasPermission('journal', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Journal Voucher
            </button>
          )}
        </div>

        {/* Entries List */}
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border text-center text-slate-400 text-xs">
              No journal entries recorded.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center border-b">
                  <div className="flex items-center space-x-3 text-xs font-semibold">
                    <span className="font-mono text-blue-600">{entry.entryNo}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600 font-mono">{entry.entryDate}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600 italic font-normal">
                      {entry.narration || 'No narration'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {entry.isVoid ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        VOID
                      </span>
                    ) : (
                      hasPermission('journal', 'delete') && (
                        <button
                          onClick={() => handleVoid(entry.id)}
                          className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[11px] font-semibold"
                        >
                          Void & Reverse
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 uppercase text-[10px]">
                        <th className="py-1 text-left">Account</th>
                        <th className="py-1 text-left">Party (Sub-ledger)</th>
                        <th className="py-1 text-right">Debit (₹)</th>
                        <th className="py-1 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.lines.map((line: any) => (
                        <tr key={line.id}>
                          <td className="py-1.5 font-medium text-slate-800">
                            {line.accountCode} - {line.accountName}
                          </td>
                          <td className="py-1.5 text-slate-500">{line.partyName || '-'}</td>
                          <td className="py-1.5 text-right font-medium">
                            {line.debit > 0 ? formatPaise(line.debit) : '-'}
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {line.credit > 0 ? formatPaise(line.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Voucher Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">New Journal Voucher</h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Entry Date *</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Narration / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Depreciation adjustment / Rent accrual"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              {/* Lines Table */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold uppercase text-[11px] text-slate-600">Journal Lines</h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + Add Line
                  </button>
                </div>

                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded">
                    <div className="col-span-4">
                      <select
                        required
                        value={l.accountId}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].accountId = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none"
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <select
                        value={l.partyId}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].partyId = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-[11px] bg-white outline-none"
                      >
                        <option value="">Party (Optional)...</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Debit ₹"
                        value={l.debitRupees || ''}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].debitRupees = e.target.value;
                          if (e.target.value) updated[idx].creditRupees = 0;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-xs outline-none"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Credit ₹"
                        value={l.creditRupees || ''}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].creditRupees = e.target.value;
                          if (e.target.value) updated[idx].debitRupees = 0;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-xs outline-none"
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Balance Checker Banner */}
              <div
                className={`p-3 rounded-lg border flex justify-between items-center ${
                  isBalanced
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div>
                  <span className="font-bold">
                    Debits: ₹ {formatPaise(totalDebitPaise)} | Credits: ₹ {formatPaise(totalCreditPaise)}
                  </span>
                  <p className="text-[10px] mt-0.5">
                    {isBalanced
                      ? '✓ Perfect! Debits and credits are equal.'
                      : '⚠ Unbalanced: Total debits must equal total credits.'}
                  </p>
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
                  disabled={!isBalanced}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Post Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
