'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise, paiseToWords } from '@bizledger/shared';
import { downloadCreditNotePdf, CreditNotePdfData } from '@/lib/pdf';
import {
  RotateCcw,
  Plus,
  Printer,
  Calendar,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ArrowRight,
  Layers,
  FileCheck,
  Undo2,
  RefreshCw,
  X,
} from 'lucide-react';

interface ReturnLineItem {
  id: string;
  itemId?: string | null;
  description: string;
  hsnSac?: string;
  originalQty: number;
  returnQty: number;
  unit: string;
  rate: number; // in paise
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}

export default function ReturnsPage() {
  const { business, user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'sales_return' | 'purchase_return'>('sales_return');
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Return Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [returnType, setReturnType] = useState<'credit_note' | 'debit_note'>('credit_note');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [returnDate, setReturnDate] = useState(todayStr);
  const [returnReason, setReturnReason] = useState('Goods Damaged / Defective');
  const [returnLines, setReturnLines] = useState<ReturnLineItem[]>([]);
  const [placeOfSupply, setPlaceOfSupply] = useState('32');

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [notesRes, partiesRes, invRes, billsRes] = await Promise.all([
        api.get<any>('/api/v1/documents'),
        api.get<any>('/api/v1/parties'),
        api.get<any>('/api/v1/documents?type=sales_invoice'),
        api.get<any>('/api/v1/documents?type=purchase_bill'),
      ]);

      const allDocs = notesRes.documents || [];
      const notes = allDocs.filter(
        (d: any) => d.docType === 'credit_note' || d.docType === 'debit_note'
      );

      setReturnsList(notes);
      setParties(partiesRes.parties || []);
      setInvoices((invRes.documents || []).filter((d: any) => d.status === 'posted'));
      setBills((billsRes.documents || []).filter((d: any) => d.status === 'posted'));
    } catch (err) {
      console.error('Failed to load returns data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business?.id]);

  // Available original documents for the selected party
  const availableOriginalDocs = useMemo(() => {
    if (!selectedPartyId) return [];
    if (returnType === 'credit_note') {
      return invoices.filter((inv) => inv.partyId === selectedPartyId);
    } else {
      return bills.filter((b) => b.partyId === selectedPartyId);
    }
  }, [selectedPartyId, returnType, invoices, bills]);

  // When user selects an original invoice/bill, populate line items automatically
  const handleSelectOriginalDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (!docId) {
      setReturnLines([]);
      return;
    }

    const doc = (returnType === 'credit_note' ? invoices : bills).find((d) => d.id === docId);
    if (!doc) return;

    if (doc.placeOfSupply) {
      setPlaceOfSupply(doc.placeOfSupply);
    }

    // Default to Part Return with 0 quantity so user can choose what to return
    const lines: ReturnLineItem[] = (doc.lines || []).map((l: any) => ({
      id: crypto.randomUUID(),
      itemId: l.itemId,
      description: l.description,
      hsnSac: l.hsnSac,
      originalQty: l.qty || 1,
      returnQty: l.qty || 1, // initial set to 100%
      unit: l.unit || 'PCS',
      rate: l.rate,
      gstRate: l.gstRate || 0,
      cgst: l.cgst || 0,
      sgst: l.sgst || 0,
      igst: l.igst || 0,
      lineTotal: l.lineTotal || (l.rate * (l.qty || 1)),
    }));

    setReturnLines(lines);
  };

  // One-click: Return Full Bill
  const handleReturnFullBill = () => {
    setReturnLines((prev) =>
      prev.map((l) => {
        const taxable = l.rate * l.originalQty;
        const taxRate = l.gstRate;
        const isInterState = placeOfSupply !== (business?.stateCode || '32');
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = Math.round((taxable * taxRate) / 100);
        } else {
          cgst = Math.round((taxable * (taxRate / 2)) / 100);
          sgst = cgst;
        }
        return {
          ...l,
          returnQty: l.originalQty,
          cgst,
          sgst,
          igst,
          lineTotal: taxable + cgst + sgst + igst,
        };
      })
    );
  };

  // Update line return quantity
  const handleUpdateLineQty = (lineId: string, qty: number) => {
    setReturnLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const safeQty = Math.max(0, Math.min(qty, l.originalQty));
        const taxable = l.rate * safeQty;
        const taxRate = l.gstRate;
        const isInterState = placeOfSupply !== (business?.stateCode || '32');
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = Math.round((taxable * taxRate) / 100);
        } else {
          cgst = Math.round((taxable * (taxRate / 2)) / 100);
          sgst = cgst;
        }
        return {
          ...l,
          returnQty: safeQty,
          cgst,
          sgst,
          igst,
          lineTotal: taxable + cgst + sgst + igst,
        };
      })
    );
  };

  // Remove line from return
  const handleRemoveLine = (lineId: string) => {
    setReturnLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // Computed Totals for the return form
  const formTotals = useMemo(() => {
    const activeLines = returnLines.filter((l) => l.returnQty > 0);
    let subtotal = 0;
    let taxTotal = 0;
    for (const l of activeLines) {
      const taxable = l.rate * l.returnQty;
      subtotal += taxable;
      taxTotal += (l.cgst || 0) + (l.sgst || 0) + (l.igst || 0);
    }
    const total = subtotal + taxTotal;
    return { subtotal, taxTotal, total, count: activeLines.length };
  }, [returnLines]);

  // Submit return
  const handleSubmitReturn = async () => {
    if (!selectedPartyId) {
      setFormError('Please select a customer or vendor.');
      return;
    }
    const activeLines = returnLines.filter((l) => l.returnQty > 0);
    if (activeLines.length === 0) {
      setFormError('Please specify return quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const origDoc = (returnType === 'credit_note' ? invoices : bills).find(
      (d) => d.id === selectedDocId
    );

    const payload = {
      docType: returnType,
      partyId: selectedPartyId,
      docDate: returnDate,
      placeOfSupply,
      originalDocId: selectedDocId || null,
      originalDocNo: origDoc?.docNo || null,
      returnReason,
      subtotal: formTotals.subtotal,
      taxTotal: formTotals.taxTotal,
      roundOff: 0,
      total: formTotals.total,
      autoPost: true, // Post immediately to update ledger
      lines: activeLines.map((l) => ({
        itemId: l.itemId || null,
        description: l.description,
        hsnSac: l.hsnSac || '-',
        unit: l.unit || 'PCS',
        qty: l.returnQty,
        rate: l.rate,
        discount: 0,
        gstRate: l.gstRate,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        lineTotal: l.lineTotal,
      })),
    };

    try {
      await api.post('/api/v1/documents', payload);
      setModalOpen(false);
      setSelectedPartyId('');
      setSelectedDocId('');
      setReturnLines([]);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record return entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Print Credit Note or Debit Note
  const handlePrintNote = (note: any) => {
    const party = parties.find((p) => p.id === note.partyId);
    const pdfData: CreditNotePdfData = {
      business: {
        name: business?.name || 'Gold Father',
        gstin: business?.gstin?.trim() || 'Unregistered',
        address: business?.address || 'Kerala',
        stateCode: business?.stateCode || '32',
      },
      note: {
        docType: note.docType,
        docNo: note.docNo,
        docDate: note.docDate,
        originalDocNo: note.originalDocNo || null,
        originalDocDate: note.originalDocDate || null,
        returnReason: note.returnReason || null,
        placeOfSupply: note.placeOfSupply || '32',
        subtotal: note.subtotal,
        taxTotal: note.taxTotal,
        roundOff: note.roundOff || 0,
        total: note.total,
        lines: (note.lines || []).map((l: any) => ({
          description: l.description,
          hsnSac: l.hsnSac || '-',
          qty: l.qty || 1,
          unit: l.unit || 'PCS',
          rate: l.rate,
          gstRate: l.gstRate || 0,
          cgst: l.cgst || 0,
          sgst: l.sgst || 0,
          igst: l.igst || 0,
          lineTotal: l.lineTotal || (l.rate * (l.qty || 1)),
        })),
      },
      party: {
        name: party?.name || note.partyName || 'Party Account',
        gstin: party?.gstin || note.partyGstin || '',
        address: party?.address || 'Kerala',
        phone: party?.phone || '',
      },
    };

    downloadCreditNotePdf(pdfData);
  };

  // Filtered returns list for the current tab
  const displayedReturns = useMemo(() => {
    const targetType = activeTab === 'sales_return' ? 'credit_note' : 'debit_note';
    return returnsList.filter((note) => {
      if (note.docType !== targetType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const partyName = (note.partyName || '').toLowerCase();
        const docNo = (note.docNo || '').toLowerCase();
        const origNo = (note.originalDocNo || '').toLowerCase();
        if (!partyName.includes(q) && !docNo.includes(q) && !origNo.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [returnsList, activeTab, searchQuery]);

  return (
    <AppShell currentMenu="returns">
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-amber-500" />
              <span>Returns & Credit/Debit Notes</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Part & Full Bill Returns for Sales (Credit Notes) and Purchases (Debit Notes) with Tax Reversals
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setReturnType(activeTab === 'sales_return' ? 'credit_note' : 'debit_note');
                setSelectedPartyId('');
                setSelectedDocId('');
                setReturnLines([]);
                setFormError(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Record New Return Entry</span>
            </button>

            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('sales_return')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'sales_return'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Sales Returns (Credit Notes)</span>
            </button>

            <button
              onClick={() => setActiveTab('purchase_return')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'purchase_return'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Purchase Returns (Debit Notes)</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Note #, Party, Original Inv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            />
          </div>
        </div>

        {/* Returns Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">Note #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Party Name</th>
                  <th className="py-3 px-3">Original Invoice / Bill</th>
                  <th className="py-3 px-3">Return Reason</th>
                  <th className="py-3 px-3 text-right">Taxable Reversal</th>
                  <th className="py-3 px-3 text-right">Tax Reversal</th>
                  <th className="py-3 px-3 text-right">Total Reversal</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Print / PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedReturns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">
                        No {activeTab === 'sales_return' ? 'credit notes (sales returns)' : 'debit notes (purchase returns)'} recorded yet
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedReturns.map((note) => (
                    <tr key={note.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {note.docNo}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">
                        {note.docDate}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {note.partyName || 'Party Account'}
                      </td>
                      <td className="py-3 px-3 font-mono text-blue-600 font-semibold">
                        {note.originalDocNo || '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {note.returnReason || 'General Return'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        ₹ {formatPaise(note.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        ₹ {formatPaise(note.taxTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-red-600 dark:text-red-400">
                        ₹ {formatPaise(note.total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Posted & Locked
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handlePrintNote(note)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:text-slate-900 rounded-md text-xs font-bold transition shadow-xs"
                          title="Print Corporate Black & White Credit/Debit Note"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          <span>Print Note</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Record Return Dialog Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-500" />
                    <span>
                      Record {returnType === 'credit_note' ? 'Sales Return (Credit Note)' : 'Purchase Return (Debit Note)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select original document to auto-load items, then adjust quantity for part or full return
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Return Type Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('credit_note');
                      setSelectedPartyId('');
                      setSelectedDocId('');
                      setReturnLines([]);
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      returnType === 'credit_note'
                        ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      Sales Return (Credit Note)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Customer returns goods sold; reverses sales income & GST liability
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('debit_note');
                      setSelectedPartyId('');
                      setSelectedDocId('');
                      setReturnLines([]);
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      returnType === 'debit_note'
                        ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      Purchase Return (Debit Note)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Return goods to vendor; reverses purchase expense & input GST credit
                    </p>
                  </button>
                </div>

                {/* Primary Meta Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Party Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {returnType === 'credit_note' ? 'Customer *' : 'Vendor *'}
                    </label>
                    <select
                      value={selectedPartyId}
                      onChange={(e) => {
                        setSelectedPartyId(e.target.value);
                        setSelectedDocId('');
                        setReturnLines([]);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="">-- Select {returnType === 'credit_note' ? 'Customer' : 'Vendor'} --</option>
                      {parties
                        .filter((p) =>
                          returnType === 'credit_note'
                            ? p.kind === 'customer' || p.kind === 'both'
                            : p.kind === 'vendor' || p.kind === 'both'
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.gstin ? `(${p.gstin})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Original Doc Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Link Original {returnType === 'credit_note' ? 'Sales Invoice' : 'Purchase Bill'}
                    </label>
                    <select
                      value={selectedDocId}
                      onChange={(e) => handleSelectOriginalDoc(e.target.value)}
                      disabled={!selectedPartyId}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium disabled:opacity-50"
                    >
                      <option value="">-- Choose Original Doc --</option>
                      {availableOriginalDocs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.docNo} ({doc.docDate}) - ₹ {formatPaise(doc.total)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Return Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Return Date *
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                {/* Reason for Return */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Return *
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    <option value="Goods Damaged / Defective">Goods Damaged in Transit / Defective</option>
                    <option value="Quality Rejection / Substandard">Quality Rejection / Substandard Goods</option>
                    <option value="Rate Difference / Price Correction">Rate Difference / Price Overcharge Adjustment</option>
                    <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                    <option value="Excess Quantity Returned">Excess Quantity Shipped & Returned</option>
                    <option value="Customer Order Cancellation">Customer Order Cancellation</option>
                    <option value="Mutual Commercial Agreement">Mutual Commercial Agreement</option>
                  </select>
                </div>

                {/* Return Items Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                      Returned Goods & Quantities ({returnLines.length} Items)
                    </h4>
                    {returnLines.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleReturnFullBill}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md text-xs transition shadow-xs"
                        >
                          Return Full Bill (100% Qty)
                        </button>
                      </div>
                    )}
                  </div>

                  {returnLines.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center text-slate-400 text-xs">
                      Please select an original invoice or bill above to load items for return.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] border-b">
                          <tr>
                            <th className="py-2.5 px-3">Item Description</th>
                            <th className="py-2.5 px-3 text-center">Billed Qty</th>
                            <th className="py-2.5 px-3 text-center w-28">Return Qty</th>
                            <th className="py-2.5 px-3 text-center">Unit</th>
                            <th className="py-2.5 px-3 text-right">Rate</th>
                            <th className="py-2.5 px-3 text-right">GST %</th>
                            <th className="py-2.5 px-3 text-right">Return Tax</th>
                            <th className="py-2.5 px-3 text-right">Total Return</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {returnLines.map((line) => (
                            <tr key={line.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                {line.description}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                {line.originalQty}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={line.originalQty}
                                  value={line.returnQty}
                                  onChange={(e) => handleUpdateLineQty(line.id, Number(e.target.value))}
                                  className="w-20 px-2 py-1 text-center text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                {line.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                ₹ {formatPaise(line.rate)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {line.gstRate}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                ₹ {formatPaise(line.cgst + line.sgst + line.igst)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                ₹ {formatPaise(line.lineTotal)}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(line.id)}
                                  className="text-slate-400 hover:text-red-500"
                                  title="Exclude item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Form Totals Summary Card */}
                {returnLines.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400">
                      <p>Active Return Lines: <span className="font-bold text-slate-900 dark:text-slate-100">{formTotals.count}</span></p>
                      <p>Taxable Reversal: ₹ {formatPaise(formTotals.subtotal)} | GST Reversal: ₹ {formatPaise(formTotals.taxTotal)}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Total {returnType === 'credit_note' ? 'Credit Note Value' : 'Debit Note Value'}
                      </p>
                      <p className="text-xl font-black text-red-600 dark:text-red-400">
                        ₹ {formatPaise(formTotals.total)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmitReturn}
                  disabled={submitting || formTotals.count === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition"
                >
                  {submitting ? 'Recording & Locking Return...' : 'Save & Lock Return Entry'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
