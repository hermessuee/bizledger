'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatPaise } from '@bizledger/shared';
import {
  downloadDetailedTradingPdf,
  downloadPnlPdf,
  downloadTrialBalancePdf,
  downloadBalanceSheetPdf,
  downloadGstReportPdf,
  downloadPsrPdf,
} from '@/lib/pdf';
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
  Search,
  Building2,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  RefreshCw,
  Package,
  ShoppingBag,
  Tag,
  Percent,
} from 'lucide-react';

export default function ReportsPage() {
  const { business, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'detailed' | 'psr' | 'pnl' | 'tb' | 'bs' | 'gst'>('detailed');
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

  // Product Sale Report (PSR) State
  const [psrData, setPsrData] = useState<any>(null);
  const [loadingPsr, setLoadingPsr] = useState(false);
  const [psrSearchQuery, setPsrSearchQuery] = useState('');

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

  // Fetch Product Sale Report (PSR)
  const fetchPsrReport = async (override?: { fromDate?: string; toDate?: string; businessId?: string }) => {
    setLoadingPsr(true);
    try {
      const fFrom = override?.fromDate !== undefined ? override.fromDate : detailedFilters.fromDate;
      const fTo = override?.toDate !== undefined ? override.toDate : detailedFilters.toDate;
      const fBiz = override?.businessId !== undefined ? override.businessId : detailedFilters.businessId;

      const params = new URLSearchParams();
      if (fFrom) params.set('fromDate', fFrom);
      if (fTo) params.set('toDate', fTo);
      if (fBiz && fBiz !== 'all') params.set('businessId', fBiz);

      const res = await api.get(`/api/v1/reports/psr?${params.toString()}`);
      setPsrData(res);
    } catch (err) {
      console.error('Failed to load PSR report:', err);
    } finally {
      setLoadingPsr(false);
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
    fetchPsrReport();
  }, []);

  // Update businessId filter when active business in context changes
  useEffect(() => {
    if (business?.id && business.id !== 'all') {
      setDetailedFilters((prev) => ({ ...prev, businessId: business.id }));
      fetchDetailedReport({ businessId: business.id });
      fetchPsrReport({ businessId: business.id });
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

  // Client-side search and filtering for PSR Items
  const filteredPsrItems = useMemo(() => {
    if (!psrData?.items) return [];
    const q = psrSearchQuery.trim().toLowerCase();
    if (!q) return psrData.items;

    return psrData.items.filter((item: any) => {
      const name = (item.name || '').toLowerCase();
      const hsn = (item.hsnSac || '').toLowerCase();
      return name.includes(q) || hsn.includes(q);
    });
  }, [psrData?.items, psrSearchQuery]);

  // Computed Totals for PSR
  const computedPsrSummary = useMemo(() => {
    const items = filteredPsrItems;
    let totalQty = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalSales = 0;

    for (const item of items) {
      totalQty += item.totalQty || 0;
      totalTaxable += item.taxableValue || 0;
      totalTax += item.taxAmount || 0;
      totalSales += item.totalSales || 0;
    }

    return {
      distinctProducts: items.length,
      totalQty,
      totalTaxable,
      totalTax,
      totalSales,
    };
  }, [filteredPsrItems]);

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
    fetchPsrReport({ fromDate: from, toDate: to });
  };

  // --- PRODUCT SALE REPORT (PSR) EXPORTS (PDF & EXCEL) ---
  const handleExportPsrPdf = () => {
    if (!psrData) return;
    const dist = psrData.distributor || business;
    const items = filteredPsrItems;
    const summary = computedPsrSummary;

    downloadPsrPdf({
      business: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      filters: {
        fromDate: detailedFilters.fromDate,
        toDate: detailedFilters.toDate,
      },
      summary: {
        distinctProducts: items.length,
        totalQty: summary.totalQty,
        totalTaxable: summary.totalTaxable,
        totalTax: summary.totalTax,
        totalSales: summary.totalSales,
        totalInvoices: psrData.summary?.totalInvoices || 0,
      },
      items: items.map((i: any, idx: number) => ({
        slNo: idx + 1,
        name: i.name,
        hsnSac: i.hsnSac || '-',
        unit: i.unit || 'PCS',
        totalQty: i.totalQty || 0,
        avgRate: i.avgRate || 0,
        taxableValue: i.taxableValue || 0,
        taxAmount: i.taxAmount || 0,
        totalSales: i.totalSales || 0,
        percentContribution: summary.totalSales > 0 ? ((i.totalSales / summary.totalSales) * 100).toFixed(1) : '0.0',
      })),
    });
  };

  const handleExportPsrExcel = async () => {
    if (!psrData) return;
    const dist = psrData.distributor || business;
    const items = filteredPsrItems;
    const summary = computedPsrSummary;

    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Product Sale Report (PSR)', {
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
      { width: 36 }, // Product Description
      { width: 14 }, // HSN/SAC
      { width: 10 }, // Unit
      { width: 16 }, // Quantity Sold
      { width: 18 }, // Avg Rate (INR)
      { width: 22 }, // Taxable Value (INR)
      { width: 18 }, // GST Tax (INR)
      { width: 24 }, // Total Sales Value (INR)
      { width: 16 }, // Share %
    ];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';

    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:J1 with Brick Red fill & Bold white text
    ws.mergeCells('A1:J1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 10; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-4: Merged A:J Slate Blue
    const subRows = [
      `GSTIN: ${gstin} | State: ${state} | Address: ${addr}`,
      'PRODUCT SALE REPORT (PSR) - SALES AGGREGATION REGISTER',
      `Period: ${detailedFilters.fromDate || 'Beginning'} to ${detailedFilters.toDate || 'Present'} | Generated: ${genTimeStr} | Products: ${items.length} | Gross Revenue: Rs. ${(summary.totalSales / 100).toFixed(2)}`,
    ];
    subRows.forEach((txt, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:J${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = txt;
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: idx === 1, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    // Row 6: Column Headers
    const headers = [
      'Sl No',
      'Product / Item Description',
      'HSN/SAC',
      'Unit',
      'Quantity Sold',
      'Average Rate (INR)',
      'Taxable Value (INR)',
      'GST Tax (INR)',
      'Total Sales Value (INR)',
      'Contribution %',
    ];
    const row6 = ws.getRow(6);
    row6.height = 28;
    headers.forEach((h, idx) => {
      const cell = row6.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: idx >= 4 ? 'right' : idx === 1 ? 'left' : 'center', vertical: 'middle' };
    });

    // Data rows
    items.forEach((item: any, idx: number) => {
      const rowNum = 7 + idx;
      const row = ws.getRow(rowNum);
      row.height = 20;

      const pct = summary.totalSales > 0 ? ((item.totalSales / summary.totalSales) * 100).toFixed(1) : '0.0';

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = item.name;
      row.getCell(3).value = item.hsnSac || '-';
      row.getCell(4).value = item.unit || 'PCS';
      row.getCell(5).value = item.totalQty || 0;
      row.getCell(6).value = item.avgRate ? item.avgRate / 100 : 0;
      row.getCell(7).value = item.taxableValue ? item.taxableValue / 100 : 0;
      row.getCell(8).value = item.taxAmount ? item.taxAmount / 100 : 0;
      row.getCell(9).value = item.totalSales ? item.totalSales / 100 : 0;
      row.getCell(10).value = `${pct}%`;

      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c >= 5 ? 'right' : c === 2 ? 'left' : 'center', vertical: 'middle' };
      }
    });

    // Blank row
    const blankRowNum = 7 + items.length;
    const blankRow = ws.getRow(blankRowNum);
    blankRow.height = 14;
    for (let c = 1; c <= 10; c++) {
      blankRow.getCell(c).border = thinBorder;
    }

    // Grand Totals row
    const totRowNum = blankRowNum + 1;
    ws.mergeCells(`A${totRowNum}:D${totRowNum}`);
    const totRow = ws.getRow(totRowNum);
    totRow.height = 24;
    for (let c = 1; c <= 10; c++) {
      const cell = totRow.getCell(c);
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }

    const cellTot = ws.getCell(`A${totRowNum}`);
    cellTot.value = `GRAND TOTALS (${items.length} PRODUCTS)`;
    cellTot.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellTot.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`E${totRowNum}`).value = summary.totalQty;
    ws.getCell(`E${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`E${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`F${totRowNum}`).value = '-';
    ws.getCell(`F${totRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`G${totRowNum}`).value = summary.totalTaxable / 100;
    ws.getCell(`G${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`G${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`H${totRowNum}`).value = summary.totalTax / 100;
    ws.getCell(`H${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`H${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`I${totRowNum}`).value = summary.totalSales / 100;
    ws.getCell(`I${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
    ws.getCell(`I${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`J${totRowNum}`).value = '100.0%';
    ws.getCell(`J${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`J${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFrom = (detailedFilters.fromDate || 'start').replace(/-/g, '');
    const safeTo = (detailedFilters.toDate || 'end').replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `Product_Sale_Report_PSR_${safeDist}_${safeFrom}_to_${safeTo}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // --- P&L EXPORTS (PDF & EXCEL) ---
  const handleExportPnlPdf = () => {
    if (!pnlData) return;
    const dist = detailedData?.distributor || business;
    downloadPnlPdf({
      business: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      pnl: pnlData,
    });
  };

  const handleExportPnlExcel = async () => {
    if (!pnlData) return;
    const dist = detailedData?.distributor || business;
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Profit & Loss', { views: [{ showGridLines: true }] });

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
    };

    ws.columns = [{ width: 45 }, { width: 25 }];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';
    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:B1 Red
    ws.mergeCells('A1:B1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 2; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-4: Merged A:B Slate Blue
    const subRows = [
      `GSTIN: ${gstin} | State: ${state} | Address: ${addr}`,
      'PROFIT & LOSS STATEMENT (FINANCIAL SUMMARY)',
      `Generated: ${genTimeStr} | Net Trading Profit: Rs. ${formatPaise(pnlData.netProfit)}`,
    ];
    subRows.forEach((txt, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:B${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = txt;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: idx === 1, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    let currRow = 6;
    // Section 1: Income
    const rIncHead = ws.getRow(currRow);
    rIncHead.height = 24;
    rIncHead.getCell(1).value = 'INCOME / REVENUE ACCOUNTS';
    rIncHead.getCell(2).value = 'AMOUNT (INR)';
    for (let c = 1; c <= 2; c++) {
      const cell = rIncHead.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    pnlData.incomeRows.forEach((r: any) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.amount / 100;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
      }
      currRow++;
    });

    // Total Income Row
    const rTotInc = ws.getRow(currRow);
    rTotInc.height = 22;
    rTotInc.getCell(1).value = 'TOTAL INCOME / REVENUE';
    rTotInc.getCell(2).value = pnlData.totalIncome / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotInc.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow += 2;

    // Section 2: Expense
    const rExpHead = ws.getRow(currRow);
    rExpHead.height = 24;
    rExpHead.getCell(1).value = 'EXPENSES & PURCHASES ACCOUNTS';
    rExpHead.getCell(2).value = 'AMOUNT (INR)';
    for (let c = 1; c <= 2; c++) {
      const cell = rExpHead.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    pnlData.expenseRows.forEach((r: any) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.amount / 100;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
      }
      currRow++;
    });

    // Total Expense Row
    const rTotExp = ws.getRow(currRow);
    rTotExp.height = 22;
    rTotExp.getCell(1).value = 'TOTAL EXPENSES & PURCHASES';
    rTotExp.getCell(2).value = pnlData.totalExpense / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotExp.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow += 2;

    // Grand Net Profit Row
    const rNet = ws.getRow(currRow);
    rNet.height = 24;
    rNet.getCell(1).value = 'NET PROFIT / (LOSS) FOR PERIOD';
    rNet.getCell(2).value = pnlData.netProfit / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rNet.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Profit_and_Loss_Report_${safeDist}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- TRIAL BALANCE EXPORTS (PDF & EXCEL) ---
  const handleExportTbPdf = () => {
    if (!tbData) return;
    const dist = detailedData?.distributor || business;
    downloadTrialBalancePdf({
      business: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      tb: tbData,
    });
  };

  const handleExportTbExcel = async () => {
    if (!tbData) return;
    const dist = detailedData?.distributor || business;
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Trial Balance', { views: [{ showGridLines: true }] });

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
    };

    ws.columns = [
      { width: 14 }, // Code
      { width: 36 }, // Account Name
      { width: 18 }, // Type
      { width: 22 }, // Debit Balance
      { width: 22 }, // Credit Balance
    ];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';
    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:E1 Red
    ws.mergeCells('A1:E1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 5; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-4: Merged A:E Slate Blue
    const subRows = [
      `GSTIN: ${gstin} | State: ${state} | Address: ${addr}`,
      'TRIAL BALANCE REGISTER (CLOSING BALANCES)',
      `Generated: ${genTimeStr} | Status: ${tbData.isBalanced ? 'Balanced (Debits = Credits)' : 'Out of Balance'}`,
    ];
    subRows.forEach((txt, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:E${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = txt;
      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: idx === 1, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    // Row 5: Column Headers
    const headers = ['Account Code', 'Account Name', 'Type', 'Debit Balance (INR)', 'Credit Balance (INR)'];
    const row5 = ws.getRow(5);
    row5.height = 28;
    headers.forEach((h, idx) => {
      const cell = row5.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: idx >= 3 ? 'right' : idx === 1 ? 'left' : 'center', vertical: 'middle' };
    });

    // Data rows
    tbData.rows.forEach((r: any, idx: number) => {
      const rowNum = 6 + idx;
      const row = ws.getRow(rowNum);
      row.height = 20;
      row.getCell(1).value = r.code;
      row.getCell(2).value = r.name;
      row.getCell(3).value = r.type.toUpperCase();
      row.getCell(4).value = r.closingDebit ? r.closingDebit / 100 : 0;
      row.getCell(5).value = r.closingCredit ? r.closingCredit / 100 : 0;

      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c >= 4 ? 'right' : c === 2 ? 'left' : 'center', vertical: 'middle' };
      }
    });

    // Totals Row
    const totRowNum = 6 + tbData.rows.length + 1;
    ws.mergeCells(`A${totRowNum}:C${totRowNum}`);
    const totRow = ws.getRow(totRowNum);
    totRow.height = 24;
    for (let c = 1; c <= 5; c++) {
      const cell = totRow.getCell(c);
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
    const cellTot = ws.getCell(`A${totRowNum}`);
    cellTot.value = 'TOTAL';
    cellTot.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellTot.alignment = { horizontal: 'center', vertical: 'middle' };

    const cellDeb = ws.getCell(`D${totRowNum}`);
    cellDeb.value = tbData.totalDebit / 100;
    cellDeb.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB45309' } };
    cellDeb.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellCred = ws.getCell(`E${totRowNum}`);
    cellCred.value = tbData.totalCredit / 100;
    cellCred.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
    cellCred.alignment = { horizontal: 'right', vertical: 'middle' };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trial_Balance_${safeDist}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- BALANCE SHEET EXPORTS (PDF & EXCEL) ---
  const handleExportBsPdf = () => {
    if (!bsData) return;
    const dist = detailedData?.distributor || business;
    downloadBalanceSheetPdf({
      business: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      bs: bsData,
    });
  };

  const handleExportBsExcel = async () => {
    if (!bsData) return;
    const dist = detailedData?.distributor || business;
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Balance Sheet', { views: [{ showGridLines: true }] });

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
    };

    ws.columns = [{ width: 45 }, { width: 25 }];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';
    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:B1 Red
    ws.mergeCells('A1:B1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 2; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-4: Merged A:B Slate Blue
    const subRows = [
      `GSTIN: ${gstin} | State: ${state} | Address: ${addr}`,
      'BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)',
      `Generated: ${genTimeStr} | Status: ${bsData.isBalanced ? 'Balanced (Assets = Liabilities + Equity)' : 'Unbalanced'}`,
    ];
    subRows.forEach((txt, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:B${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = txt;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: idx === 1, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    let currRow = 6;
    // Section 1: Assets
    const rAssetHead = ws.getRow(currRow);
    rAssetHead.height = 24;
    rAssetHead.getCell(1).value = 'ASSETS';
    rAssetHead.getCell(2).value = 'AMOUNT (INR)';
    for (let c = 1; c <= 2; c++) {
      const cell = rAssetHead.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    bsData.assetRows.forEach((r: any) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.amount / 100;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
      }
      currRow++;
    });

    // Total Assets Row
    const rTotAsset = ws.getRow(currRow);
    rTotAsset.height = 22;
    rTotAsset.getCell(1).value = 'TOTAL ASSETS';
    rTotAsset.getCell(2).value = bsData.totalAssets / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotAsset.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow += 2;

    // Section 2: Liabilities
    const rLiabHead = ws.getRow(currRow);
    rLiabHead.height = 24;
    rLiabHead.getCell(1).value = 'LIABILITIES';
    rLiabHead.getCell(2).value = 'AMOUNT (INR)';
    for (let c = 1; c <= 2; c++) {
      const cell = rLiabHead.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF6B21A8' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    bsData.liabilityRows.forEach((r: any) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.amount / 100;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
      }
      currRow++;
    });

    // Total Liabilities Row
    const rTotLiab = ws.getRow(currRow);
    rTotLiab.height = 22;
    rTotLiab.getCell(1).value = 'TOTAL LIABILITIES';
    rTotLiab.getCell(2).value = bsData.totalLiabilities / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotLiab.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF7E22CE' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow += 2;

    // Section 3: Equity
    const rEqHead = ws.getRow(currRow);
    rEqHead.height = 24;
    rEqHead.getCell(1).value = 'EQUITY';
    rEqHead.getCell(2).value = 'AMOUNT (INR)';
    for (let c = 1; c <= 2; c++) {
      const cell = rEqHead.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF3730A3' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    bsData.equityRows.forEach((r: any) => {
      const row = ws.getRow(currRow);
      row.height = 20;
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.amount / 100;
      for (let c = 1; c <= 2; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
      }
      currRow++;
    });

    // Current Period Profit row
    const rProf = ws.getRow(currRow);
    rProf.height = 20;
    rProf.getCell(1).value = 'Current Period Profit / (Loss)';
    rProf.getCell(2).value = bsData.currentPeriodProfit / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rProf.getCell(c);
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow++;

    // Total Equity Row
    const rTotEq = ws.getRow(currRow);
    rTotEq.height = 22;
    rTotEq.getCell(1).value = 'TOTAL EQUITY';
    rTotEq.getCell(2).value = bsData.totalEquity / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotEq.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4338CA' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    currRow += 2;

    // Grand Liabilities & Equity Row
    const rTotLiabEq = ws.getRow(currRow);
    rTotLiabEq.height = 24;
    rTotLiabEq.getCell(1).value = 'TOTAL LIABILITIES & EQUITY';
    rTotLiabEq.getCell(2).value = (bsData.totalLiabilities + bsData.totalEquity) / 100;
    for (let c = 1; c <= 2; c++) {
      const cell = rTotLiabEq.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF6B21A8' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Balance_Sheet_${safeDist}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- GST EXPORTS (PDF & EXCEL) ---
  const handleExportGstPdf = () => {
    if (!gstData) return;
    const dist = detailedData?.distributor || business;
    downloadGstReportPdf({
      business: {
        name: dist?.name || business?.name || 'Distributor Firm',
        gstin: dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered',
        address: dist?.address || business?.address || 'Kerala',
        stateCode: dist?.stateCode || business?.stateCode || '32',
      },
      gst: gstData,
    });
  };

  const handleExportGstExcel = async () => {
    if (!gstData) return;
    const dist = detailedData?.distributor || business;
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('GST Returns', { views: [{ showGridLines: true }] });

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
      right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
    };

    ws.columns = [
      { width: 8 },  // Sl No
      { width: 18 }, // Invoice #
      { width: 14 }, // Date
      { width: 26 }, // Customer Name
      { width: 18 }, // GSTIN
      { width: 10 }, // POS
      { width: 16 }, // Taxable
      { width: 14 }, // CGST
      { width: 14 }, // SGST
      { width: 14 }, // IGST
      { width: 18 }, // Total Value
    ];

    const distName = (dist?.name || business?.name || 'DISTRIBUTOR FIRM').toUpperCase();
    const gstin = dist?.gstin?.trim() || business?.gstin?.trim() || 'Unregistered';
    const state = `${dist?.stateCode || business?.stateCode || '32'} - Kerala`;
    const addr = dist?.address || business?.address || 'Kerala';
    const now = new Date();
    const genTimeStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}`;

    // Row 1: Merged A1:K1 Red
    ws.mergeCells('A1:K1');
    const row1 = ws.getRow(1);
    row1.height = 26;
    ws.getCell('A1').value = distName;
    for (let c = 1; c <= 11; c++) {
      const cell = row1.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB83B2F' } };
      cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }

    // Rows 2-4: Merged A:K Slate Blue
    const subRows = [
      `GSTIN: ${gstin} | State: ${state} | Address: ${addr}`,
      'GST TAX SUMMARY & GSTR-1 SALES REGISTER',
      `Generated: ${genTimeStr} | Output Tax: Rs. ${formatPaise(gstData.output.total)} | ITC: Rs. ${formatPaise(gstData.input.total)} | Net GST Payable: Rs. ${formatPaise(gstData.netGstPayable)}`,
    ];
    subRows.forEach((txt, idx) => {
      const r = idx + 2;
      ws.mergeCells(`A${r}:K${r}`);
      const row = ws.getRow(r);
      row.height = 20;
      ws.getCell(`A${r}`).value = txt;
      for (let c = 1; c <= 11; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6E9F' } };
        cell.font = { name: 'Calibri', size: 10, bold: idx === 1, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      }
    });

    // Row 6: Column Headers for Sales Register
    const headers = [
      'Sl No',
      'Invoice No',
      'Date',
      'Customer Name',
      'Customer GSTIN',
      'Place of Supply',
      'Taxable Value (INR)',
      'CGST (INR)',
      'SGST (INR)',
      'IGST (INR)',
      'Total Value (INR)',
    ];
    const row6 = ws.getRow(6);
    row6.height = 28;
    headers.forEach((h, idx) => {
      const cell = row6.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: idx >= 6 ? 'right' : idx === 3 ? 'left' : 'center', vertical: 'middle' };
    });

    const sales = gstData.salesRegister || [];
    let totTaxable = 0, totCgst = 0, totSgst = 0, totIgst = 0, totInv = 0;

    sales.forEach((s: any, idx: number) => {
      const rowNum = 7 + idx;
      const row = ws.getRow(rowNum);
      row.height = 20;

      totTaxable += s.taxableValue || 0;
      totCgst += s.cgst || 0;
      totSgst += s.sgst || 0;
      totIgst += s.igst || 0;
      totInv += s.totalInvoiceValue || 0;

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = s.invoiceNo;
      row.getCell(3).value = s.date;
      row.getCell(4).value = s.customerName;
      row.getCell(5).value = s.customerGstin || 'Unregistered';
      row.getCell(6).value = s.placeOfSupply;
      row.getCell(7).value = s.taxableValue ? s.taxableValue / 100 : 0;
      row.getCell(8).value = s.cgst ? s.cgst / 100 : 0;
      row.getCell(9).value = s.sgst ? s.sgst / 100 : 0;
      row.getCell(10).value = s.igst ? s.igst / 100 : 0;
      row.getCell(11).value = s.totalInvoiceValue ? s.totalInvoiceValue / 100 : 0;

      for (let c = 1; c <= 11; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: c >= 7 ? 'right' : c === 4 ? 'left' : 'center', vertical: 'middle' };
      }
    });

    // Blank row
    const blankRowNum = 7 + sales.length;
    const blankRow = ws.getRow(blankRowNum);
    blankRow.height = 14;
    for (let c = 1; c <= 11; c++) {
      blankRow.getCell(c).border = thinBorder;
    }

    // Totals Row
    const totRowNum = blankRowNum + 1;
    ws.mergeCells(`A${totRowNum}:F${totRowNum}`);
    const totRow = ws.getRow(totRowNum);
    totRow.height = 24;
    for (let c = 1; c <= 11; c++) {
      const cell = totRow.getCell(c);
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }

    const cellTot = ws.getCell(`A${totRowNum}`);
    cellTot.value = `GRAND TOTALS (${sales.length} INVOICES)`;
    cellTot.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cellTot.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`G${totRowNum}`).value = totTaxable / 100;
    ws.getCell(`G${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`G${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`H${totRowNum}`).value = totCgst / 100;
    ws.getCell(`H${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`H${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`I${totRowNum}`).value = totSgst / 100;
    ws.getCell(`I${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`I${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`J${totRowNum}`).value = totIgst / 100;
    ws.getCell(`J${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true };
    ws.getCell(`J${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ws.getCell(`K${totRowNum}`).value = totInv / 100;
    ws.getCell(`K${totRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
    ws.getCell(`K${totRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDist = (dist?.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `GST_Register_${safeDist}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              </>
            )}

            {activeTab === 'psr' && (
              <>
                <button
                  onClick={handleExportPsrExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Product Sale Report (PSR) to Microsoft Excel (.xlsx) with professional red/blue formatting"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportPsrPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Product Sale Report (PSR) to corporate PDF report"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>
              </>
            )}

            {activeTab === 'pnl' && (
              <>
                <button
                  onClick={handleExportPnlExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Profit & Loss Statement to Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportPnlPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Profit & Loss Statement to beautifully formatted PDF"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>
              </>
            )}

            {activeTab === 'tb' && (
              <>
                <button
                  onClick={handleExportTbExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Trial Balance to Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportTrialBalance}
                  className="inline-flex items-center px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Trial Balance to CSV file"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={handleExportTbPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Trial Balance to beautifully formatted PDF"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>
              </>
            )}

            {activeTab === 'bs' && (
              <>
                <button
                  onClick={handleExportBsExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Balance Sheet to Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportBsPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export Balance Sheet to beautifully formatted PDF"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>
              </>
            )}

            {activeTab === 'gst' && (
              <>
                <button
                  onClick={handleExportGstExcel}
                  className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export GST Summary & GSTR-1 Register to Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportGstSalesRegister}
                  className="inline-flex items-center px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export GSTR-1 Sales Register to CSV file"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  <span>Export GSTR-1 CSV</span>
                </button>

                <button
                  onClick={handleExportGstPdf}
                  className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Export GST Summary & GSTR-1 Register to beautifully formatted PDF"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  <span>Export to PDF</span>
                </button>
              </>
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
            onClick={() => setActiveTab('psr')}
            className={`pb-3 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'psr'
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Product Sale Report (PSR)</span>
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

        {/* Tab: Product Sale Report (PSR) */}
        {activeTab === 'psr' && (
          <div className="space-y-6">
            {/* Filter & Distributor Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/20">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                        {currentDistributor?.name || 'Distributor Firm'}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200">
                        PSR Aggregation
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      GSTIN: <span className="font-mono font-medium">{currentDistributor?.gstin || 'Unregistered'}</span> • State: {currentDistributor?.stateCode || '32'} - Kerala
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => fetchPsrReport()}
                    disabled={loadingPsr}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingPsr ? 'animate-spin' : ''}`} />
                    <span>Refresh PSR</span>
                  </button>
                  <button
                    onClick={handleExportPsrExcel}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                    <span>Export Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={handleExportPsrPdf}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Date Range & Search Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={detailedFilters.fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailedFilters((prev) => ({ ...prev, fromDate: val }));
                      fetchPsrReport({ fromDate: val });
                    }}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={detailedFilters.toDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailedFilters((prev) => ({ ...prev, toDate: val }));
                      fetchPsrReport({ toDate: val });
                    }}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Search Product / HSN
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter by product name, brand, or HSN code..."
                      value={psrSearchQuery}
                      onChange={(e) => setPsrSearchQuery(e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Range Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Quick Ranges:</span>
                {(['today', 'month', '30days', 'fy', 'all'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSetDatePreset(preset)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition"
                  >
                    {preset === 'today'
                      ? 'Today'
                      : preset === 'month'
                      ? 'This Month'
                      : preset === '30days'
                      ? 'Last 30 Days'
                      : preset === 'fy'
                      ? 'Current FY'
                      : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Distinct Products</span>
                  <Package className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {computedPsrSummary.distinctProducts}
                </div>
                <p className="text-[10px] text-slate-400">Total catalog items sold</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Quantity Sold</span>
                  <ShoppingBag className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {computedPsrSummary.totalQty.toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-slate-400">Total units / weight dispatched</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Taxable Sales</span>
                  <Tag className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹ {formatPaise(computedPsrSummary.totalTaxable)}
                </div>
                <p className="text-[10px] text-slate-400">Net goods value pre-tax</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">GST Collected</span>
                  <Percent className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  ₹ {formatPaise(computedPsrSummary.totalTax)}
                </div>
                <p className="text-[10px] text-slate-400">Output CGST + SGST + IGST</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-500/10 space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-blue-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Gross Revenue</span>
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-black text-white">
                  ₹ {formatPaise(computedPsrSummary.totalSales)}
                </div>
                <p className="text-[10px] text-blue-100">Grand billed turnover</p>
              </div>
            </div>

            {/* PSR Detailed Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Product-Wise Sales Aggregation (PSR)</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({filteredPsrItems.length} products listed)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregated by item description across all sales invoices in the selected period
                  </p>
                </div>
              </div>

              {loadingPsr ? (
                <div className="py-16 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">Aggregating product sales data...</p>
                </div>
              ) : filteredPsrItems.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No product sales found
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No sales invoice lines match the selected date range or search query. Post sales invoices or widen your date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-3 text-center w-12">#</th>
                        <th className="py-3 px-4 min-w-[220px]">Product / Item Description</th>
                        <th className="py-3 px-3 text-center w-24">HSN/SAC</th>
                        <th className="py-3 px-3 text-center w-20">Unit</th>
                        <th className="py-3 px-4 text-right w-28">Quantity Sold</th>
                        <th className="py-3 px-4 text-right w-28">Avg Rate (₹)</th>
                        <th className="py-3 px-4 text-right w-32">Taxable Value (₹)</th>
                        <th className="py-3 px-4 text-right w-28">GST Tax (₹)</th>
                        <th className="py-3 px-4 text-right w-36">Total Sales (₹)</th>
                        <th className="py-3 px-4 text-right w-32">Share %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {filteredPsrItems.map((item: any, idx: number) => {
                        const pctNum = computedPsrSummary.totalSales > 0
                          ? ((item.totalSales / computedPsrSummary.totalSales) * 100)
                          : 0;
                        const pctStr = pctNum.toFixed(1);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                              {item.hsnSac || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                                {item.unit || 'PCS'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {(item.totalQty || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                              ₹ {formatPaise(item.avgRate || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              ₹ {formatPaise(item.taxableValue || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-amber-700 dark:text-amber-400">
                              ₹ {formatPaise(item.taxAmount || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-blue-700 dark:text-blue-400">
                              ₹ {formatPaise(item.totalSales || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <div className="w-14 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-blue-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(pctNum, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px] w-12 text-right">
                                  {pctStr}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-100/90 dark:bg-slate-800 text-xs">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 uppercase text-slate-700 dark:text-slate-300 tracking-wider font-extrabold">
                          GRAND TOTALS ({filteredPsrItems.length} PRODUCTS)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-400 font-black">
                          {computedPsrSummary.totalQty.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">-</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-800 dark:text-emerald-300">
                          ₹ {formatPaise(computedPsrSummary.totalTaxable)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-800 dark:text-amber-300">
                          ₹ {formatPaise(computedPsrSummary.totalTax)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-800 dark:text-blue-300 text-sm font-black">
                          ₹ {formatPaise(computedPsrSummary.totalSales)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                          100.0%
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
