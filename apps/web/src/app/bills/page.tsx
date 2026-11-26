'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  formatPaise,
  calculateLineTax,
  calculateRoundOff,
  GST_RATES,
  INDIAN_STATES,
} from '@bizledger/shared';
import {
  Plus,
  FileCheck,
  Search,
  CheckCircle,
  Ban,
  X,
  Trash2,
  Building2,
  Calendar,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export default function BillsPage() {
  const { business, hasPermission } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Purchase Bill Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState('');
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState(business?.stateCode || '27');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<any[]>([
    {
      description: '',
      hsnSac: '',
      qty: 1,
      rateRupees: 0,
      gstRate: 18,
    },
  ]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/documents?type=purchase_bill');
      setBills(res.documents || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [vRes, iRes] = await Promise.all([
        api.get('/api/v1/parties?kind=vendor'),
        api.get('/api/v1/items'),
      ]);
      setVendors(vRes.parties || []);
      setItems(iRes.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchBills();
    fetchMasters();
  }, []);

  const handleVendorSelect = (id: string) => {
    setVendorId(id);
    const selected = vendors.find((v) => v.id === id);
    if (selected?.gstin && selected.gstin.length >= 2) {
      setPlaceOfSupply(selected.gstin.substring(0, 2));
    }
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      itemId: item.id,
      description: item.name,
      hsnSac: item.hsnSac || '',
      rateRupees: (item.purchasePrice || item.salePrice || 0) / 100,
      gstRate: item.gstRate || 18,
    };
    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { description: '', hsnSac: '', qty: 1, rateRupees: 0, gstRate: 18 },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  // Compute live tax and totals
  const isInterState = placeOfSupply !== (business?.stateCode || '27');
  let computedSubtotal = 0n;
  let computedTaxTotal = 0n;

  const computedLines = lines.map((line) => {
    const qty = Number(line.qty) || 0;
    const ratePaise = BigInt(Math.round((Number(line.rateRupees) || 0) * 100));
    const taxablePaise = BigInt(Math.round(qty * Number(ratePaise)));

    const taxRes = calculateLineTax({
      taxableAmount: taxablePaise,
      gstRate: Number(line.gstRate) || 0,
      isInterState,
    });

    computedSubtotal += taxRes.taxableAmount;
    computedTaxTotal += taxRes.totalTax;

    return {
      description: line.description || 'Goods / Services',
      hsnSac: line.hsnSac || '',
      qty,
      rate: Number(ratePaise),
      discount: 0,
      gstRate: Number(line.gstRate) || 0,
      cgst: Number(taxRes.cgst),
      sgst: Number(taxRes.sgst),
      igst: Number(taxRes.igst),
      lineTotal: Number(taxRes.lineTotal),
    };
  });

  const unroundedTotal = computedSubtotal + computedTaxTotal;
  const { roundOff, finalTotal } = calculateRoundOff(unroundedTotal);

  const resetForm = () => {
    setVendorId('');
    setSupplierBillNo('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setPlaceOfSupply(business?.stateCode || '27');
    setLines([{ description: '', hsnSac: '', qty: 1, rateRupees: 0, gstRate: 18 }]);
    setErrorMsg(null);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setErrorMsg('Please select a supplier / vendor.');
      return;
    }
    if (computedLines.length === 0 || computedLines.some((l) => !l.description)) {
      setErrorMsg('Please enter description for all line items.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      await api.post('/api/v1/documents', {
        docType: 'purchase_bill',
        docNo: supplierBillNo.trim() || undefined,
        docDate,
        dueDate: dueDate || undefined,
        partyId: vendorId,
        placeOfSupply,
        subtotal: Number(computedSubtotal),
        taxTotal: Number(computedTaxTotal),
        roundOff: Number(roundOff),
        total: Number(finalTotal),
        lines: computedLines,
      });

      setIsAddOpen(false);
      resetForm();
      await fetchBills();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save purchase bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePost = async (id: string) => {
    if (
      !confirm(
        'Post this purchase bill to ledger? This will record input tax credit (ITC) and update accounts payable with balanced double-entry lines.'
      )
    )
      return;
    try {
      await api.post(`/api/v1/documents/${id}/post`);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to post purchase bill');
    }
  };

  const handleVoid = async (id: string) => {
    if (
      !confirm(
        'Void this purchase bill? This will reverse all posted accounting ledger entries.'
      )
    )
      return;
    try {
      await api.post(`/api/v1/documents/${id}/void`);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to void purchase bill');
    }
  };

  const filteredBills = bills.filter(
    (b) =>
      b.docNo?.toLowerCase().includes(search.toLowerCase()) ||
      b.partyName?.toLowerCase().includes(search.toLowerCase()) ||
      b.partyGstin?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell currentMenu="purchase_bills">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Purchase Bills
            </h1>
            <p className="text-xs text-slate-500">
              Record supplier bills, verify input tax credit (ITC), and track vendor payables
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Record Purchase Bill</span>
          </button>
        </div>

        {/* Search & Overview Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Bill #, Vendor, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <span>Total Recorded:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filteredBills.length} bill(s)
            </span>
          </div>
        </div>

        {/* Bills Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Bill #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Vendor / Supplier</th>
                  <th className="py-3 px-4 whitespace-nowrap">GSTIN</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Taxable Value</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">ITC (GST)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Bill Total (₹)</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading purchase bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No purchase bills found. Click 'Record Purchase Bill' to enter your first supplier bill.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {b.docNo}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">{b.docDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {b.partyName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {b.partyGstin || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium whitespace-nowrap">
                        ₹ {formatPaise(b.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 whitespace-nowrap">
                        ₹ {formatPaise(b.taxTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        ₹ {formatPaise(b.total)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            b.status === 'posted'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : b.status === 'void'
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {b.status === 'draft' && (
                          <button
                            onClick={() => handlePost(b.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                            title="Post bill to accounting ledgers"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Post</span>
                          </button>
                        )}
                        {b.status === 'posted' && (
                          <button
                            onClick={() => handleVoid(b.id)}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[11px] font-semibold transition"
                            title="Void bill & reverse ledger entries"
                          >
                            <Ban className="w-3 h-3 inline mr-1" />
                            <span>Void</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECORD PURCHASE BILL MODAL
      ========================================================================= */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          style={{ zIndex: 100, pointerEvents: 'auto' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 relative z-[101]"
            style={{ zIndex: 101 }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-50/50 via-slate-50 to-slate-50 dark:from-slate-800/40 dark:to-slate-900">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Record Purchase Bill (Supplier Entry)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter supplier tax invoice details, record Input Tax Credit (ITC), and credit Accounts Payable.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateBill} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Supplier & Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Vendor *
                  </label>
                  <select
                    required
                    value={vendorId}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Select supplier vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.gstin ? `(${v.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Bill / Inv #
                  </label>
                  <input
                    type="text"
                    value={supplierBillNo}
                    onChange={(e) => setSupplierBillNo(e.target.value)}
                    placeholder="e.g. INV-2026-0491"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Place of Supply (State) *
                  </label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.entries(INDIAN_STATES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center pt-5">
                  <span className="text-[11px] font-medium text-slate-500">
                    Tax Treatment:{' '}
                    <strong className="text-slate-900 dark:text-slate-200">
                      {isInterState ? 'Inter-State (IGST 100%)' : 'Intra-State (CGST 50% + SGST 50%)'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Purchased Goods & Services Items
                  </h4>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center space-x-1 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Line Item</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 w-1/3">Item / Description *</th>
                        <th className="py-2.5 px-2 w-24">HSN/SAC</th>
                        <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                        <th className="py-2.5 px-2 w-28 text-right">Purchase Rate (₹)</th>
                        <th className="py-2.5 px-2 w-24 text-center">GST %</th>
                        <th className="py-2.5 px-3 text-right">Taxable</th>
                        <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {lines.map((line, idx) => {
                        const comp = computedLines[idx];
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <div className="space-y-1">
                                {items.length > 0 && (
                                  <select
                                    onChange={(e) => handleItemSelect(idx, e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>
                                      -- Select from master items --
                                    </option>
                                    {items.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="text"
                                  required
                                  placeholder="Item name / description"
                                  value={line.description}
                                  onChange={(e) => {
                                    const upd = [...lines];
                                    upd[idx].description = e.target.value;
                                    setLines(upd);
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="text"
                                placeholder="HSN"
                                value={line.hsnSac}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].hsnSac = e.target.value;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="1"
                                required
                                value={line.qty}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].qty = Math.max(1, parseInt(e.target.value) || 1);
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={line.rateRupees}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].rateRupees = parseFloat(e.target.value) || 0;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1 text-xs text-right border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            <td className="py-2 px-2">
                              <select
                                value={line.gstRate}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].gstRate = Number(e.target.value);
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              >
                                {GST_RATES.map((rate) => (
                                  <option key={rate} value={rate}>
                                    {rate}%
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                              ₹ {comp ? (comp.rate * comp.qty / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              ₹ {comp ? (comp.lineTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                            </td>

                            <td className="py-2 px-2 text-center">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="text-slate-400 hover:text-red-600 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Calculations Footer */}
              <div className="flex flex-col sm:flex-row justify-end pt-3">
                <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Subtotal:</span>
                    <span>₹ {(Number(computedSubtotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Input Tax Credit (GST):</span>
                    <span>₹ {(Number(computedTaxTotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {Number(roundOff) !== 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round Off:</span>
                      <span>₹ {(Number(roundOff) / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>Bill Grand Total:</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      ₹ {(Number(finalTotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving Purchase Bill...' : 'Save Purchase Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
