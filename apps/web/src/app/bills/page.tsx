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
  Layers,
  MapPin,
} from 'lucide-react';

interface PurchaseBillLine {
  vendorId: string;
  supplierBillNo: string;
  docDate: string;
  itemId?: string;
  description: string;
  hsnSac: string;
  unit: string;
  qty: number;
  rateRupees: number;
  gstRate: number;
}

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

  // Top header fields (moved upward from table as requested, default Kerala 32)
  const defaultKeralaState = business?.stateCode || '32';
  const todayDate = new Date().toISOString().split('T')[0];

  const [placeOfSupply, setPlaceOfSupply] = useState<string>(defaultKeralaState);
  const [dueDate, setDueDate] = useState<string>('');

  // Feature toggles for Kerala produce / multi-vendor daybook
  const [isFixedRate, setIsFixedRate] = useState(false);
  const [autoFillVendor, setAutoFillVendor] = useState(true);
  const [autoFillDate, setAutoFillDate] = useState(true);

  // Daybook Line items
  const [lines, setLines] = useState<PurchaseBillLine[]>([
    {
      vendorId: '',
      supplierBillNo: '',
      docDate: todayDate,
      description: '',
      hsnSac: '',
      unit: 'KG',
      qty: 1,
      rateRupees: 0,
      gstRate: 0,
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

  // Handle Fixed Rate Toggle
  const handleToggleFixedRate = (checked: boolean) => {
    setIsFixedRate(checked);
    if (checked) {
      // In fixed rate lot mode, GST defaults to 0% for raw produce
      const updated = lines.map((l) => ({
        ...l,
        gstRate: 0,
        unit: l.unit || 'KG',
      }));
      setLines(updated);
    }
  };

  // Auto-fill vendor toggle in table header
  const handleToggleAutoFillVendor = (checked: boolean) => {
    setAutoFillVendor(checked);
    if (checked && lines.length > 1 && lines[0]?.vendorId) {
      const row0Vendor = lines[0].vendorId;
      const updated = lines.map((l, i) => {
        if (i === 0) return l;
        if (!l.vendorId) {
          return { ...l, vendorId: row0Vendor };
        }
        return l;
      });
      setLines(updated);
    }
  };

  // Auto-fill bill date toggle in table header
  const handleToggleAutoFillDate = (checked: boolean) => {
    setAutoFillDate(checked);
    if (checked && lines.length > 1 && lines[0]?.docDate) {
      const row0Date = lines[0].docDate;
      const updated = lines.map((l, i) => {
        if (i === 0) return l;
        if (!l.docDate) {
          return { ...l, docDate: row0Date };
        }
        return l;
      });
      setLines(updated);
    }
  };

  // Vendor selection per row
  const handleRowVendorSelect = (idx: number, vId: string) => {
    const oldRow0Vendor = lines[0]?.vendorId;
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      vendorId: vId,
    };

    // If changing row 0 and auto-fill is active, cascade to rows matching old row 0 or empty
    if (idx === 0 && autoFillVendor) {
      for (let i = 1; i < updated.length; i++) {
        if (!updated[i].vendorId || updated[i].vendorId === oldRow0Vendor) {
          updated[i] = {
            ...updated[i],
            vendorId: vId,
          };
        }
      }
    }

    setLines(updated);
  };

  // Date change per row
  const handleRowDateChange = (idx: number, newDate: string) => {
    const oldRow0Date = lines[0]?.docDate;
    const updated = [...lines];
    updated[idx] = {
      ...updated[idx],
      docDate: newDate,
    };

    if (idx === 0 && autoFillDate) {
      for (let i = 1; i < updated.length; i++) {
        if (!updated[i].docDate || updated[i].docDate === oldRow0Date) {
          updated[i] = {
            ...updated[i],
            docDate: newDate,
          };
        }
      }
    }

    setLines(updated);
  };

  // Master item select per row
  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      itemId: item.id,
      description: item.name,
      hsnSac: item.hsnSac || '',
      unit: item.unit || 'KG',
      rateRupees: (item.purchasePrice || item.salePrice || 0) / 100,
      gstRate: isFixedRate ? 0 : (item.gstRate !== undefined ? item.gstRate : 0),
    };
    setLines(updated);
  };

  // Add new line item
  const addLine = () => {
    const row0 = lines[0];
    const newVendorId = autoFillVendor && row0?.vendorId ? row0.vendorId : '';
    const newDate = autoFillDate && row0?.docDate ? row0.docDate : todayDate;

    setLines([
      ...lines,
      {
        vendorId: newVendorId,
        supplierBillNo: '',
        docDate: newDate,
        itemId: '',
        description: '',
        hsnSac: '',
        unit: 'KG',
        qty: 1,
        rateRupees: 0,
        gstRate: isFixedRate ? 0 : 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  // Compute live tax and totals based on top Place of Supply
  const bizState = business?.stateCode || '32';
  const isInterState = (placeOfSupply || defaultKeralaState) !== bizState;

  let computedSubtotal = 0n;
  let computedTaxTotal = 0n;

  const computedLines = lines.map((line) => {
    const qty = Number(line.qty) || 0;
    const ratePaise = BigInt(Math.round((Number(line.rateRupees) || 0) * 100));

    // When isFixedRate is true: Rate entered is line total directly (e.g. Mankda 250 KG @ 1200 => Taxable: ₹1200)
    const taxablePaise = isFixedRate ? ratePaise : BigInt(Math.round(qty * Number(ratePaise)));

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
      unit: line.unit || 'KG',
      qty,
      ratePaise: Number(ratePaise),
      taxablePaise: Number(taxRes.taxableAmount),
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
    setIsFixedRate(false);
    setAutoFillVendor(true);
    setAutoFillDate(true);
    setErrorMsg(null);
    setPlaceOfSupply(business?.stateCode || '32');
    setDueDate('');

    const firstVendorId = vendors[0]?.id || '';

    setLines([
      {
        vendorId: firstVendorId,
        supplierBillNo: '',
        docDate: todayDate,
        itemId: '',
        description: '',
        hsnSac: '',
        unit: 'KG',
        qty: 1,
        rateRupees: 0,
        gstRate: 0,
      },
    ]);
  };

  const handleOpenEdit = (doc: any) => {
    if (doc.status === 'posted' && user?.role !== 'super_admin') {
      alert(
        '⚠️ This entry is Saved & Locked. Posted accounting entries cannot be modified to preserve ledger integrity.'
      );
      return;
    }
    setEditingDocId(doc.id);
    setTargetBusinessId(doc.businessId || '');
    setPlaceOfSupply(doc.placeOfSupply || business?.stateCode || '32');
    setDueDate(doc.dueDate || '');

    const docDateVal = doc.docDate || todayDate;
    const vendorVal = doc.partyId || '';
    const billNoVal = doc.docNo || '';

    if (doc.lines && doc.lines.length > 0) {
      setLines(
        doc.lines.map((l: any) => ({
          vendorId: vendorVal,
          supplierBillNo: billNoVal,
          docDate: docDateVal,
          itemId: l.itemId || '',
          description: l.description,
          hsnSac: l.hsnSac || '',
          unit: l.unit || 'KG',
          qty: l.qty,
          rateRupees: (l.rate || 0) / 100,
          gstRate: l.gstRate !== undefined ? l.gstRate : 0,
        }))
      );
    } else {
      setLines([
        {
          vendorId: vendorVal,
          supplierBillNo: billNoVal,
          docDate: docDateVal,
          itemId: '',
          description: '',
          hsnSac: '',
          unit: 'KG',
          qty: 1,
          rateRupees: 0,
          gstRate: 0,
        },
      ]);
    }
    setIsAddOpen(true);
  };

  const handleSaveBill = async (finalizeAndLock: boolean) => {
    if (lines.length === 0) {
      setErrorMsg('Please add at least one line item.');
      return;
    }

    const missingVendorIdx = lines.findIndex((l) => !l.vendorId);
    if (missingVendorIdx !== -1) {
      setErrorMsg(`Row ${missingVendorIdx + 1}: Please select a Supplier / Vendor.`);
      return;
    }

    const missingDescIdx = lines.findIndex((l) => !l.description || !l.description.trim());
    if (missingDescIdx !== -1) {
      setErrorMsg(`Row ${missingDescIdx + 1}: Please enter item name or description.`);
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

      const targetPos = placeOfSupply || defaultKeralaState;

      if (editingDocId) {
        // Update single existing document
        const line0 = lines[0];
        const payloadLines = lines.map((l) => {
          const qty = Number(l.qty) || 0;
          const ratePaise = BigInt(Math.round((Number(l.rateRupees) || 0) * 100));
          const taxablePaise = isFixedRate ? ratePaise : BigInt(Math.round(qty * Number(ratePaise)));
          const taxRes = calculateLineTax({
            taxableAmount: taxablePaise,
            gstRate: Number(l.gstRate) || 0,
            isInterState,
          });

          return {
            itemId: l.itemId || undefined,
            description: l.description.trim(),
            hsnSac: l.hsnSac || '',
            unit: l.unit || 'KG',
            qty,
            rate: Number(ratePaise),
            discount: 0,
            gstRate: Number(l.gstRate) || 0,
            cgst: Number(taxRes.cgst),
            sgst: Number(taxRes.sgst),
            igst: Number(taxRes.igst),
            lineTotal: Number(taxRes.lineTotal),
          };
        });

        const payload: any = {
          businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
          docType: 'purchase_bill',
          docNo: line0.supplierBillNo?.trim() || undefined,
          docDate: line0.docDate || todayDate,
          dueDate: dueDate || undefined,
          partyId: line0.vendorId,
          placeOfSupply: targetPos,
          subtotal: Number(computedSubtotal),
          taxTotal: Number(computedTaxTotal),
          roundOff: Number(roundOff),
          total: Number(finalTotal),
          lines: payloadLines,
        };

        await api.put(`/api/v1/documents/${editingDocId}`, payload);
        if (finalizeAndLock) {
          await api.post(`/api/v1/documents/${editingDocId}/post`);
        }
      } else {
        // Multi-vendor Daybook: group rows by vendorId
        const vendorGroups: Record<string, typeof lines> = {};
        lines.forEach((l) => {
          if (!vendorGroups[l.vendorId]) vendorGroups[l.vendorId] = [];
          vendorGroups[l.vendorId].push(l);
        });

        const docsToCreate = Object.entries(vendorGroups).map(([vId, groupLines]) => {
          let grpSubtotal = 0n;
          let grpTaxTotal = 0n;

          const compGroupLines = groupLines.map((l) => {
            const qty = Number(l.qty) || 0;
            const ratePaise = BigInt(Math.round((Number(l.rateRupees) || 0) * 100));
            const taxablePaise = isFixedRate ? ratePaise : BigInt(Math.round(qty * Number(ratePaise)));
            const taxRes = calculateLineTax({
              taxableAmount: taxablePaise,
              gstRate: Number(l.gstRate) || 0,
              isInterState,
            });

            grpSubtotal += taxRes.taxableAmount;
            grpTaxTotal += taxRes.totalTax;

            return {
              itemId: l.itemId || undefined,
              description: l.description.trim(),
              hsnSac: l.hsnSac || '',
              unit: l.unit || 'KG',
              qty,
              rate: Number(ratePaise),
              discount: 0,
              gstRate: Number(l.gstRate) || 0,
              cgst: Number(taxRes.cgst),
              sgst: Number(taxRes.sgst),
              igst: Number(taxRes.igst),
              lineTotal: Number(taxRes.lineTotal),
            };
          });

          const grpUnrounded = grpSubtotal + grpTaxTotal;
          const { roundOff: grpRoundOff, finalTotal: grpFinalTotal } = calculateRoundOff(grpUnrounded);
          const firstLine = groupLines[0];

          return {
            businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
            docType: 'purchase_bill',
            docNo: firstLine.supplierBillNo?.trim() || undefined,
            docDate: firstLine.docDate || todayDate,
            dueDate: dueDate || undefined,
            partyId: vId,
            placeOfSupply: targetPos,
            subtotal: Number(grpSubtotal),
            taxTotal: Number(grpTaxTotal),
            roundOff: Number(grpRoundOff),
            total: Number(grpFinalTotal),
            lines: compGroupLines,
          };
        });

        await api.post('/api/v1/documents/batch', {
          documents: docsToCreate,
          finalizeAndLock,
          businessId: user?.role === 'super_admin' ? (targetBusinessId || undefined) : undefined,
        });
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
    if (
      !confirm(
        isOverride
          ? `⚠️ Super-Admin Master Override:\nPermanently delete bill #${docNo}? This will delete the entry across all distributor accounting ledgers.`
          : `Delete draft bill #${docNo}? This will permanently remove this draft.`
      )
    )
      return;
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
              <span>Purchase Bills & Daybook</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-300/40">
                Kerala Base (State 32)
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Record supplier purchases, single-entry daybook procurement across multiple vendors, Kerala GST taxation (32), and Fixed Rate / Lumpsum Lot calculations
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
                    <th className="py-3 px-4 whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                      Distributor Firm
                    </th>
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
                    <td
                      colSpan={user?.role === 'super_admin' ? 10 : 9}
                      className="py-8 text-center text-slate-400"
                    >
                      Loading purchase bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={user?.role === 'super_admin' ? 10 : 9}
                      className="py-8 text-center text-slate-400"
                    >
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
                                {l.description} ({l.qty} {l.unit || 'KG'})
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
          RECORD / EDIT PURCHASE BILL & MULTI-VENDOR DAYBOOK MODAL
      ========================================================================= */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          style={{ zIndex: 100, pointerEvents: 'auto' }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-[96vw] xl:max-w-7xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 relative z-[101]"
            style={{ zIndex: 101 }}
          >
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-50/60 via-slate-50 to-slate-50 dark:from-slate-800/50 dark:to-slate-900">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
                  {editingDocId ? <Edit3 className="w-5 h-5" /> : <FileCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>
                      {editingDocId ? 'Edit Draft Purchase Bill' : 'Record Purchase Bill / Daybook Entry'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/40">
                      Kerala (32) Intra-State Base
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Daybook procurement entry with multi-vendor support, Kerala state taxation (32), unit measures (KG, BOX, PCS), and Fixed Rate / Lumpsum Lot calculations.
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* TOP SECTION: Place of Supply (State POS default Kerala 32), Due Date, and Distributor Firm */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                {user?.role === 'super_admin' && !editingDocId && (
                  <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <label className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                        Target Distributor Firm (Super-Admin Master Scope) *
                      </label>
                    </div>
                    <select
                      value={targetBusinessId}
                      onChange={(e) => setTargetBusinessId(e.target.value)}
                      required
                      className="w-full sm:w-80 px-3 py-1.5 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="" disabled>
                        -- Select Distributor Firm --
                      </option>
                      {distributors.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.gstin ? `(${d.gstin})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  {/* Place of Supply State (Default Kerala 32) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Place of Supply (State POS) *</span>
                    </label>
                    <select
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {Object.entries(INDIAN_STATES).map(([code, name]) => (
                        <option key={code} value={code}>
                          {code} - {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Due Date */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Payment Due Date</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Tax Treatment Status */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center justify-between">
                    <span className="text-slate-500">Tax Treatment:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {isInterState ? 'Inter-State (IGST 100%)' : 'Intra-State Kerala (CGST 50% + SGST 50%)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Accounting Workflow Note */}
              <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl flex items-center justify-between text-slate-700 dark:text-slate-300 text-[11px]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Multi-Vendor Daybook:</strong> Enter purchases from different vendors on the same day. Lines are automatically grouped and posted to each vendor's ledger.
                  </span>
                </div>
                <span className="font-semibold text-amber-800 dark:text-amber-300 hidden md:inline">
                  Draft = Editable | Final Save & Lock = Immutable
                </span>
              </div>

              {/* Line Items Table Control Bar: Fixed Rate Checkbox on LEFT of Add Line Item */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    <span>Procurement Daybook & Line Items ({lines.length})</span>
                  </h4>

                  {/* USER REQUEST: Tick box on the left of + Add Line Item */}
                  <label
                    className={`inline-flex items-center gap-2 cursor-pointer px-3 py-1 rounded-xl border text-xs font-bold transition select-none shadow-xs ${
                      isFixedRate
                        ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                    title="Fixed Rate mode: Rate entered is the line total directly (e.g. Mankda 250 KG @ ₹1200 => Total ₹1200, 0% GST)"
                  >
                    <input
                      type="checkbox"
                      checked={isFixedRate}
                      onChange={(e) => handleToggleFixedRate(e.target.checked)}
                      className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-0 cursor-pointer accent-amber-600"
                    />
                    <span>Fixed Rate / Lumpsum Lot (Rate is Total, 0% GST)</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition transform active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Line Item</span>
                </button>
              </div>

              {/* Daybook Single Entry Grid (Clean & Formatted with ample column widths) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs min-w-[1240px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        {/* 1. Vendor / Supplier (with Auto-Fill Checkbox) */}
                        <th className="py-2.5 px-3 min-w-[210px] w-56">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold">Vendor / Supplier *</span>
                            <label
                              className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-normal cursor-pointer select-none"
                              title="Auto-fill down: Copy row 1 vendor to subsequent rows"
                            >
                              <input
                                type="checkbox"
                                checked={autoFillVendor}
                                onChange={(e) => handleToggleAutoFillVendor(e.target.checked)}
                                className="w-3 h-3 rounded text-amber-600 focus:ring-0 cursor-pointer accent-amber-600"
                              />
                              <span>Auto-fill</span>
                            </label>
                          </div>
                        </th>

                        {/* 2. Supplier Bill / Inv # */}
                        <th className="py-2.5 px-2 w-32">
                          <span>Bill / Inv #</span>
                        </th>

                        {/* 3. Bill Date (with Auto-Fill Checkbox) */}
                        <th className="py-2.5 px-2 w-36">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold">Bill Date *</span>
                            <label
                              className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-normal cursor-pointer select-none"
                              title="Auto-fill down: Copy row 1 date to subsequent rows"
                            >
                              <input
                                type="checkbox"
                                checked={autoFillDate}
                                onChange={(e) => handleToggleAutoFillDate(e.target.checked)}
                                className="w-3 h-3 rounded text-amber-600 focus:ring-0 cursor-pointer accent-amber-600"
                              />
                              <span>Auto-fill</span>
                            </label>
                          </div>
                        </th>

                        {/* 4. Item / Description */}
                        <th className="py-2.5 px-3 min-w-[240px]">
                          <span className="font-bold">Item / Description *</span>
                        </th>

                        {/* 5. HSN/SAC */}
                        <th className="py-2.5 px-2 w-24">HSN/SAC</th>

                        {/* 6. Qty */}
                        <th className="py-2.5 px-2 w-24 text-center font-bold">Qty</th>

                        {/* 7. Unit */}
                        <th className="py-2.5 px-2 w-24 text-center font-bold">Unit</th>

                        {/* 8. Rate */}
                        <th className="py-2.5 px-2 w-32 text-right">
                          <span className="font-bold">Rate (₹)</span>
                          {isFixedRate && (
                            <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                              [Lot Total]
                            </span>
                          )}
                        </th>

                        {/* 9. GST % */}
                        <th className="py-2.5 px-2 w-24 text-center font-bold">GST %</th>

                        {/* 10. Taxable */}
                        <th className="py-2.5 px-3 text-right w-28">Taxable</th>

                        {/* 11. Total */}
                        <th className="py-2.5 px-3 text-right w-32 font-bold">Total (₹)</th>

                        {/* 12. Action */}
                        <th className="py-2.5 px-2 w-12 text-center"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {lines.map((line, idx) => {
                        const comp = computedLines[idx];
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                          >
                            {/* 1. Vendor Dropdown */}
                            <td className="py-2.5 px-3">
                              <select
                                required
                                value={line.vendorId}
                                onChange={(e) => handleRowVendorSelect(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium"
                              >
                                <option value="">-- Select Vendor * --</option>
                                {vendors.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} {v.gstin ? `(${v.gstin.slice(0, 4)}...)` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 2. Supplier Bill / Inv # */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                placeholder="Bill / Inv #"
                                value={line.supplierBillNo}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].supplierBillNo = e.target.value;
                                  setLines(upd);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            {/* 3. Bill Date */}
                            <td className="py-2.5 px-2">
                              <input
                                type="date"
                                required
                                value={line.docDate}
                                onChange={(e) => handleRowDateChange(idx, e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            {/* 4. Item / Description */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                {items.length > 0 && (
                                  <select
                                    onChange={(e) => handleItemSelect(idx, e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>
                                      -- Select master item --
                                    </option>
                                    {items.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.name} ({i.unit || 'KG'})
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <input
                                  type="text"
                                  required
                                  placeholder="Item name / Mankda / Description *"
                                  value={line.description}
                                  onChange={(e) => {
                                    const upd = [...lines];
                                    upd[idx].description = e.target.value;
                                    setLines(upd);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                                />
                              </div>
                            </td>

                            {/* 5. HSN/SAC */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                placeholder="HSN"
                                value={line.hsnSac}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].hsnSac = e.target.value;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            {/* 6. Qty (Formatted & Clearly Visible) */}
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                required
                                value={line.qty}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].qty = parseFloat(e.target.value) || 0;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1.5 text-xs text-center border border-slate-300 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                              />
                            </td>

                            {/* 7. Unit (Formatted & Clearly Visible) */}
                            <td className="py-2.5 px-2">
                              <select
                                value={line.unit || 'KG'}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].unit = e.target.value;
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1.5 text-xs text-center font-bold border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-200"
                              >
                                {ITEM_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 8. Rate (₹) (Formatted & Clearly Visible) */}
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                value={line.rateRupees}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].rateRupees = parseFloat(e.target.value) || 0;
                                  setLines(upd);
                                }}
                                placeholder="0.00"
                                className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              />
                            </td>

                            {/* 9. GST % (Formatted & Clearly Visible) */}
                            <td className="py-2.5 px-2">
                              <select
                                value={line.gstRate}
                                onChange={(e) => {
                                  const upd = [...lines];
                                  upd[idx].gstRate = Number(e.target.value);
                                  setLines(upd);
                                }}
                                className="w-full px-2 py-1.5 text-xs text-center border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                              >
                                {GST_RATES.map((rate) => (
                                  <option key={rate} value={rate}>
                                    {rate}%
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 10. Taxable Value */}
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              ₹ {comp ? (comp.taxablePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                            </td>

                            {/* 11. Line Total */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              ₹ {comp ? (comp.lineTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                            </td>

                            {/* 12. Delete */}
                            <td className="py-2.5 px-2 text-center">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="text-slate-400 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                                  title="Remove line"
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

              {/* Bottom Summary & Tax Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                {/* Tax Treatment Info */}
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 max-w-md w-full">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Kerala Tax Treatment (State 32)</span>
                  </div>
                  <p className="text-[11px]">
                    Place of Supply: <strong>{INDIAN_STATES[placeOfSupply] || 'Kerala'} ({placeOfSupply})</strong>.
                  </p>
                  <p className="text-[11px]">
                    {isInterState
                      ? 'Inter-State Transaction: IGST 100% applies.'
                      : 'Intra-State Kerala: CGST 50% + Kerala SGST 50% applies.'}
                  </p>
                  {isFixedRate && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      ⚡ Fixed Rate Lot Active: Rate entered is the total lot price directly (e.g. Mankda 250 KG @ ₹1,200 = Total ₹1,200).
                    </p>
                  )}
                </div>

                {/* Totals Summary */}
                <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Subtotal:</span>
                    <span>
                      ₹ {(Number(computedSubtotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Input Tax Credit (GST):</span>
                    <span>
                      ₹ {(Number(computedTaxTotal) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {Number(roundOff) !== 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round Off:</span>
                      <span>₹ {(Number(roundOff) / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>Daybook Total:</span>
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
                  <span>Draft = Editable later | Save & Lock = Immutable posted ledger entries</span>
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
