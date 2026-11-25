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
  RotateCcw,
} from 'lucide-react';

type ImportModule = 'customers' | 'vendors' | 'items' | 'cheques' | 'accounts';

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
  cheques: {
    id: 'cheques',
    label: 'Cheques & Post-Dated (PDC)',
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
    label: 'Chart of Accounts & Ledgers',
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
                  Import existing master data, customer/vendor balance books, item stocks, and post-dated cheques via CSV.
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
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition ${
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

        {/* Active Module Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <currentConfig.icon className="w-5 h-5 text-blue-600" />
                <span>Upload {currentConfig.label}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{currentConfig.description}</p>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Alert Messages */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-3 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center space-x-3 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Upload Zone */}
          {parsedRows.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-8 text-center transition bg-slate-50/50 dark:bg-slate-800/30">
              <input
                type="file"
                id="csvInput"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csvInput" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to select or drag and drop your completed CSV file
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Format must match template ({currentConfig.headers.join(', ')})
                </p>
              </label>
            </div>
          ) : (
            /* Preview Table & Confirmation */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">{fileName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                    {parsedRows.length} rows ready
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Clear & Re-upload
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={loading}
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Confirm & Import {parsedRows.length} Records</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      {columns.map((col) => (
                        <th key={col} className="py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-center text-slate-400 font-sans">{idx + 1}</td>
                        {columns.map((col) => (
                          <td key={col} className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-xs">
                            {row[col] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[11px] text-slate-400 text-center italic">
                  Showing first 50 rows of {parsedRows.length} total rows.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
