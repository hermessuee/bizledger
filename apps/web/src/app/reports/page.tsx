'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import {
  BarChart3,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'tb' | 'pnl' | 'bs' | 'gst'>('tb');
  const [tbData, setTbData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [tb, pnl, bs, gst] = await Promise.all([
        api.get('/api/v1/reports/trial-balance'),
        api.get('/api/v1/reports/profit-loss'),
        api.get('/api/v1/reports/balance-sheet'),
        api.get('/api/v1/reports/gst-summary'),
      ]);
      setTbData(tb);
      setPnlData(pnl);
      setBsData(bs);
      setGstData(gst);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportCsv = (filename: string, rows: string[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTrialBalance = () => {
    if (!tbData) return;
    const rows = [
      ['Account Code', 'Account Name', 'Type', 'Debit (INR)', 'Credit (INR)'],
      ...tbData.rows.map((r: any) => [
        `"${r.code}"`,
        `"${r.name}"`,
        `"${r.type}"`,
        (r.closingDebit / 100).toFixed(2),
        (r.closingCredit / 100).toFixed(2),
      ]),
      ['TOTAL', '', '', (tbData.totalDebit / 100).toFixed(2), (tbData.totalCredit / 100).toFixed(2)],
    ];
    exportCsv('Trial_Balance.csv', rows);
  };

  const handleExportGstSalesRegister = () => {
    if (!gstData?.salesRegister) return;
    const rows = [
      ['Invoice No', 'Date', 'Customer Name', 'GSTIN', 'Place of Supply', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Invoice Value'],
      ...gstData.salesRegister.map((s: any) => [
        `"${s.invoiceNo}"`,
        `"${s.date}"`,
        `"${s.customerName}"`,
        `"${s.customerGstin}"`,
        `"${s.placeOfSupply}"`,
        (s.taxableValue / 100).toFixed(2),
        (s.cgst / 100).toFixed(2),
        (s.sgst / 100).toFixed(2),
        (s.igst / 100).toFixed(2),
        (s.totalInvoiceValue / 100).toFixed(2),
      ]),
    ];
    exportCsv('GSTR1_Sales_Register.csv', rows);
  };

  return (
    <AppShell currentMenu="reports">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Financial & GST Reports
            </h1>
            <p className="text-xs text-slate-500">
              Double-entry Trial Balance, Profit & Loss, Balance Sheet, and Indian GST Tax Returns
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'tb' && (
              <button
                onClick={handleExportTrialBalance}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </button>
            )}
            {activeTab === 'gst' && (
              <button
                onClick={handleExportGstSalesRegister}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export GSTR-1 CSV
              </button>
            )}
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('tb')}
            className={`pb-3 transition flex items-center space-x-2 ${
              activeTab === 'tb'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Trial Balance</span>
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={`pb-3 transition flex items-center space-x-2 ${
              activeTab === 'pnl'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Profit & Loss</span>
          </button>
          <button
            onClick={() => setActiveTab('bs')}
            className={`pb-3 transition flex items-center space-x-2 ${
              activeTab === 'bs'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Balance Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`pb-3 transition flex items-center space-x-2 ${
              activeTab === 'gst'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>GST Summary & Registers</span>
          </button>
        </div>

        {/* Tab 1: Trial Balance */}
        {activeTab === 'tb' && tbData && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Trial Balance
                </h3>
                <p className="text-xs text-slate-500">As on current date</p>
              </div>

              {tbData.isBalanced ? (
                <div className="flex items-center space-x-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Trial Balance Balanced (Debits = Credits)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Trial Balance Out of Balance!</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Account Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Debit Balance (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tbData.rows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono">{row.code}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-500">{row.type}</td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {row.closingDebit > 0 ? formatPaise(row.closingDebit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {row.closingCredit > 0 ? formatPaise(row.closingCredit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 uppercase text-slate-700">
                      Total
                    </td>
                    <td className="py-3 px-3 text-right text-blue-700 dark:text-blue-400">
                      ₹ {formatPaise(tbData.totalDebit)}
                    </td>
                    <td className="py-3 px-3 text-right text-blue-700 dark:text-blue-400">
                      ₹ {formatPaise(tbData.totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Profit & Loss */}
        {activeTab === 'pnl' && pnlData && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Profit & Loss Statement
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase text-emerald-600 border-b pb-1">
                  Income / Revenue
                </h4>
                <div className="divide-y text-xs">
                  {pnlData.incomeRows.map((r: any) => (
                    <div key={r.id} className="py-2 flex justify-between">
                      <span className="text-slate-800 dark:text-slate-200">{r.name}</span>
                      <span className="font-semibold">₹ {formatPaise(r.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-emerald-700">
                    <span>Total Income:</span>
                    <span>₹ {formatPaise(pnlData.totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expense */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase text-red-600 border-b pb-1">
                  Expenses & Purchases
                </h4>
                <div className="divide-y text-xs">
                  {pnlData.expenseRows.map((r: any) => (
                    <div key={r.id} className="py-2 flex justify-between">
                      <span className="text-slate-800 dark:text-slate-200">{r.name}</span>
                      <span className="font-semibold">₹ {formatPaise(r.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-red-700">
                    <span>Total Expense:</span>
                    <span>₹ {formatPaise(pnlData.totalExpense)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Profit Banner */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex justify-between items-center text-sm">
              <span className="font-bold text-blue-900 dark:text-blue-100">
                Net Profit / (Loss) for Period:
              </span>
              <span className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
                ₹ {formatPaise(pnlData.netProfit)}
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Balance Sheet */}
        {activeTab === 'bs' && bsData && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Balance Sheet
              </h3>
              {bsData.isBalanced && (
                <span className="text-xs font-semibold px-3 py-1 bg-green-100 text-green-800 rounded-full">
                  Assets = Liabilities + Equity Balanced
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Assets */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase text-blue-600 border-b pb-1">Assets</h4>
                <div className="divide-y">
                  {bsData.assetRows.map((r: any) => (
                    <div key={r.id} className="py-2 flex justify-between">
                      <span>{r.name}</span>
                      <span className="font-semibold">₹ {formatPaise(r.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-sm text-blue-700">
                    <span>Total Assets:</span>
                    <span>₹ {formatPaise(bsData.totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold uppercase text-purple-600 border-b pb-1">Liabilities</h4>
                  <div className="divide-y">
                    {bsData.liabilityRows.map((r: any) => (
                      <div key={r.id} className="py-2 flex justify-between">
                        <span>{r.name}</span>
                        <span className="font-semibold">₹ {formatPaise(r.amount)}</span>
                      </div>
                    ))}
                    <div className="pt-1 flex justify-between font-bold text-purple-700">
                      <span>Total Liabilities:</span>
                      <span>₹ {formatPaise(bsData.totalLiabilities)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold uppercase text-indigo-600 border-b pb-1">Equity</h4>
                  <div className="divide-y">
                    {bsData.equityRows.map((r: any) => (
                      <div key={r.id} className="py-2 flex justify-between">
                        <span>{r.name}</span>
                        <span className="font-semibold">₹ {formatPaise(r.amount)}</span>
                      </div>
                    ))}
                    <div className="py-2 flex justify-between text-emerald-600">
                      <span>Current Period Profit:</span>
                      <span className="font-semibold">₹ {formatPaise(bsData.currentPeriodProfit)}</span>
                    </div>
                    <div className="pt-1 flex justify-between font-bold text-indigo-700">
                      <span>Total Equity:</span>
                      <span>₹ {formatPaise(bsData.totalEquity)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t font-bold text-sm flex justify-between text-slate-900 dark:text-slate-100">
                  <span>Total Liabilities & Equity:</span>
                  <span>₹ {formatPaise(bsData.totalLiabilities + bsData.totalEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: GST Summary */}
        {activeTab === 'gst' && gstData && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              GST Tax Summary (Output vs Input Tax Credit)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Output GST (Collected on Sales)
                </span>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  ₹ {formatPaise(gstData.output.total)}
                </p>
                <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                  <p>CGST: ₹ {formatPaise(gstData.output.cgst)}</p>
                  <p>SGST: ₹ {formatPaise(gstData.output.sgst)}</p>
                  <p>IGST: ₹ {formatPaise(gstData.output.igst)}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Input Tax Credit (ITC on Purchases)
                </span>
                <p className="text-xl font-bold text-slate-900 mt-2">
                  ₹ {formatPaise(gstData.input.total)}
                </p>
                <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                  <p>CGST: ₹ {formatPaise(gstData.input.cgst)}</p>
                  <p>SGST: ₹ {formatPaise(gstData.input.sgst)}</p>
                  <p>IGST: ₹ {formatPaise(gstData.input.igst)}</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900">
                <span className="text-xs font-semibold text-blue-700 uppercase">
                  Net GST Payable to Govt
                </span>
                <p className="text-2xl font-extrabold text-blue-800 mt-2">
                  ₹ {formatPaise(gstData.netGstPayable)}
                </p>
                <p className="text-[11px] text-blue-600 mt-1">
                  Output Tax minus eligible ITC
                </p>
              </div>
            </div>

            {/* GSTR-1 Sales Register Preview */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs uppercase text-slate-700">
                  GSTR-1 Style Sales Register ({gstData.salesRegister?.length || 0} Invoices)
                </h4>
                <button
                  onClick={handleExportGstSalesRegister}
                  className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Sales Register CSV
                </button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b">
                    <tr>
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">GSTIN</th>
                      <th className="py-2 px-3">POS</th>
                      <th className="py-2 px-3 text-right">Taxable</th>
                      <th className="py-2 px-3 text-right">CGST</th>
                      <th className="py-2 px-3 text-right">SGST</th>
                      <th className="py-2 px-3 text-right">IGST</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstData.salesRegister?.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono">{s.invoiceNo}</td>
                        <td className="py-2 px-3">{s.date}</td>
                        <td className="py-2 px-3 font-medium">{s.customerName}</td>
                        <td className="py-2 px-3 font-mono text-[10px]">{s.customerGstin}</td>
                        <td className="py-2 px-3">{s.placeOfSupply}</td>
                        <td className="py-2 px-3 text-right">₹ {formatPaise(s.taxableValue)}</td>
                        <td className="py-2 px-3 text-right">₹ {formatPaise(s.cgst)}</td>
                        <td className="py-2 px-3 text-right">₹ {formatPaise(s.sgst)}</td>
                        <td className="py-2 px-3 text-right">₹ {formatPaise(s.igst)}</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          ₹ {formatPaise(s.totalInvoiceValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
