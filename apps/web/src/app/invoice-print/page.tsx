'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { downloadInvoicePdf, downloadBatchInvoicesPdf, InvoicePdfData } from '@/lib/pdf';
import {
  Printer,
  Calendar,
  Search,
  CheckSquare,
  Square,
  FileText,
  FileCheck,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  Building2,
  RefreshCw,
} from 'lucide-react';

export default function InvoicePrintCenterPage() {
  const { business, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({
    from: firstOfMonthStr,
    to: todayStr,
  });

  const [invoices, setInvoices] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'draft'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch all sales invoices & parties
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const [invRes, partiesRes] = await Promise.all([
        api.get<any>('/api/v1/documents?type=sales_invoice'),
        api.get<any>('/api/v1/parties?kind=customer'),
      ]);
      setInvoices(invRes.documents || []);
      setParties(partiesRes.parties || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [business?.id]);

  // Quick Date Range Presets
  const setPreset = (preset: 'today' | 'month' | '30days' | 'all') => {
    if (preset === 'today') {
      setDateRange({ from: todayStr, to: todayStr });
    } else if (preset === 'month') {
      setDateRange({ from: firstOfMonthStr, to: todayStr });
    } else if (preset === '30days') {
      const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateRange({ from: past30, to: todayStr });
    } else if (preset === 'all') {
      setDateRange({ from: '', to: '' });
    }
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Date filter
      if (dateRange.from && inv.docDate < dateRange.from) return false;
      if (dateRange.to && inv.docDate > dateRange.to) return false;

      // Status filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const partyName = (inv.partyName || '').toLowerCase();
        const docNo = (inv.docNo || '').toLowerCase();
        const descMatch = (inv.lines || []).some((l: any) =>
          (l.description || '').toLowerCase().includes(q)
        );
        if (!partyName.includes(q) && !docNo.includes(q) && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, dateRange, statusFilter, searchQuery]);

  // Multi-select handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => i.id)));
    }
  };

  // Helper to construct InvoicePdfData
  const buildInvoicePdfData = (inv: any): InvoicePdfData => {
    const party = parties.find((p) => p.id === inv.partyId);
    return {
      business: {
        name: business?.name || 'Gold Father',
        gstin: business?.gstin?.trim() || 'Unregistered',
        address: business?.address || 'Kerala',
        settings: business?.settings || {},
      },
      document: {
        docType: inv.docType || 'sales_invoice',
        docNo: inv.docNo,
        docDate: inv.docDate,
        dueDate: inv.dueDate,
        placeOfSupply: inv.placeOfSupply || '32',
        subtotal: inv.subtotal,
        taxTotal: inv.taxTotal,
        roundOff: inv.roundOff || 0,
        total: inv.total,
        lines: (inv.lines || []).map((l: any) => ({
          description: l.description,
          hsnSac: l.hsnSac || '-',
          qty: l.qty || 1,
          unit: l.unit || 'PCS',
          rate: l.rate,
          discount: l.discount || 0,
          gstRate: l.gstRate || 0,
          cgst: l.cgst || 0,
          sgst: l.sgst || 0,
          igst: l.igst || 0,
          lineTotal: l.lineTotal || (l.rate * (l.qty || 1)),
        })),
      },
      party: {
        name: party?.name || inv.partyName || 'Cash Customer',
        gstin: party?.gstin || inv.partyGstin || '',
        address: party?.address || 'Kerala',
        phone: party?.phone || '',
      },
    };
  };

  // Print Single Invoice (Corporate B&W)
  const handlePrintSingle = (inv: any) => {
    const data = buildInvoicePdfData(inv);
    downloadInvoicePdf(data);
  };

  // Print Batch Invoices (Corporate B&W, Page-Per-Invoice)
  const handlePrintBatch = () => {
    const selectedInvs = filteredInvoices.filter((i) => selectedIds.has(i.id));
    if (selectedInvs.length === 0) return;

    const batchData = selectedInvs.map((inv) => buildInvoicePdfData(inv));
    downloadBatchInvoicesPdf(batchData);
  };

  return (
    <AppShell currentMenu="invoice_print">
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Printer className="w-6 h-6 text-amber-500" />
              <span>Invoice Print Center</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Corporate Black & White Tax Invoices with Single & Multi-Invoice Batch Printing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoices}
              className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* From Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="all">All Invoices</option>
                <option value="posted">Posted & Locked (Official)</option>
                <option value="draft">Draft Invoices</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Search Customer / Invoice #
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. INV/2026-27..., Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> Quick Ranges:
            </span>
            <button
              onClick={() => setPreset('today')}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              Today
            </button>
            <button
              onClick={() => setPreset('month')}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              This Month
            </button>
            <button
              onClick={() => setPreset('30days')}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPreset('all')}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Batch Action Floating Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-lg border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                {selectedIds.size}
              </span>
              <span className="font-semibold text-slate-200">
                {selectedIds.size === 1 ? '1 invoice selected' : `${selectedIds.size} invoices selected for batch print`}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrintBatch}
                className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-md transition"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                <span>Print Selected Batch ({selectedIds.size} Invoices)</span>
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Invoices List Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-850">
            <div className="flex items-center space-x-3">
              <button
                onClick={selectAll}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-amber-500 transition"
              >
                {selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-amber-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({filteredInvoices.length})</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Showing {filteredInvoices.length} of {invoices.length} sales invoices
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">Select</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer / Debtor</th>
                  <th className="py-3 px-3">Items Summary</th>
                  <th className="py-3 px-3 text-right">Taxable</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Invoice Total</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">No sales invoices found for the selected date range or filter</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isSelected = selectedIds.has(inv.id);
                    const isPosted = inv.status === 'posted';
                    const itemsSummary = (inv.lines || [])
                      .map((l: any) => `${l.description} (${l.qty} ${l.unit || 'PCS'})`)
                      .join(', ');

                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition ${
                          isSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(inv.id)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {inv.docNo}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">
                          {inv.docDate}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.partyName || 'Cash Customer'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {inv.partyGstin ? `GSTIN: ${inv.partyGstin}` : 'Unregistered'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={itemsSummary}>
                          {itemsSummary || 'Standard Sale'}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          ₹ {formatPaise(inv.subtotal)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          ₹ {formatPaise(inv.taxTotal)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          ₹ {formatPaise(inv.total)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isPosted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Posted
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="w-3 h-3 mr-1" /> Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handlePrintSingle(inv)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:text-slate-900 rounded-md text-xs font-bold transition shadow-xs"
                            title="Download Corporate Black & White Tax Invoice PDF"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            <span>Print PDF</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
