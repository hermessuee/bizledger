'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import { downloadDetailedTradingPdf } from '@/lib/pdf';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Search,
  Building2,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  RefreshCw,
} from 'lucide-react';

export default function ReportsPage() {
  const { business, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'detailed' | 'pnl' | 'tb' | 'bs' | 'gst'>('detailed');
  const [tbData, setTbData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Detailed Report State
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultFromStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [detailedFilters, setDetailedFilters] = useState({
    fromDate: defaultFromStr,
    toDate: todayStr,
    type: 'all', // 'all' | 'purchases' | 'sales'
    businessId: business?.id && business.id !== 'all' ? business.id : 'all',
    searchQuery: '',
  });

  const [detailedData, setDetailedData] = useState<any>(null);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [businessesList, setBusinessesList] = useState<any[]>([]);

  // Fetch summary reports
  const fetchSummaryReports = async () => {
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
    } catch (err) {
      console.error('Failed to load summary reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed trading entries
  const fetchDetailedReport = async (override?: Partial<typeof detailedFilters>) => {
    setLoadingDetailed(true);
    try {
      const fFrom = override?.fromDate !== undefined ? override.fromDate : detailedFilters.fromDate;
      const fTo = override?.toDate !== undefined ? override.toDate : detailedFilters.toDate;
      const fType = override?.type !== undefined ? override.type : detailedFilters.type;
      const fBiz = override?.businessId !== undefined ? override.businessId : detailedFilters.businessId;

      const params = new URLSearchParams();
      if (fFrom) params.set('fromDate', fFrom);
      if (fTo) params.set('toDate', fTo);
      if (fType && fType !== 'all') params.set('type', fType);
      if (fBiz && fBiz !== 'all') params.set('businessId', fBiz);

      const res = await api.get(`/api/v1/reports/detailed-trading?${params.toString()}`);
      setDetailedData(res);
      if (res.businesses && Array.isArray(res.businesses)) {
        setBusinessesList(res.businesses);
      }
    } catch (err) {
      console.error('Failed to load detailed report:', err);
    } finally {
      setLoadingDetailed(false);
    }
  };

  useEffect(() => {
    fetchSummaryReports();
    fetchDetailedReport();
  }, []);

  // Update businessId filter when active business in context changes
  useEffect(() => {
    if (business?.id && business.id !== 'all') {
      setDetailedFilters((prev) => ({ ...prev, businessId: business.id }));
      fetchDetailedReport({ businessId: business.id });
    }
  }, [business?.id]);

  // Client-side search filter over detailed entries
  const filteredEntries = useMemo(() => {
    if (!detailedData?.entries) return [];
    let list = detailedData.entries;
    const q = detailedFilters.searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((e: any) => {
      const desc = (e.description || '').toLowerCase();
      const party = (e.partyName || '').toLowerCase();
      const docNo = (e.docNo || '').toLowerCase();
      const hsn = (e.hsnSac || '').toLowerCase();
      return desc.includes(q) || party.includes(q) || docNo.includes(q) || hsn.includes(q);
    });
  }, [detailedData?.entries, detailedFilters.searchQuery]);

  // Dynamic totals for filtered entries
  const computedSummary = useMemo(() => {
    const list = filteredEntries;
    let purchasesDebit = 0;
    let salesCredit = 0;
    let tax = 0;
    let qty = 0;

    for (const e of list) {
      purchasesDebit += e.debit || 0;
      salesCredit += e.credit || 0;
      tax += e.taxAmount || 0;
      qty += e.qty || 0;
    }

    const netProfit = salesCredit - purchasesDebit;

    return {
      totalPurchasesDebit: purchasesDebit,
      totalSalesCredit: salesCredit,
      netProfit,
      totalTax: tax,
      totalQty: qty,
      count: list.length,
    };
  }, [filteredEntries]);

  // Helper to build the exact 16-column dataset requested by user
  const getDetailedReportRows = () => {
    if (!detailedData) return null;
    const dist = detailedData.distributor || business;
    const summary = computedSummary;
    const list = filteredEntries;

    const pad16 = (arr: any[]) => {
      const res = arr.slice();
      while (res.length < 16) res.push('');
      return res.slice(0, 16);
    };

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';

    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    const rows: (string | number)[][] = [
      pad16([distName]),
      pad16([`GSTIN: ${gstin} State: ${state} Address: ${addr}`]),
      pad16(['DETAILED TRADING & PROFIT & LOSS REGISTER (ITEM-WISE DAYBOOK)']),
      pad16([`Period From: ${detailedFilters.fromDate || 'Beginning'} Period To: ${detailedFilters.toDate || 'Present'} Generated: ${genTimeStr} Total Lines: ${list.length}`]),
      pad16([`Total Purchases (Debit): Rs. ${(summary.totalPurchasesDebit / 100).toFixed(2)} Total Sales (Credit): Rs. ${(summary.totalSalesCredit / 100).toFixed(2)} Net Trading Margin: Rs. ${(summary.netProfit / 100).toFixed(2)} Total Qty: ${summary.totalQty} Total Tax: Rs. ${(summary.totalTax / 100).toFixed(2)}`]),
      pad16([
        'Sl No',
        'Date',
        'Voucher / Doc #',
        'Entry Type',
        'Party Name (Customer / Vendor)',
        'Party GSTIN',
        'Item Description',
        'HSN/SAC',
        'Quantity',
        'Unit',
        'Rate (INR)',
        'GST %',
        'Tax Amount (INR)',
        'Debit [Purchases] (INR)',
        'Credit [Sales] (INR)',
        'Net Balance (INR)',
      ]),
      ...list.map((e: any, idx: number) => pad16([
        idx + 1,
        e.docDate,
        e.docNo,
        e.typeLabel,
        e.partyName || '-',
        e.partyGstin || '-',
        e.description || '-',
        e.hsnSac || '-',
        e.qty || 0,
        e.unit || 'KG',
        e.rate ? e.rate / 100 : 0,
        e.gstRate ? `${e.gstRate}%` : '0%',
        e.taxAmount ? e.taxAmount / 100 : 0,
        e.debit ? e.debit / 100 : 0,
        e.credit ? e.credit / 100 : 0,
        e.runningBalance ? e.runningBalance / 100 : 0,
      ])),
      pad16([]),
      pad16([
        'GRAND TOTALS',
        '', '', '', '', '',
        `${list.length} item lines`,
        '',
        summary.totalQty,
        '', '', '',
        summary.totalTax / 100,
        summary.totalPurchasesDebit / 100,
        summary.totalSalesCredit / 100,
        summary.netProfit / 100,
      ]),
    ];

    return { dist, rows };
  };

  // Export Detailed Report to Excel (.xlsx) with exact formatting, fills, cell merges & borders
  const handleExportDetailedExcel = async () => {
    if (!detailedData) return;
    const dist = detailedData.distributor || business;
    const summary = computedSummary;
    const list = filteredEntries;

    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Trading Register', {
      views: [{ showGridLines: true }],
    });

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
    };

    ws.columns = [
      { width: 8 },  // Sl No
      { width: 14 }, // Date
      { width: 24 }, // Voucher / Doc #
      { width: 16 }, // Entry Type
      { width: 28 }, // Party Name
      { width: 18 }, // Party GSTIN
      { width: 30 }, // Item Description
      { width: 12 }, // HSN/SAC
      { width: 14 }, // Quantity
      { width: 10 }, // Unit
      { width: 16 }, // Rate
      { width: 10 }, // GST %
      { width: 16 }, // Tax Amount
      { width: 22 }, // Debit
      { width: 22 }, // Credit
      { width: 22 }, // Net Balance
    ];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';

    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:P1 with Brick Red fill & Bold white text
    ws.mergeCells('A1:P1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 16; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-5: Merged A:P with Slate Blue fill & White text
    const headerInfo = [
      { text: `GSTIN: ${gstin} State: ${state} Address: ${addr}`, bold: false },
      { text: 'DETAILED TRADING & PROFIT & LOSS REGISTER (ITEM-WISE DAYBOOK)', bold: true },
      { text: `Period From: ${detailedFilters.fromDate || 'Beginning'} Period To: ${detailedFilters.toDate || 'Present'} Generated: ${genTimeStr} Total Lines: ${list.length}`, bold: false },
      { text: `Total Purchases (Debit): Rs. ${(summary.totalPurchasesDebit / 100).toFixed(2)} Total Sales (Credit): Rs. ${(summary.totalSalesCredit / 100).toFixed(2)} Net Trading Margin: Rs. ${(summary.netProfit / 100).toFixed(2)} Total Qty: ${summary.totalQty} Total Tax: Rs. ${(summary.totalTax / 100).toFixed(2)}`, bold: false },
    ];

    headerInfo.forEach((item, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:P${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = item.text;
      for (let c = 1; c <= 16; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: item.bold, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    // Row 6: Column Headers
    const headers = [
      'Sl No',
      'Date',
      'Voucher / Doc #',
      'Entry Type',
      'Party Name (Customer / Vendor)',
      'Party GSTIN',
      'Item Description',
      'HSN/SAC',
      'Quantity',
      'Unit',
      'Rate (INR)',
      'GST %',
      'Tax Amount (INR)',
      'Debit [Purchases] (INR)',
      'Credit [Sales] (INR)',
      'Net Balance (INR)',
    ];
    const row6 = ws.getRow(6);
    row6.height = 32;
    headers.forEach((h, idx) => {
      const cell = row6.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });

    // Rows 7+: Data Rows
    list.forEach((e: any, idx: number) => {
      const r = 7 + idx;
      const row = ws.getRow(r);
      row.height = 20;

      const values = [
        idx + 1,
        e.docDate,
        e.docNo,
        e.typeLabel,
        e.partyName || '-',
        e.partyGstin || '-',
        e.description || '-',
        e.hsnSac || '-',
        e.qty || 0,
        e.unit || 'KG',
        e.rate ? e.rate / 100 : 0,
        e.gstRate ? `${e.gstRate}%` : '0%',
        e.taxAmount ? e.taxAmount / 100 : 0,
        e.debit ? e.debit / 100 : 0,
        e.credit ? e.credit / 100 : 0,
        e.runningBalance ? e.runningBalance / 100 : 0,
      ];

      values.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;

        const colNum = cIdx + 1;
        if (colNum === 1 || colNum === 2 || colNum === 8 || colNum === 10 || colNum === 12) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum >= 9 && colNum !== 10 && colNum !== 12) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Blank row after data
    const blankRowNum = 7 + list.length;
    const blankRow = ws.getRow(blankRowNum);
    blankRow.height = 14;
    for (let c = 1; c <= 16; c++) {
      const cell = blankRow.getCell(c);
      cell.border = thinBorder;
    }

    // Grand Totals row
    const totalsRowNum = blankRowNum + 1;
    ws.mergeCells(`A${totalsRowNum}:F${totalsRowNum}`);
    const totalsRow = ws.getRow(totalsRowNum);
    totalsRow.height = 22;
    for (let c = 1; c <= 16; c++) {
      const cell = totalsRow.getCell(c);
      cell.border = thinBorder;
    }

    const cellA = ws.getCell(`A${totalsRowNum}`);
    cellA.value = 'GRAND TOTALS';
    cellA.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellA.alignment = { horizontal: 'center', vertical: 'middle' };

    const cellG = ws.getCell(`G${totalsRowNum}`);
    cellG.value = `${list.length} item lines`;
    cellG.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
    cellG.alignment = { horizontal: 'center', vertical: 'middle' };

    const cellI = ws.getCell(`I${totalsRowNum}`);
    cellI.value = summary.totalQty;
    cellI.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellI.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellM = ws.getCell(`M${totalsRowNum}`);
    cellM.value = summary.totalTax / 100;
    cellM.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    cellM.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellN = ws.getCell(`N${totalsRowNum}`);
    cellN.value = summary.totalPurchasesDebit / 100;
    cellN.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellN.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellO = ws.getCell(`O${totalsRowNum}`);
    cellO.value = summary.totalSalesCredit / 100;
    cellO.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellO.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellP = ws.getCell(`P${totalsRowNum}`);
    cellP.value = summary.netProfit / 100;
    cellP.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellP.alignment = { horizontal: 'right', vertical: 'middle' };

    // Write buffer and trigger browser download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFrom = (detailedFilters.fromDate || 'start').replace(/-/g, '');
    const safeTo = (detailedFilters.toDate || 'end').replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `Detailed_Trading_Report_${safeDist}_${safeFrom}_to_${safeTo}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Detailed Report to CSV with exact 16-column format
  const handleExportDetailedCsv = () => {
    const data = getDetailedReportRows();
    if (!data) return;
    const { dist, rows } = data;

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvContent = '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFrom = (detailedFilters.fromDate || 'start').replace(/-/g, '');
    const safeTo = (detailedFilters.toDate || 'end').replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `Detailed_Trading_Report_${safeDist}_${safeFrom}_to_${safeTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Detailed Report to PDF (Formatted Letterhead with Distributor name on top & date range)
  const handleExportDetailedPdf = () => {
    if (!detailedData) return;
    const dist = detailedData.distributor || business;
    const summary = computedSummary;
    const list = filteredEntries;

    downloadDetailedTradingPdf({
      distributor: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      filters: {
        fromDate: detailedFilters.fromDate,
        toDate: detailedFilters.toDate,
        type: detailedFilters.type,
      },
      summary: {
        totalPurchasesDebit: summary.totalPurchasesDebit,
        totalSalesCredit: summary.totalSalesCredit,
        netProfit: summary.netProfit,
        totalTax: summary.totalTax,
        totalQty: summary.totalQty,
        totalEntries: list.length,
      },
      entries: list,
    });
  };

  // Quick Date Range Presets
  const handleSetDatePreset = (preset: 'today' | 'month' | '30days' | 'fy' | 'all') => {
    let from = '';
    let to = todayStr;

    if (preset === 'today') {
      from = todayStr;
    } else if (preset === 'month') {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (preset === '30days') {
      from = defaultFromStr;
    } else if (preset === 'fy') {
      const now = new Date();
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = `${currentYear}-04-01`;
    } else if (preset === 'all') {
      from = '';
      to = '';
    }

    setDetailedFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
    fetchDetailedReport({ fromDate: from, toDate: to });
  };

  // Existing summary exports
  const exportCsv = (filename: string, rows: string[][]) => {
    const csvContent = '\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      [
        'Invoice No',
        'Date',
        'Customer Name',
        'GSTIN',
        'Place of Supply',
        'Taxable Value',
        'CGST',
        'SGST',
        'IGST',
        'Total Invoice Value',
      ],
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

  const currentDistributor = detailedData?.distributor || business;

  return (
    <AppShell currentMenu="reports">
      <div className="space-y-6">
        {/* Top Header & Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-600" />
              <span>Financial & Trading Reports</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed Item-Wise Daybook Register, Profit & Loss Statement, Trial Balance, and GST Returns
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'detailed' && (
              <>
                <button
                  onClick={handleExportDetailedExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export complete item-by-item entries to Microsoft Excel (.xlsx) with generous column widths"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportDetailedCsv}
                  className="inline-flex items-center px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export exact 16-column format to CSV file"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleExportDetailedPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Download professional PDF with distributor name on top, date range, item details, debit & credit columns"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-900 text-slate-200 rounded-lg text-xs font-medium shadow-xs transition"
                  title="Print / Save as PDF from browser"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  <span>Print View</span>
                </button>
              </>
            )}

            {activeTab === 'tb' && (
              <button
                onClick={handleExportTrialBalance}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </button>
            )}

            {activeTab === 'gst' && (
              <button
                onClick={handleExportGstSalesRegister}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export GSTR-1 CSV
              </button>
            )}
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-semibold overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('detailed')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'detailed'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Detailed Trading & Entries (Item-Wise P&L)</span>
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'pnl'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Profit & Loss Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('tb')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'tb'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Trial Balance</span>
          </button>
          <button
            onClick={() => setActiveTab('bs')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'bs'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Balance Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'gst'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>GST Summary & Registers</span>
          </button>
        </div>

        {/* TAB 1: DETAILED TRADING & ENTRY REGISTER (NEW FEATURE) */}
        {activeTab === 'detailed' && (
          <div className="space-y-5">
            {/* Distributor Letterhead Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 shadow-sm border border-slate-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                      Distributor Ledger View
                    </span>
                    <span className="text-xs text-slate-300">
                      Kerala (State 32)
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1 text-white tracking-tight">
                    {currentDistributor?.name || business?.name || 'Distributor Firm'}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    GSTIN:{' '}
                    {currentDistributor?.gstin?.trim() || business?.gstin?.trim() ? (
                      <span className="font-mono font-bold text-amber-300">
                        {currentDistributor?.gstin?.trim() || business?.gstin?.trim()}
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400 italic">Not Configured</span>
                    )}
                    {' '}&bull;{' '}
                    <span>{currentDistributor?.address || business?.address || 'Kerala'}</span>
                  </p>
                </div>

                <div className="text-left md:text-right bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-xs">
                  <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Report Period Range
                  </p>
                  <p className="text-sm font-bold text-amber-300 font-mono mt-0.5">
                    {detailedFilters.fromDate ? detailedFilters.fromDate : 'Beginning'} &rarr; {detailedFilters.toDate ? detailedFilters.toDate : 'Today'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {filteredEntries.length} items purchased & billed
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Control Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Distributor Picker for Super Admin */}
                {isSuperAdmin && businessesList.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Distributor Scope
                    </label>
                    <select
                      value={detailedFilters.businessId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDetailedFilters((prev) => ({ ...prev, businessId: val }));
                        fetchDetailedReport({ businessId: val });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">🌐 All Distributors (Consolidated)</option>
                      {businessesList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* From Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>From Date</span>
                  </label>
                  <input
                    type="date"
                    value={detailedFilters.fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailedFilters((prev) => ({ ...prev, fromDate: val }));
                      fetchDetailedReport({ fromDate: val });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>To Date</span>
                  </label>
                  <input
                    type="date"
                    value={detailedFilters.toDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailedFilters((prev) => ({ ...prev, toDate: val }));
                      fetchDetailedReport({ toDate: val });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Entry Type Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span>Entry Type</span>
                  </label>
                  <select
                    value={detailedFilters.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailedFilters((prev) => ({ ...prev, type: val }));
                      fetchDetailedReport({ type: val });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Entries (Purchases & Sales)</option>
                    <option value="purchases">Purchases Only (Debit)</option>
                    <option value="sales">Sales Invoiced Only (Credit)</option>
                  </select>
                </div>

                {/* Search query */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <span>Search Item / Party / Doc #</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mankda, Padi, INV-..."
                    value={detailedFilters.searchQuery}
                    onChange={(e) => setDetailedFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Quick Ranges:</span>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('today')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium transition"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('month')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium transition"
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('30days')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium transition"
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('fy')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium transition"
                  >
                    Current FY
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('all')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium transition"
                  >
                    All Time
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => fetchDetailedReport()}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingDetailed ? 'animate-spin' : ''}`} />
                  <span>Refresh Entries</span>
                </button>
              </div>
            </div>

            {/* KPI Cards: Purchases (Debit), Sales (Credit), Net Margin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Purchases (Debit) */}
              <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Total Purchases (Debit)
                  </span>
                  <div className="p-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-2 font-mono">
                  ₹ {formatPaise(computedSummary.totalPurchasesDebit)}
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  Total cost of purchased item goods & services
                </p>
              </div>

              {/* 2. Sales (Credit) */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Total Billed Sales (Credit)
                  </span>
                  <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-2 font-mono">
                  ₹ {formatPaise(computedSummary.totalSalesCredit)}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Total revenue invoiced and billed to customers
                </p>
              </div>

              {/* 3. Net Trading Profit / Margin */}
              <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Net Trading Profit / Margin
                  </span>
                  <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p
                  className={`text-2xl font-black mt-2 font-mono ${
                    computedSummary.netProfit >= 0
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  ₹ {formatPaise(Math.abs(computedSummary.netProfit))}
                  {computedSummary.netProfit < 0 && (
                    <span className="text-xs font-bold text-red-600 ml-1">(Deficit)</span>
                  )}
                </p>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-1">
                  Credit (Sales) minus Debit (Purchases)
                </p>
              </div>

              {/* 4. Tax & Item Volume */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Quantity & Tax Total
                  </span>
                  <div className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
                  {computedSummary.totalQty.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-semibold text-slate-500">Units / KG</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Tax (GST): <strong className="text-slate-700 dark:text-slate-300">₹ {formatPaise(computedSummary.totalTax)}</strong> &bull; {filteredEntries.length} lines
                </p>
              </div>
            </div>

            {/* The Detailed Items Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/20">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Detailed Item-by-Item Entry Ledger</span>
                    <span className="text-xs font-normal text-slate-500">
                      ({filteredEntries.length} entries shown)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    All items purchased and billed with Debit (Purchases) and Credit (Sales) allocation
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Debit = Purchases</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Credit = Billed Sales</span>
                  </div>
                </div>
              </div>

              {loadingDetailed ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <span>Loading detailed entries...</span>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    No entries found for the selected date range and filter
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try expanding the date range or select &quot;All Time&quot; above.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[62vh]">
                  <table className="w-full text-left text-xs min-w-[1240px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-2 text-center w-10">#</th>
                        <th className="py-2.5 px-2.5 w-24">Date</th>
                        <th className="py-2.5 px-2.5 w-28">Voucher / Doc #</th>
                        <th className="py-2.5 px-2 w-24 text-center">Type</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Party (Customer / Vendor)</th>
                        <th className="py-2.5 px-3 min-w-[190px]">Item / Description</th>
                        <th className="py-2.5 px-2 text-center w-16">HSN</th>
                        <th className="py-2.5 px-2 text-center w-24">Qty & Unit</th>
                        <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                        <th className="py-2.5 px-2 text-right w-20">Tax (₹)</th>
                        <th className="py-2.5 px-2.5 text-right w-28 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-bold">
                          Debit [Purchases] (₹)
                        </th>
                        <th className="py-2.5 px-2.5 text-right w-28 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-bold">
                          Credit [Sales] (₹)
                        </th>
                        <th className="py-2.5 px-2.5 text-right w-28 font-bold">
                          Net Balance (₹)
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredEntries.map((e: any, idx: number) => {
                        const isPurchase = e.docType === 'purchase_bill';
                        return (
                          <tr
                            key={e.id || idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                          >
                            {/* # */}
                            <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Date */}
                            <td className="py-2 px-2.5 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                              {e.docDate}
                            </td>

                            {/* Doc # */}
                            <td className="py-2 px-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {e.docNo}
                            </td>

                            {/* Type Badge */}
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              {isPurchase ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  Purchase
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  Sale
                                </span>
                              )}
                            </td>

                            {/* Party */}
                            <td className="py-2 px-3">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={e.partyName}>
                                {e.partyName}
                              </p>
                              {e.partyGstin && e.partyGstin !== '-' && (
                                <p className="text-[10px] font-mono text-slate-400">
                                  {e.partyGstin}
                                </p>
                              )}
                            </td>

                            {/* Item / Description */}
                            <td className="py-2 px-3">
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                {e.description}
                              </p>
                            </td>

                            {/* HSN */}
                            <td className="py-2 px-2 text-center font-mono text-slate-500">
                              {e.hsnSac || '-'}
                            </td>

                            {/* Qty & Unit */}
                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                              {e.qty} <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{e.unit}</span>
                            </td>

                            {/* Rate */}
                            <td className="py-2 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                              ₹ {formatPaise(e.rate)}
                            </td>

                            {/* Tax */}
                            <td className="py-2 px-2 text-right font-mono text-slate-500 text-[11px]">
                              ₹ {formatPaise(e.taxAmount)}
                            </td>

                            {/* Debit [Purchases] */}
                            <td className="py-2 px-2.5 text-right font-mono font-bold bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 whitespace-nowrap">
                              {e.debit > 0 ? `₹ ${formatPaise(e.debit)}` : '-'}
                            </td>

                            {/* Credit [Sales] */}
                            <td className="py-2 px-2.5 text-right font-mono font-bold bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                              {e.credit > 0 ? `₹ ${formatPaise(e.credit)}` : '-'}
                            </td>

                            {/* Running Balance */}
                            <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              ₹ {formatPaise(e.runningBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Table Footer with Grand Totals */}
                    <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-100/90 dark:bg-slate-800 text-xs">
                      <tr>
                        <td colSpan={6} className="py-3 px-3 uppercase text-slate-700 dark:text-slate-300 tracking-wider font-extrabold">
                          GRAND TOTALS ({filteredEntries.length} ENTRIES)
                        </td>
                        <td className="py-3 px-2 text-center font-mono">-</td>
                        <td className="py-3 px-2 text-center font-mono text-blue-700 dark:text-blue-400">
                          {computedSummary.totalQty.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">-</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-300">
                          ₹ {formatPaise(computedSummary.totalTax)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 text-sm">
                          ₹ {formatPaise(computedSummary.totalPurchasesDebit)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/40 text-sm">
                          ₹ {formatPaise(computedSummary.totalSalesCredit)}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono text-blue-800 dark:text-blue-300 text-sm font-black">
                          ₹ {formatPaise(computedSummary.netProfit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Profit & Loss (Summary) */}
        {activeTab === 'pnl' && pnlData && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Profit & Loss Statement (Financial Summary)
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

        {/* Tab 3: Trial Balance */}
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

        {/* Tab 4: Balance Sheet */}
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

        {/* Tab 5: GST Summary */}
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
