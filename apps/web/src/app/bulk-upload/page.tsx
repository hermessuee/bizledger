'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  Users,
  Building2,
  Package,
  CheckSquare,
  PieChart,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck,
  CreditCard,
  BookOpen,
  RotateCcw,
} from 'lucide-react';

type ImportModule =
  | 'customers'
  | 'vendors'
  | 'items'
  | 'invoices'
  | 'bills'
  | 'payments'
  | 'cheques'
  | 'accounts'
  | 'journal';

interface ModuleConfig {
  id: ImportModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  endpoint: string;
  filename: string;
  headers: string[];
  sampleRows: string[][];
}

const MODULE_CONFIGS: Record<ImportModule, ModuleConfig> = {
  customers: {
    id: 'customers',
    label: 'Customers Master',
    icon: Users,
    description: 'Bulk import client profiles, GSTINs, billing addresses, credit limits, and opening balances.',
    endpoint: '/api/v1/imports/parties',
    filename: 'bizledger_customers_template.csv',
    headers: ['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'CreditDays', 'OpeningBalanceRupees'],
    sampleRows: [
      ['Mahalaxmi Retailers', '27AABCM1234F1Z1', '9820011223', 'mahalaxmi@gmail.com', 'Dadar West, Mumbai', '30', '15000'],
      ['Balaji Trading Co', '27XYZPA5678B1Z9', '9819922334', 'orders@balajitrading.com', 'Market Yard, Pune', '45', '24500'],
    ],
  },
  vendors: {
    id: 'vendors',
    label: 'Vendors / Suppliers',
    icon: Building2,
    description: 'Bulk import vendor suppliers, GST details, payment terms, and existing accounts payable balances.',
    endpoint: '/api/v1/imports/parties',
    filename: 'bizledger_vendors_template.csv',
    headers: ['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'CreditDays', 'OpeningBalanceRupees'],
    sampleRows: [
      ['National Paper Mills', '27AABCN9988D1Z4', '9821033445', 'sales@nationalpaper.in', 'Bhiwandi, Thane', '30', '48000'],
      ['Shree Ganesh Logistics', '27BCDEP4433E1Z2', '9820044556', 'accounts@shreeganesh.com', 'APMC Vashi, Navi Mumbai', '15', '12500'],
    ],
  },
  items: {
    id: 'items',
    label: 'Items & Products',
    icon: Package,
    description: 'Bulk import product catalog, HSN/SAC codes, sale/purchase prices, GST tax rates, and opening stock quantities.',
    endpoint: '/api/v1/imports/items',
    filename: 'bizledger_items_template.csv',
    headers: ['ItemName', 'HSNSAC', 'Unit', 'SalePriceRupees', 'PurchasePriceRupees', 'GSTRatePercent', 'OpeningStockQty'],
    sampleRows: [
      ['A4 Copier Paper 75 GSM (Rim of 500)', '480256', 'RIM', '280', '220', '12', '150'],
      ['Corrugated Packaging Box 12x10x8', '481910', 'BOX', '35', '24', '18', '500'],
      ['Heavy Duty Tape 2 inch (Pack of 6)', '391910', 'PACK', '180', '135', '18', '80'],
    ],
  },
  invoices: {
    id: 'invoices',
    label: 'Sales Invoices',
    icon: FileText,
    description: 'Bulk import customer sales invoices with GST tax calculations, automated double-entry postings, and sales register impact.',
    endpoint: '/api/v1/imports/invoices',
    filename: 'bizledger_sales_invoices_template.csv',
    headers: ['InvoiceNo', 'Date', 'CustomerName', 'PlaceOfSupply', 'ItemDescription', 'HSNSAC', 'Qty', 'RateRupees', 'GSTRatePercent'],
    sampleRows: [
      ['INV-2026-001', '2026-11-20', 'Mahalaxmi Retailers', '27', 'A4 Copier Paper 75 GSM', '480256', '50', '280', '18'],
      ['INV-2026-002', '2026-11-21', 'Balaji Trading Co', '27', 'Packaging Box 12x10x8', '481910', '100', '35', '18'],
    ],
  },
  bills: {
    id: 'bills',
    label: 'Purchase Bills',
    icon: FileCheck,
    description: 'Bulk import supplier purchase bills with Input Tax Credit (ITC), HSN codes, and automatic accounts payable ledger postings.',
    endpoint: '/api/v1/imports/bills',
    filename: 'bizledger_purchase_bills_template.csv',
    headers: ['BillNo', 'Date', 'VendorName', 'PlaceOfSupply', 'ItemDescription', 'HSNSAC', 'Qty', 'RateRupees', 'GSTRatePercent'],
    sampleRows: [
      ['BILL-9841', '2026-11-18', 'National Paper Mills', '27', 'Bulk Paper Raw Stock', '480256', '200', '190', '12'],
      ['BILL-9842', '2026-11-19', 'Shree Ganesh Logistics', '27', 'Transport & Courier Service', '9965', '1', '12500', '18'],
    ],
  },
  payments: {
    id: 'payments',
    label: 'Receipts & Payments',
    icon: CreditCard,
    description: 'Bulk import customer receipts (collections) and vendor payments (disbursements) via Bank, UPI, Cheque, or Cash.',
    endpoint: '/api/v1/imports/payments',
    filename: 'bizledger_payments_receipts_template.csv',
    headers: ['Type', 'PartyName', 'Mode', 'Reference', 'AmountRupees', 'PayDate'],
    sampleRows: [
      ['receipt', 'Mahalaxmi Retailers', 'bank', 'NEFT-AXIS-991024', '15000', '2026-11-22'],
      ['payment', 'National Paper Mills', 'bank', 'RTGS-HDFC-88201', '35000', '2026-11-23'],
    ],
  },
  cheques: {
    id: 'cheques',
    label: 'Cheques & PDC',
    icon: CheckSquare,
    description: 'Bulk upload existing and post-dated cheques with cheque numbers, bank branches, dates, and amounts.',
    endpoint: '/api/v1/imports/cheques',
    filename: 'bizledger_cheques_template.csv',
    headers: ['Direction', 'PartyName', 'ChequeNo', 'BankName', 'Branch', 'AmountRupees', 'ChequeDate', 'Remarks'],
    sampleRows: [
      ['received', 'Mahalaxmi Retailers', '002145', 'State Bank of India', 'Dadar Branch', '50000', '2026-12-05', 'Advance payment against Order #104'],
      ['issued', 'National Paper Mills', '991042', 'HDFC Bank', 'Andheri East', '35000', '2026-12-10', 'Monthly paper supply clearing'],
    ],
  },
  accounts: {
    id: 'accounts',
    label: 'Chart of Accounts',
    icon: PieChart,
    description: 'Import custom ledger heads, bank ledger accounts, expense/income categories, and opening balances.',
    endpoint: '/api/v1/imports/accounts',
    filename: 'bizledger_accounts_template.csv',
    headers: ['AccountCode', 'AccountName', 'Type', 'OpeningBalanceRupees'],
    sampleRows: [
      ['1021', 'ICICI Bank Current A/c (Secondary)', 'asset', '250000'],
      ['5060', 'Vehicle Fuel & Transport Expense', 'expense', '0'],
      ['5070', 'Warehouse Electricity & Utilities', 'expense', '0'],
    ],
  },
  journal: {
    id: 'journal',
    label: 'Journal Vouchers',
    icon: BookOpen,
    description: 'Bulk import manual double-entry journal vouchers, adjustments, depreciation, and inter-ledger transfers.',
    endpoint: '/api/v1/imports/journal',
    filename: 'bizledger_journal_vouchers_template.csv',
    headers: ['EntryDate', 'Narration', 'DebitAccountCode', 'CreditAccountCode', 'AmountRupees', 'PartyName'],
    sampleRows: [
      ['2026-11-24', 'Office Equipment Depreciation', '5050', '1010', '4500', ''],
      ['2026-11-25', 'Monthly Warehouse Electricity Payment', '5070', '1020', '8200', ''],
    ],
  },
};

export default function BulkUploadPage() {
  const [activeModule, setActiveModule] = useState<ImportModule>('customers');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentConfig = MODULE_CONFIGS[activeModule];

  // 1. Download CSV Template dynamically
  const handleDownloadTemplate = () => {
    const csvContent = [
      currentConfig.headers.join(','),
      ...currentConfig.sampleRows.map((r) => r.map((field) => `"${field}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', currentConfig.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Parse CSV File in Browser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSuccessMsg(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        setErrorMsg('The uploaded CSV file is empty or missing data rows.');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.replace(/["']/g, '').trim());
      setColumns(headers);

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Basic CSV split supporting quoted strings
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, '').trim());
        if (values.length > 0 && values.some((v) => v.length > 0)) {
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] || '';
          });
          rows.push(rowObj);
        }
      }

      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  // 3. Submit parsed records to API
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      let payload: any = {};

      if (activeModule === 'customers' || activeModule === 'vendors') {
        payload = {
          kind: activeModule === 'customers' ? 'customer' : 'vendor',
          records: parsedRows.map((r) => ({
            name: r['Name'] || r['name'],
            gstin: r['GSTIN'] || r['gstin'],
            phone: r['Phone'] || r['phone'],
            email: r['Email'] || r['email'],
            address: r['Address'] || r['address'],
            creditDays: Number(r['CreditDays'] || r['creditDays'] || 30),
            openingBalance: Number(r['OpeningBalanceRupees'] || r['openingBalanceRupees'] || 0),
          })),
        };
      } else if (activeModule === 'items') {
        payload = {
          records: parsedRows.map((r) => ({
            name: r['ItemName'] || r['name'],
            hsnSac: r['HSNSAC'] || r['hsnSac'],
            unit: r['Unit'] || r['unit'] || 'PCS',
            salePrice: Number(r['SalePriceRupees'] || r['salePrice'] || 0),
            purchasePrice: Number(r['PurchasePriceRupees'] || r['purchasePrice'] || 0),
            gstRate: Number(r['GSTRatePercent'] || r['gstRate'] || 18),
            stockQty: Number(r['OpeningStockQty'] || r['stockQty'] || 0),
          })),
        };
      } else if (activeModule === 'invoices') {
        payload = {
          records: parsedRows.map((r) => ({
            invoiceNo: r['InvoiceNo'] || r['invoiceNo'],
            date: r['Date'] || r['date'],
            customerName: r['CustomerName'] || r['customerName'],
            placeOfSupply: r['PlaceOfSupply'] || r['placeOfSupply'],
            itemDescription: r['ItemDescription'] || r['itemDescription'],
            hsnSac: r['HSNSAC'] || r['hsnSac'],
            qty: Number(r['Qty'] || r['qty'] || 1),
            rate: Number(r['RateRupees'] || r['rateRupees'] || 0),
            gstRate: Number(r['GSTRatePercent'] || r['gstRate'] || 18),
          })),
        };
      } else if (activeModule === 'bills') {
        payload = {
          records: parsedRows.map((r) => ({
            billNo: r['BillNo'] || r['billNo'],
            date: r['Date'] || r['date'],
            vendorName: r['VendorName'] || r['vendorName'],
            placeOfSupply: r['PlaceOfSupply'] || r['placeOfSupply'],
            itemDescription: r['ItemDescription'] || r['itemDescription'],
            hsnSac: r['HSNSAC'] || r['hsnSac'],
            qty: Number(r['Qty'] || r['qty'] || 1),
            rate: Number(r['RateRupees'] || r['rateRupees'] || 0),
            gstRate: Number(r['GSTRatePercent'] || r['gstRate'] || 18),
          })),
        };
      } else if (activeModule === 'payments') {
        payload = {
          records: parsedRows.map((r) => ({
            kind: (r['Type'] || 'receipt').toLowerCase() === 'payment' ? 'payment' : 'receipt',
            partyName: r['PartyName'] || r['partyName'],
            mode: (r['Mode'] || 'bank').toLowerCase(),
            reference: r['Reference'] || r['reference'],
            amount: Number(r['AmountRupees'] || r['amount'] || 0),
            payDate: r['PayDate'] || r['payDate'],
          })),
        };
      } else if (activeModule === 'cheques') {
        payload = {
          records: parsedRows.map((r) => ({
            direction: (r['Direction'] || 'received').toLowerCase(),
            partyName: r['PartyName'] || r['partyName'],
            chequeNo: r['ChequeNo'] || r['chequeNo'],
            bankName: r['BankName'] || r['bankName'],
            branch: r['Branch'] || r['branch'],
            amount: Number(r['AmountRupees'] || r['amount'] || 0),
            chequeDate: r['ChequeDate'] || r['chequeDate'],
            remarks: r['Remarks'] || r['remarks'],
          })),
        };
      } else if (activeModule === 'accounts') {
        payload = {
          records: parsedRows.map((r) => ({
            code: r['AccountCode'] || r['code'],
            name: r['AccountName'] || r['name'],
            type: (r['Type'] || 'expense').toLowerCase(),
            openingBalance: Number(r['OpeningBalanceRupees'] || 0),
          })),
        };
      } else if (activeModule === 'journal') {
        payload = {
          records: parsedRows.map((r) => ({
            entryDate: r['EntryDate'] || r['entryDate'],
            narration: r['Narration'] || r['narration'],
            debitAccountCode: r['DebitAccountCode'] || r['debitAccountCode'],
            creditAccountCode: r['CreditAccountCode'] || r['creditAccountCode'],
            amount: Number(r['AmountRupees'] || r['amount'] || 0),
            partyName: r['PartyName'] || r['partyName'],
          })),
        };
      }

      const res = await api.post(currentConfig.endpoint, payload);

      setSuccessMsg(`Successfully imported ${res.count || parsedRows.length} records into your ${currentConfig.label}!`);
      setParsedRows([]);
      setFileName(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed. Please check your data format.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setColumns([]);
    setFileName(null);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  return (
    <AppShell currentMenu="bulk_upload">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bulk Data Upload & Templates</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive bulk import utility covering all 9 operational sections: Masters, Invoices, Bills, Collections, Cheques, Ledgers & Vouchers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Module Switcher Tabs */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl">
          {Object.values(MODULE_CONFIGS).map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveModule(mod.id);
                  handleReset();
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Module Detail Banner & CSV Download */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Active Import Section
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {currentConfig.label}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {currentConfig.label} Batch Importer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              {currentConfig.description}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download {currentConfig.label} Template (.CSV)</span>
            </button>
          </div>
        </div>

        {/* Success or Error Alerts */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Upload Dropzone / File Picker */}
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition">
          <input
            type="file"
            id="csv-file-input"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer space-y-3 block">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {fileName ? `Selected File: ${fileName}` : 'Click to select or drag and drop your CSV file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                CSV format only. Download the sample template above to ensure headers match.
              </p>
            </div>
          </label>
        </div>

        {/* Data Preview Table */}
        {parsedRows.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Data Preview ({parsedRows.length} rows ready to import)
                </h3>
                <p className="text-xs text-slate-500">
                  Review your parsed data before committing to live database ledgers.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Importing Data...' : `Confirm & Import ${parsedRows.length} Records`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {columns.map((col, idx) => (
                      <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.slice(0, 10).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      {columns.map((col, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                          {row[col] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 10 && (
              <p className="text-center text-xs text-slate-400">
                Showing first 10 of {parsedRows.length} rows. All rows will be imported.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
