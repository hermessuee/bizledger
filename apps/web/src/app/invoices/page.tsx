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
} from 'lucide-react';

export default function InvoicesPage() {
  const { business, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Invoice Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('27'); // Maharashtra default
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
      rateRupees: item.salePrice / 100,
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

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/documents', {
        docType: 'sales_invoice',
        docDate,
        dueDate: dueDate || undefined,
        partyId,
        placeOfSupply,
        subtotal: Number(computedSubtotal),
        taxTotal: Number(computedTaxTotal),
        roundOff: Number(roundOff),
        total: Number(finalTotal),
        lines: computedLines,
      });
      setIsAddOpen(false);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to save invoice');
    }
  };

  const handlePost = async (id: string) => {
    if (!confirm('Post this invoice? This will generate balanced double-entry accounting entries.')) return;
    try {
      await api.post(`/api/v1/documents/${id}/post`);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to post');
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

  return (
    <AppShell currentMenu="sales_invoices">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Sales Invoices & Billing
            </h1>
            <p className="text-xs text-slate-500">
              GST-compliant tax invoicing, automated double-entry posting, and client-side PDF export
            </p>
          </div>

          {hasPermission('sales_invoices', 'create') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Tax Invoice
            </button>
          )}
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
                  <th className="py-3 px-4 whitespace-nowrap">GSTIN</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Taxable</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Tax (GST)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total (₹)</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No invoices recorded yet. Click 'Create Tax Invoice' to issue your first invoice.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {inv.docNo}
                      </td>
                      <td className="py-3 px-4 font-mono">{inv.docDate}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {inv.partyName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {inv.partyGstin || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        ₹ {formatPaise(inv.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-500">
                        ₹ {formatPaise(inv.taxTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        ₹ {formatPaise(inv.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inv.status === 'posted'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : inv.status === 'void'
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {inv.status === 'draft' && hasPermission('sales_invoices', 'edit') && (
                          <button
                            onClick={() => handlePost(inv.id)}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[11px] font-semibold"
                          >
                            Post
                          </button>
                        )}
                        {inv.status === 'posted' && hasPermission('sales_invoices', 'delete') && (
                          <button
                            onClick={() => handleVoid(inv.id)}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[11px] font-semibold"
                          >
                            Void
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPdf(inv.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => handleSendEmail(inv.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold"
                        >
                          Email
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Tax Invoice Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                New Tax Invoice
              </h3>
              <button onClick={() => setIsAddOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={partyId}
                    onChange={(e) => handlePartySelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
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
                    Place of Supply (State) *
                  </label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                  >
                    {Object.entries(INDIAN_STATES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-blue-600 mt-0.5 block">
                    {isInterState ? 'Inter-state: IGST applicable' : 'Intra-state: CGST + SGST split'}
                  </span>
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
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase text-slate-600">Line Items</h4>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + Add Line Item
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    <div className="col-span-4">
                      <select
                        onChange={(e) => handleItemSelect(idx, e.target.value)}
                        className="w-full mb-1 px-2 py-1 border rounded text-[11px] outline-none"
                      >
                        <option value="">Quick select from items...</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (₹{i.salePrice / 100})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        placeholder="Item / Service description *"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].description = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-xs outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="HSN/SAC"
                        value={line.hsnSac}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].hsnSac = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-xs outline-none"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].qty = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-xs outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        placeholder="Rate ₹"
                        value={line.rateRupees}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].rateRupees = e.target.value;
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-xs outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={line.gstRate}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].gstRate = Number(e.target.value);
                          setLines(updated);
                        }}
                        className="w-full px-2 py-1 border rounded text-xs outline-none"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}% GST
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-right">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg flex flex-col items-end space-y-1 text-xs">
                <div className="flex justify-between w-64">
                  <span className="text-slate-500">Taxable Subtotal:</span>
                  <span className="font-semibold">₹ {formatPaise(computedSubtotal)}</span>
                </div>
                <div className="flex justify-between w-64">
                  <span className="text-slate-500">Total GST Tax:</span>
                  <span className="font-semibold">₹ {formatPaise(computedTaxTotal)}</span>
                </div>
                {roundOff !== 0n && (
                  <div className="flex justify-between w-64 text-slate-500">
                    <span>Round Off:</span>
                    <span>₹ {formatPaise(roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between w-64 pt-2 border-t font-bold text-sm text-blue-700 dark:text-blue-400">
                  <span>Grand Total:</span>
                  <span>₹ {formatPaise(finalTotal)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Save Draft Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
