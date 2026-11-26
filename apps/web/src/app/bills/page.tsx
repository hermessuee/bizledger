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
  ITEM_UNITS,
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
  Lock,
  Edit3,
  Save,
  AlertTriangle,
} from 'lucide-react';

export default function BillsPage() {
  const { business, user, hasPermission } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [targetBusinessId, setTargetBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Purchase Bill Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
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
      unit: 'PCS',
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

      if (user?.role === 'super_admin' || user?.username === 'anoopsue') {
        try {
          const bRes = await api.get('/api/v1/admin/businesses');
          const list = (bRes.businesses || []).filter(
            (b: any) => b.id !== '00000000-0000-0000-0000-000000000000'
          );
          setDistributors(list);
          if (list.length > 0 && !targetBusinessId) {
            setTargetBusinessId(list[0].id);
          }
        } catch {}
      }
    } catch {}
  };

  useEffect(() => {
    fetchBills();
    fetchMasters();
  }, [user]);

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
      unit: item.unit || 'PCS',
      rateRupees: (item.purchasePrice || item.salePrice || 0) / 100,
      gstRate: item.gstRate || 18,
    };
    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { description: '', hsnSac: '', unit: 'PCS', qty: 1, rateRupees: 0, gstRate: 18 },
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
      unit: line.unit || 'PCS',
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
    setEditingDocId(null);
    setVendorId('');
    setSupplierBillNo('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setPlaceOfSupply(business?.stateCode || '27');
    setLines([{ description: '', hsnSac: '', unit: 'PCS', qty: 1, rateRupees: 0, gstRate: 18 }]);
    setErrorMsg(null);
  };

  const handleOpenEdit = (doc: any) => {
    if (doc.status === 'posted' && user?.role !== 'super_admin') {
      alert('⚠️ This entry is Saved & Locked. Posted accounting entries cannot be modified to preserve ledger integrity.');
      return;
    }
    setEditingDocId(doc.id);
    setVendorId(doc.partyId || '');
    setSupplierBillNo(doc.docNo || '');
    setDocDate(doc.docDate || new Date().toISOString().split('T')[0]);
    setDueDate(doc.dueDate || '');
    setPlaceOfSupply(doc.placeOfSupply || business?.stateCode || '27');
    setTargetBusinessId(doc.businessId || '');
    if (doc.lines && doc.lines.length > 0) {
      setLines(
        doc.lines.map((l: any) => ({
          description: l.description,
          hsnSac: l.hsnSac || '',
          unit: l.unit || 'PCS',
          qty: l.qty,
          rateRupees: (l.rate || 0) / 100,
          gstRate: l.gstRate || 18,
        }))
      );
    }
    setIsAddOpen(true);
  };

  const handleSaveBill = async (finalizeAndLock: boolean) => {
    if (!vendorId) {
      setErrorMsg('Please select a supplier / vendor.');
      return;
    }
    if (computedLines.length === 0 || computedLines.some((l) => !l.description)) {
      setErrorMsg('Please enter description for all line items.');
      return;
    }

    if (finalizeAndLock) {
      const confirmed = window.confirm(
        '⚠️ Warning: Once Saved & Finalized, this entry is permanently posted to accounting ledgers and CANNOT be edited. Are you sure you want to finalize and lock this entry?'
      );
      if (!confirmed) return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload: any = {
        businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
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
      };

      let savedDocId = editingDocId;
      if (editingDocId) {
        // Update existing draft
        const res = await api.put(`/api/v1/documents/${editingDocId}`, payload);
        savedDocId = res.document?.id || editingDocId;
      } else {
        // Create new bill
        const res = await api.post('/api/v1/documents', payload);
        savedDocId = res.document?.id;
      }

      // If user selected "Save & Lock", post it immediately
      if (finalizeAndLock && savedDocId) {
        await api.post(`/api/v1/documents/${savedDocId}/post`);
      }

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
        '⚠️ Warning: Once Saved & Finalized, this entry is permanently posted to accounting ledgers and CANNOT be edited. Are you sure you want to finalize and lock this entry?'
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

  const handleDeleteDraft = async (id: string, docNo: string) => {
    const isOverride = user?.role === 'super_admin';
    if (!confirm(isOverride ? `⚠️ Super-Admin Master Override:\nPermanently delete bill #${docNo}? This will delete the entry across all distributor accounting ledgers.` : `Delete draft bill #${docNo}? This will permanently remove this draft.`)) return;
    try {
      await api.delete(`/api/v1/documents/${id}`);
      fetchBills();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft bill');
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Purchase Bills</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-300/40">
                Supplier Entries & ITC
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Record supplier bills, verify input tax credit (ITC), and track vendor payables with Unit Measures and Draft vs Lock controls
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
                  {user?.role === 'super_admin' && (
                    <th className="py-3 px-4 whitespace-nowrap text-indigo-600 dark:text-indigo-400">Distributor Firm</th>
                  )}
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Vendor / Supplier</th>
                  <th className="py-3 px-4 whitespace-nowrap">Items & Units</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Taxable Value</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">ITC (GST)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Bill Total (₹)</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status & Lock</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={user?.role === 'super_admin' ? 10 : 9} className="py-8 text-center text-slate-400">
                      Loading purchase bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'super_admin' ? 10 : 9} className="py-8 text-center text-slate-400">
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
                      {user?.role === 'super_admin' && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {b.distributorName || 'Distributor'}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono whitespace-nowrap">{b.docDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {b.partyName}
                        {b.partyGstin && (
                          <div className="text-[10px] text-slate-400 font-mono">{b.partyGstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {b.lines && b.lines.length > 0 ? (
                          <div className="space-y-0.5">
                            {b.lines.slice(0, 2).map((l: any, i: number) => (
                              <div key={i} className="text-[11px] truncate max-w-[200px]">
                                {l.description} ({l.qty} {l.unit || 'PCS'})
                              </div>
                            ))}
                            {b.lines.length > 2 && (
                              <div className="text-[10px] text-slate-400 italic">
                                +{b.lines.length - 2} more item(s)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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
                        {b.status === 'posted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                            <Lock className="w-2.5 h-2.5" />
                            <span>LOCKED (POSTED)</span>
                          </span>
                        ) : b.status === 'void' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200">
                            <Ban className="w-2.5 h-2.5" />
                            <span>VOIDED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                            <FileCheck className="w-2.5 h-2.5" />
                            <span>DRAFT (EDITABLE)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {b.status === 'draft' ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(b)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                              title="Edit this draft bill"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handlePost(b.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                              title="Save & Lock: Post bill to accounting ledgers permanently"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Save & Lock</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(b.id, b.docNo)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                              title="Delete draft bill"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : b.status === 'posted' ? (
                          <div className="inline-flex items-center space-x-1">
                            <button
                              onClick={() => handleVoid(b.id)}
                              className="px-2 py-1 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-[11px] font-semibold transition"
                              title="Void bill & reverse ledger entries"
                            >
                              <Ban className="w-3 h-3 inline mr-1" />
                              <span>Void</span>
                            </button>
                            {user?.role === 'super_admin' && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(b)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[10px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                                  title="Super Admin Override Edit"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(b.id, b.docNo)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                                  title="Super Admin Override Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1">
                            <span className="text-[11px] text-slate-400 italic">Voided</span>
                            {user?.role === 'super_admin' && (
                              <button
                                onClick={() => handleDeleteDraft(b.id, b.docNo)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center ml-1"
                                title="Super Admin Override Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
          RECORD / EDIT PURCHASE BILL MODAL
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
                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
                  {editingDocId ? <Edit3 className="w-5 h-5" /> : <FileCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {editingDocId ? 'Edit Draft Purchase Bill' : 'Record Purchase Bill (Supplier Entry)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter supplier tax invoice details, select unit measures (KG, BOX, PCS, etc.), and choose Save as Draft or Final Save & Lock.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Warning Banner regarding Save vs Lock */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5 text-slate-700 dark:text-slate-300 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-800 dark:text-amber-300">Important Accounting Workflow:</span>{' '}
                  <strong>Save as Draft</strong> preserves the entry in editable state. <strong>Final Save & Lock</strong> permanently posts double-entry ledger transactions and locks the record against any future changes.
                </div>
              </div>

              {/* Supplier & Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                {user?.role === 'super_admin' && !editingDocId && (
                  <div className="sm:col-span-4 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <label className="block font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                      🏢 Target Distributor Firm (Super-Admin Master Scope) *
                    </label>
                    <select
                      value={targetBusinessId}
                      onChange={(e) => setTargetBusinessId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="" disabled>-- Select Distributor Firm --</option>
                      {distributors.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.gstin ? `(${d.gstin})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                        <th className="py-2.5 px-2 w-20">HSN/SAC</th>
                        <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                        <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                        <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-2 w-20 text-center">GST %</th>
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
                                        {i.name} ({i.unit || 'PCS'})
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
                              <select
                                value={line.unit || 'PCS'}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].unit = e.target.value;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1 text-xs text-center font-semibold border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50/60 dark:bg-slate-800 text-amber-900 dark:text-amber-300"
                              >
                                {ITEM_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
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

              {/* Form Action Buttons: Draft vs Final Save & Lock */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Draft = Editable later | Save & Lock = Immutable posted entry</span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancel
                  </button>

                  {/* 1. SAVE AS DRAFT BUTTON */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveBill(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition inline-flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-500" />
                    <span>Save as Draft (Editable)</span>
                  </button>

                  {/* 2. FINAL SAVE & LOCK BUTTON */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveBill(true)}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 rounded-xl shadow-md shadow-emerald-500/20 transition inline-flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-950" />
                    <span>Final Save & Lock (Cannot Edit)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
