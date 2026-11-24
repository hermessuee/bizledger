'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { Plus, FileCheck, Search } from 'lucide-react';

export default function BillsPage() {
  const { hasPermission } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/documents?type=purchase_bill').then((res) => {
      setBills(res.documents || []);
      setLoading(false);
    });
  }, []);

  return (
    <AppShell currentMenu="purchase_bills">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Purchase Bills
            </h1>
            <p className="text-xs text-slate-500">
              Record supplier bills, verify input tax credit (ITC), and track vendor payables
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">ITC (GST)</th>
                  <th className="py-3 px-4 text-right">Bill Total (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No purchase bills recorded.
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{b.docNo}</td>
                      <td className="py-3 px-4 font-mono">{b.docDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{b.partyName}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{b.partyGstin || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium">₹ {formatPaise(b.subtotal)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-500">
                        ₹ {formatPaise(b.taxTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹ {formatPaise(b.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border">
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
