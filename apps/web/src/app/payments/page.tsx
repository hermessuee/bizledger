'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { Plus, CreditCard, Receipt, X } from 'lucide-react';

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [kind, setKind] = useState<'receipt' | 'payment'>('receipt');
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState<'bank' | 'cash' | 'upi' | 'cheque'>('bank');
  const [amount, setAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const fetchPayments = async () => {
    try {
      const res = await api.get('/api/v1/payments');
      setPayments(res.payments || []);
    } catch {}
  };

  const fetchParties = async () => {
    try {
      const res = await api.get('/api/v1/parties');
      setParties(res.parties || []);
    } catch {}
  };

  useEffect(() => {
    fetchPayments();
    fetchParties();
  }, []);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountPaise = Math.round(parseFloat(amount) * 100);
      await api.post('/api/v1/payments', {
        kind,
        partyId,
        payDate,
        mode,
        amount: amountPaise,
        reference,
      });
      setIsAddOpen(false);
      setAmount('');
      setReference('');
      fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <AppShell currentMenu="payments">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Receipts & Payments
            </h1>
            <p className="text-xs text-slate-500">
              Record cash, bank transfer, and UPI settlements with automated double-entry ledger postings
            </p>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Transaction
          </button>
        </div>

        {/* Payments Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No payments or receipts recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.kind === 'receipt'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {p.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{p.payDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{p.partyName}</td>
                      <td className="py-3 px-4 uppercase font-mono text-[11px] text-slate-600">
                        {p.mode}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{p.reference || '-'}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹ {formatPaise(p.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-base">Record Payment / Receipt</h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind('receipt')}
                  className={`py-2 text-center rounded-lg font-semibold border ${
                    kind === 'receipt'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                      : 'border-slate-200'
                  }`}
                >
                  Receipt (Money In)
                </button>
                <button
                  type="button"
                  onClick={() => setKind('payment')}
                  className={`py-2 text-center rounded-lg font-semibold border ${
                    kind === 'payment'
                      ? 'bg-red-50 border-red-600 text-red-700'
                      : 'border-slate-200'
                  }`}
                >
                  Payment (Money Out)
                </button>
              </div>

              <div>
                <label className="block font-semibold mb-1">Party *</label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white outline-none"
                >
                  <option value="">Select party...</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Payment Mode *</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white outline-none capitalize"
                  >
                    <option value="bank">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Reference / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTR123456789"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none"
                />
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
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
