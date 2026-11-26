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
import { downloadInvoicePdf } from '@/lib/pdf';
import {
  Plus,
  FileText,
  Search,
  Download,
  Mail,
  CheckCircle,
  Ban,
  X,
  Trash2,
  Lock,
  Edit3,
  Save,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

export default function InvoicesPage() {
  const { business, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Invoice Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [partyId, setPartyId] = useState('');
  const [docNo, setDocNo] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('27'); // Default
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

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/v1/documents?type=sales_invoice');
      setInvoices(data.documents || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        api.get('/api/v1/parties?kind=customer'),
        api.get('/api/v1/items'),
      ]);
      setParties(pRes.parties || []);
      setItems(iRes.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchInvoices();
    fetchMasters();
  }, []);

  const handlePartySelect = (id: string) => {
    setPartyId(id);
    const selected = parties.find((p) => p.id === id);
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
      rateRupees: item.salePrice / 100,
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

  // Compute live totals
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
      description: line.description,
      hsnSac: line.hsnSac,
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
    setPartyId('');
    setDocNo('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setPlaceOfSupply(business?.stateCode || '27');
    setLines([{ description: '', hsnSac: '', unit: 'PCS', qty: 1, rateRupees: 0, gstRate: 18 }]);
    setErrorMsg(null);
  };

  const handleOpenEdit = (doc: any) => {
    if (doc.status === 'posted') {
      alert('⚠️ This invoice is Saved & Locked. Posted accounting entries cannot be modified to preserve ledger integrity.');
      return;
    }
    setEditingDocId(doc.id);
    setPartyId(doc.partyId || '');
    setDocNo(doc.docNo || '');
    setDocDate(doc.docDate || new Date().toISOString().split('T')[0]);
    setDueDate(doc.dueDate || '');
    setPlaceOfSupply(doc.placeOfSupply || business?.stateCode || '27');
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

  const handleSaveInvoice = async (finalizeAndLock: boolean) => {
    if (!partyId) {
      setErrorMsg('Please select a customer.');
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

      const payload = {
        docType: 'sales_invoice',
        docNo: docNo.trim() || undefined,
        docDate,
        dueDate: dueDate || undefined,
        partyId,
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
        // Create new invoice
        const res = await api.post('/api/v1/documents', payload);
        savedDocId = res.document?.id;
      }

      // If user chose Save & Lock, post it immediately
      if (finalizeAndLock && savedDocId) {
        await api.post(`/api/v1/documents/${savedDocId}/post`);
      }

      setIsAddOpen(false);
      resetForm();
      fetchInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save invoice');
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
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to post invoice');
    }
  };

  const handleDeleteDraft = async (id: string, number: string) => {
    if (!confirm(`Delete draft invoice #${number}? This will permanently remove this draft.`)) return;
    try {
      await api.delete(`/api/v1/documents/${id}`);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft invoice');
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm('Void this invoice? This will reverse all posted accounting entries.')) return;
    try {
      await api.post(`/api/v1/documents/${id}/void`);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to void');
    }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      const data = await api.get(`/api/v1/documents/${id}/pdf-data`);
      downloadInvoicePdf(data);
    } catch (err: any) {
      alert(err.message || 'Failed to generate PDF');
    }
  };

  const handleSendEmail = async (id: string) => {
    const toEmail = prompt('Enter customer recipient email:');
    if (!toEmail) return;
    try {
      const res = await api.post(`/api/v1/documents/${id}/email`, { toEmail });
      alert(res.message || 'Email sent successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to send email');
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.docNo?.toLowerCase().includes(search.toLowerCase()) ||
      inv.partyName?.toLowerCase().includes(search.toLowerCase()) ||
      inv.partyGstin?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell currentMenu="sales_invoices">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Sales Invoices</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-medium border border-blue-300/40">
                Tax Invoicing & GST
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              GST-compliant tax invoicing with Unit Measures, client-side PDF export, and Draft vs Lock controls
            </p>
          </div>

          {hasPermission('sales_invoices', 'create') && (
            <button
              onClick={() => {
                resetForm();
                setIsAddOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Tax Invoice
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Invoice #, Customer, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <span>Total Invoices:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filteredInvoices.length}
            </span>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Invoice #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">Customer</th>
                  <th className="py-3 px-4 whitespace-nowrap">Items & Units</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Taxable Value</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total Tax</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Invoice Total (₹)</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status & Lock</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No invoices found. Click 'Create Tax Invoice' to generate one.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {inv.docNo}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">{inv.docDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {inv.partyName}
                        {inv.partyGstin && (
                          <div className="text-[10px] text-slate-400 font-mono">{inv.partyGstin}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {inv.lines && inv.lines.length > 0 ? (
                          <div className="space-y-0.5">
                            {inv.lines.slice(0, 2).map((l: any, i: number) => (
                              <div key={i} className="text-[11px] truncate max-w-[200px]">
                                {l.description} ({l.qty} {l.unit || 'PCS'})
                              </div>
                            ))}
                            {inv.lines.length > 2 && (
                              <div className="text-[10px] text-slate-400 italic">
                                +{inv.lines.length - 2} more item(s)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium whitespace-nowrap">
                        ₹ {formatPaise(inv.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600 whitespace-nowrap">
                        ₹ {formatPaise(inv.taxTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        ₹ {formatPaise(inv.total)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {inv.status === 'posted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                            <Lock className="w-2.5 h-2.5" />
                            <span>LOCKED (POSTED)</span>
                          </span>
                        ) : inv.status === 'void' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200">
                            <Ban className="w-2.5 h-2.5" />
                            <span>VOIDED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                            <FileText className="w-2.5 h-2.5" />
                            <span>DRAFT (EDITABLE)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {inv.status === 'draft' ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(inv)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                              title="Edit this draft invoice"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handlePost(inv.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center space-x-1"
                              title="Save & Lock: Post invoice to accounting ledgers permanently"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Save & Lock</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(inv.id, inv.docNo)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition inline-flex items-center"
                              title="Delete draft invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : inv.status === 'posted' ? (
                          <>
                            <button
                              onClick={() => handleDownloadPdf(inv.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title="Download GST PDF"
                            >
                              <Download className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleSendEmail(inv.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title="Email Invoice"
                            >
                              <Mail className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleVoid(inv.id)}
                              className="px-2 py-0.5 bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-[10px] font-semibold transition inline-flex items-center"
                              title="Void invoice & reverse ledger"
                            >
                              <Ban className="w-2.5 h-2.5 mr-0.5" />
                              <span>Void</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No actions</span>
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

      {/* CREATE / EDIT INVOICE MODAL */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          style={{ zIndex: 100, pointerEvents: 'auto' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 relative z-[101]"
            style={{ zIndex: 101 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-50/50 via-slate-50 to-slate-50 dark:from-slate-800/40 dark:to-slate-900">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-xl">
                  {editingDocId ? <Edit3 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {editingDocId ? 'Edit Draft Tax Invoice' : 'Create GST Tax Invoice'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Generate compliant sales invoices with Unit of Measures (KG, BOX, PCS, etc.), and choose Save as Draft or Final Save & Lock.
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Warning Banner regarding Save vs Lock */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start gap-2.5 text-slate-700 dark:text-slate-300 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-800 dark:text-blue-300">Important Accounting Workflow:</span>{' '}
                  <strong>Save as Draft</strong> saves the invoice in editable status. <strong>Final Save & Lock</strong> posts double-entry accounts receivable and tax ledgers, making the entry permanently immutable.
                </div>
              </div>

              {/* Customer & Header */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={partyId}
                    onChange={(e) => handlePartySelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select customer...</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.gstin ? `(${p.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice # (Auto if empty)
                  </label>
                  <input
                    type="text"
                    value={docNo}
                    onChange={(e) => setDocNo(e.target.value)}
                    placeholder="Auto-generated"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Place of Supply (State) *
                  </label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                    Invoice Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
                                  className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                                className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                                className="w-full px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                                className="w-full px-2 py-1 text-xs text-center font-semibold border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/60 dark:bg-slate-800 text-blue-900 dark:text-blue-300"
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
                                className="w-full px-2 py-1 text-xs text-right border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                                className="w-full px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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

              {/* Totals */}
              <div className="flex flex-col sm:flex-row justify-end pt-3">
                <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Subtotal:</span>
                    <span>₹ {(Number(computedSubtotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
                    <span>Total Tax (GST):</span>
                    <span>₹ {(Number(computedTaxTotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {Number(roundOff) !== 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round Off:</span>
                      <span>₹ {(Number(roundOff) / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>Invoice Grand Total:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      ₹ {(Number(finalTotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons: Draft vs Final Save & Lock */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
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
                    onClick={() => handleSaveInvoice(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition inline-flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-500" />
                    <span>Save as Draft (Editable)</span>
                  </button>

                  {/* 2. FINAL SAVE & LOCK BUTTON */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveInvoice(true)}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl shadow-md shadow-blue-500/20 transition inline-flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5 text-white" />
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
