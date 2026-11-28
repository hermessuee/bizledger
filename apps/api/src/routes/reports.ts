import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { formatPaise } from '@bizledger/shared';

const reports = new Hono<AppContext>();
reports.use('/*', authMiddleware);

// GET /reports/trial-balance
reports.get('/trial-balance', requirePermission('reports', 'view'), (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');

  const accounts = isAll ? memoryStore.accounts : memoryStore.accounts.filter((a) => a.businessId === businessId);

  // Compute debit and credit sums per account
  const accountBalances: Record<string, { debit: number; credit: number }> = {};
  for (const acct of accounts) {
    accountBalances[acct.id] = { debit: 0, credit: 0 };
  }

  for (const entry of memoryStore.journalEntries) {
    if ((isAll || entry.businessId === businessId) && !entry.isVoid) {
      for (const line of entry.lines) {
        if (accountBalances[line.accountId]) {
          accountBalances[line.accountId].debit += line.debit;
          accountBalances[line.accountId].credit += line.credit;
        }
      }
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const rows = accounts
    .map((acct) => {
      const b = accountBalances[acct.id];
      const net = b.debit - b.credit;
      let closingDebit = 0;
      let closingCredit = 0;

      // Normal balance: asset/expense debit normal; liability/equity/income credit normal
      if (acct.type === 'asset' || acct.type === 'expense') {
        if (net >= 0) closingDebit = net;
        else closingCredit = -net;
      } else {
        if (net <= 0) closingCredit = -net;
        else closingDebit = net;
      }

      totalDebit += closingDebit;
      totalCredit += closingCredit;

      return {
        id: acct.id,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        totalDebit: b.debit,
        totalCredit: b.credit,
        closingDebit,
        closingCredit,
      };
    })
    .filter((r) => r.totalDebit > 0 || r.totalCredit > 0);

  const isBalanced = totalDebit === totalCredit;

  return c.json({
    rows,
    totalDebit,
    totalCredit,
    isBalanced,
  });
});

// GET /reports/profit-loss
reports.get('/profit-loss', requirePermission('reports', 'view'), (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');

  const accounts = isAll ? memoryStore.accounts : memoryStore.accounts.filter((a) => a.businessId === businessId);

  let totalIncome = 0;
  let totalExpense = 0;

  const incomeRows: any[] = [];
  const expenseRows: any[] = [];

  for (const acct of accounts) {
    if (acct.type !== 'income' && acct.type !== 'expense') continue;

    let debit = 0;
    let credit = 0;
    for (const entry of memoryStore.journalEntries) {
      if ((isAll || entry.businessId === businessId) && !entry.isVoid) {
        for (const line of entry.lines) {
          if (line.accountId === acct.id) {
            debit += line.debit;
            credit += line.credit;
          }
        }
      }
    }

    if (acct.type === 'income') {
      const net = credit - debit;
      totalIncome += net;
      if (net !== 0) incomeRows.push({ ...acct, amount: net });
    } else {
      const net = debit - credit;
      totalExpense += net;
      if (net !== 0) expenseRows.push({ ...acct, amount: net });
    }
  }

  const netProfit = totalIncome - totalExpense;

  return c.json({
    incomeRows,
    expenseRows,
    totalIncome,
    totalExpense,
    netProfit,
  });
});

// GET /reports/balance-sheet
reports.get('/balance-sheet', requirePermission('reports', 'view'), (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');

  const accounts = isAll ? memoryStore.accounts : memoryStore.accounts.filter((a) => a.businessId === businessId);

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  const assetRows: any[] = [];
  const liabilityRows: any[] = [];
  const equityRows: any[] = [];

  for (const acct of accounts) {
    let debit = 0;
    let credit = 0;
    for (const entry of memoryStore.journalEntries) {
      if ((isAll || entry.businessId === businessId) && !entry.isVoid) {
        for (const line of entry.lines) {
          if (line.accountId === acct.id) {
            debit += line.debit;
            credit += line.credit;
          }
        }
      }
    }

    if (acct.type === 'asset') {
      const net = debit - credit;
      totalAssets += net;
      if (net !== 0) assetRows.push({ ...acct, amount: net });
    } else if (acct.type === 'liability') {
      const net = credit - debit;
      totalLiabilities += net;
      if (net !== 0) liabilityRows.push({ ...acct, amount: net });
    } else if (acct.type === 'equity') {
      const net = credit - debit;
      totalEquity += net;
      if (net !== 0) equityRows.push({ ...acct, amount: net });
    }
  }

  // Calculate net profit from P&L and add to equity
  let pnlIncome = 0;
  let pnlExpense = 0;
  for (const acct of accounts) {
    if (acct.type === 'income' || acct.type === 'expense') {
      for (const entry of memoryStore.journalEntries) {
        if ((isAll || entry.businessId === businessId) && !entry.isVoid) {
          for (const line of entry.lines) {
            if (line.accountId === acct.id) {
              if (acct.type === 'income') pnlIncome += line.credit - line.debit;
              else pnlExpense += line.debit - line.credit;
            }
          }
        }
      }
    }
  }
  const currentPeriodProfit = pnlIncome - pnlExpense;
  totalEquity += currentPeriodProfit;

  return c.json({
    assetRows,
    liabilityRows,
    equityRows,
    currentPeriodProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced: totalAssets === totalLiabilities + totalEquity,
  });
});

// GET /reports/ledger/:accountId
reports.get('/ledger/:accountId', requirePermission('reports', 'view'), (c) => {
  const businessId = c.get('businessId');
  const accountId = c.req.param('accountId');
  const acct = memoryStore.accounts.find((a) => a.id === accountId && a.businessId === businessId);
  if (!acct) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Account not found' } }, 404);
  }

  const entries: any[] = [];
  let runningBalance = 0;

  for (const entry of memoryStore.journalEntries) {
    if (entry.businessId === businessId && !entry.isVoid) {
      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          if (acct.type === 'asset' || acct.type === 'expense') {
            runningBalance += line.debit - line.credit;
          } else {
            runningBalance += line.credit - line.debit;
          }
          entries.push({
            date: entry.entryDate,
            entryNo: entry.entryNo,
            narration: entry.narration,
            debit: line.debit,
            credit: line.credit,
            runningBalance,
          });
        }
      }
    }
  }

  return c.json({ account: acct, entries, closingBalance: runningBalance });
});

// GET /reports/gst-summary
reports.get('/gst-summary', requirePermission('gst', 'view'), (c) => {
  const businessId = c.get('businessId');

  let outputCgst = 0;
  let outputSgst = 0;
  let outputIgst = 0;
  let inputCgst = 0;
  let inputSgst = 0;
  let inputIgst = 0;

  for (const doc of memoryStore.documents) {
    if (doc.businessId === businessId && doc.status === 'posted') {
      for (const l of doc.lines) {
        if (doc.docType === 'sales_invoice') {
          outputCgst += l.cgst;
          outputSgst += l.sgst;
          outputIgst += l.igst;
        } else if (doc.docType === 'purchase_bill') {
          inputCgst += l.cgst;
          inputSgst += l.sgst;
          inputIgst += l.igst;
        }
      }
    }
  }

  const totalOutputTax = outputCgst + outputSgst + outputIgst;
  const totalInputCredit = inputCgst + inputSgst + inputIgst;
  const netGstPayable = Math.max(0, totalOutputTax - totalInputCredit);

  // Sales register (GSTR-1 style)
  const salesRegister = memoryStore.documents
    .filter((d) => d.businessId === businessId && d.docType === 'sales_invoice' && d.status === 'posted')
    .map((doc) => {
      const party = memoryStore.parties.find((p) => p.id === doc.partyId);
      let cgst = 0, sgst = 0, igst = 0;
      doc.lines.forEach((l) => {
        cgst += l.cgst;
        sgst += l.sgst;
        igst += l.igst;
      });
      return {
        invoiceNo: doc.docNo,
        date: doc.docDate,
        customerName: party?.name,
        customerGstin: party?.gstin || 'Unregistered',
        placeOfSupply: doc.placeOfSupply,
        taxableValue: doc.subtotal,
        cgst,
        sgst,
        igst,
        totalInvoiceValue: doc.total,
      };
    });

  return c.json({
    output: { cgst: outputCgst, sgst: outputSgst, igst: outputIgst, total: totalOutputTax },
    input: { cgst: inputCgst, sgst: inputSgst, igst: inputIgst, total: totalInputCredit },
    netGstPayable,
    salesRegister,
  });
});

// GET /reports/detailed-trading - Itemized Daybook & Detailed Trading Entries (Purchases & Sales)
reports.get('/detailed-trading', requirePermission('reports', 'view'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const queryBiz = c.req.query('businessId');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const docTypeFilter = c.req.query('type'); // 'all' | 'purchases' | 'sales'

  const targetBizId = isSuperAdmin && queryBiz ? queryBiz : businessId;
  const isAll = isSuperAdmin && (!targetBizId || targetBizId === 'all' || targetBizId === '00000000-0000-0000-0000-000000000000');

  // Hydrate or sync from Neon PostgreSQL if necessary
  await memoryStore.syncIfNeeded();

  const distBiz = isAll
    ? null
    : memoryStore.businesses.find((b) => b.id === targetBizId) || memoryStore.businesses[0];

  let docs = memoryStore.documents.filter((d) => d.status !== 'void');

  if (!isAll) {
    docs = docs.filter((d) => d.businessId === targetBizId);
  }

  if (fromDate) {
    docs = docs.filter((d) => d.docDate >= fromDate);
  }
  if (toDate) {
    docs = docs.filter((d) => d.docDate <= toDate);
  }

  if (docTypeFilter === 'purchases') {
    docs = docs.filter((d) => d.docType === 'purchase_bill');
  } else if (docTypeFilter === 'sales') {
    docs = docs.filter((d) => d.docType === 'sales_invoice');
  }

  // Sort chronologically by date then document number
  docs.sort((a, b) => a.docDate.localeCompare(b.docDate) || a.docNo.localeCompare(b.docNo));

  const entries: any[] = [];
  let totalPurchasesDebit = 0;
  let totalSalesCredit = 0;
  let totalTax = 0;
  let totalQty = 0;
  let runningBalance = 0;

  for (const doc of docs) {
    const party = memoryStore.parties.find((p) => p.id === doc.partyId);
    const docDist = memoryStore.businesses.find((b) => b.id === doc.businessId);
    const isPurchase = doc.docType === 'purchase_bill';

    if (Array.isArray(doc.lines) && doc.lines.length > 0) {
      for (const line of doc.lines) {
        const item = line.itemId ? memoryStore.items.find((i) => i.id === line.itemId) : null;
        const lineTax = (line.cgst || 0) + (line.sgst || 0) + (line.igst || 0);
        const debit = isPurchase ? line.lineTotal : 0;
        const credit = !isPurchase ? line.lineTotal : 0;
        const unit = (line as any).unit || item?.unit || 'KG';

        totalPurchasesDebit += debit;
        totalSalesCredit += credit;
        totalTax += lineTax;
        totalQty += (line.qty || 0);

        // Credit (Sales) increases balance; Debit (Purchases) decreases balance
        runningBalance += (credit - debit);

        entries.push({
          id: `${doc.id}-${line.id}`,
          docId: doc.id,
          docNo: doc.docNo,
          docDate: doc.docDate,
          dueDate: doc.dueDate || null,
          docType: doc.docType,
          typeLabel: isPurchase ? 'Purchase Bill' : 'Sales Invoice',
          category: isPurchase ? 'Purchase' : 'Sale',
          status: doc.status,
          businessId: doc.businessId,
          distributorName: docDist?.name || 'Distributor',
          distributorGstin: docDist?.gstin || '',
          partyId: doc.partyId,
          partyName: party?.name || 'Unknown Party',
          partyGstin: party?.gstin || '-',
          placeOfSupply: doc.placeOfSupply,
          itemId: line.itemId || null,
          description: line.description || (isPurchase ? 'Purchased Goods' : 'Sales Goods'),
          hsnSac: line.hsnSac || item?.hsnSac || '-',
          qty: line.qty || 0,
          unit,
          rate: line.rate || 0,
          gstRate: line.gstRate || 0,
          taxAmount: lineTax,
          taxableAmount: line.lineTotal - lineTax,
          lineTotal: line.lineTotal,
          debit,
          credit,
          runningBalance,
        });
      }
    } else {
      // Fallback for doc without detailed lines
      const debit = isPurchase ? doc.total : 0;
      const credit = !isPurchase ? doc.total : 0;
      totalPurchasesDebit += debit;
      totalSalesCredit += credit;
      totalTax += doc.taxTotal || 0;
      runningBalance += (credit - debit);

      entries.push({
        id: doc.id,
        docId: doc.id,
        docNo: doc.docNo,
        docDate: doc.docDate,
        dueDate: doc.dueDate || null,
        docType: doc.docType,
        typeLabel: isPurchase ? 'Purchase Bill' : 'Sales Invoice',
        category: isPurchase ? 'Purchase' : 'Sale',
        status: doc.status,
        businessId: doc.businessId,
        distributorName: docDist?.name || 'Distributor',
        distributorGstin: docDist?.gstin || '',
        partyId: doc.partyId,
        partyName: party?.name || 'Unknown Party',
        partyGstin: party?.gstin || '-',
        placeOfSupply: doc.placeOfSupply,
        itemId: null,
        description: isPurchase ? 'Purchased Goods & Services' : 'Sales Invoiced Goods',
        hsnSac: '-',
        qty: 1,
        unit: 'LOT',
        rate: doc.subtotal,
        gstRate: 0,
        taxAmount: doc.taxTotal || 0,
        taxableAmount: doc.subtotal,
        lineTotal: doc.total,
        debit,
        credit,
        runningBalance,
      });
    }
  }

  const netProfit = totalSalesCredit - totalPurchasesDebit;

  return c.json({
    distributor: {
      id: distBiz?.id || 'all',
      name: isAll ? 'All Distributors Master Consolidation' : (distBiz?.name || 'Distributor Firm'),
      gstin: distBiz?.gstin || '',
      address: distBiz?.address || '',
      stateCode: distBiz?.stateCode || '32',
      isAll,
    },
    businesses: isSuperAdmin ? memoryStore.businesses.map(b => ({ id: b.id, name: b.name, gstin: b.gstin })) : [],
    filters: {
      fromDate: fromDate || '',
      toDate: toDate || '',
      type: docTypeFilter || 'all',
      businessId: targetBizId,
    },
    summary: {
      totalPurchasesDebit,
      totalSalesCredit,
      netProfit,
      totalTax,
      totalQty,
      totalEntries: entries.length,
    },
    entries,
  });
});

// GET /reports/psr - Product Sale Report (PSR)
reports.get('/psr', requirePermission('reports', 'view'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const queryBiz = c.req.query('businessId');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const search = (c.req.query('search') || '').trim().toLowerCase();

  const isAll = isSuperAdmin && (queryBiz === 'all' || (!queryBiz && businessId === 'all'));
  const targetBizId = isAll ? 'all' : (queryBiz && queryBiz !== 'all' ? queryBiz : businessId);

  let docs = memoryStore.documents.filter((d) => d.docType === 'sales_invoice' && d.status === 'posted');
  if (!isAll) {
    docs = docs.filter((d) => d.businessId === targetBizId);
  }
  if (fromDate) {
    docs = docs.filter((d) => d.docDate >= fromDate);
  }
  if (toDate) {
    docs = docs.filter((d) => d.docDate <= toDate);
  }

  const distBiz = isAll ? null : memoryStore.businesses.find((b) => b.id === targetBizId);

  const map = new Map<string, {
    itemId: string | null;
    name: string;
    hsnSac: string;
    unit: string;
    totalQty: number;
    totalTaxable: number;
    totalTax: number;
    totalSales: number;
    invoices: Set<string>;
  }>();

  for (const doc of docs) {
    for (const l of doc.lines) {
      const key = (l.description || 'General Item').trim();
      const lineUnit = (l as any).unit || 'PCS';
      const existing = map.get(key) || {
        itemId: l.itemId || null,
        name: key,
        hsnSac: l.hsnSac || '-',
        unit: lineUnit,
        totalQty: 0,
        totalTaxable: 0,
        totalTax: 0,
        totalSales: 0,
        invoices: new Set<string>(),
      };

      existing.totalQty += l.qty || 0;
      const taxable = (l.rate * l.qty) - (l.discount || 0);
      const tax = (l.cgst || 0) + (l.sgst || 0) + (l.igst || 0);
      existing.totalTaxable += taxable;
      existing.totalTax += tax;
      existing.totalSales += l.lineTotal || (taxable + tax);
      existing.invoices.add(doc.docNo);

      if (l.hsnSac && l.hsnSac !== '-') existing.hsnSac = l.hsnSac;
      if (lineUnit) existing.unit = lineUnit;

      map.set(key, existing);
    }
  }

  let items = Array.from(map.values()).map((v) => ({
    itemId: v.itemId,
    name: v.name,
    hsnSac: v.hsnSac,
    unit: v.unit,
    totalQty: v.totalQty,
    avgRate: v.totalQty > 0 ? Math.round(v.totalTaxable / v.totalQty) : 0,
    taxableValue: v.totalTaxable,
    taxAmount: v.totalTax,
    totalSales: v.totalSales,
    invoiceCount: v.invoices.size,
  }));

  if (search) {
    items = items.filter(
      (i) => i.name.toLowerCase().includes(search) || i.hsnSac.toLowerCase().includes(search)
    );
  }

  items.sort((a, b) => b.totalSales - a.totalSales);

  const grandTotalSales = items.reduce((sum, i) => sum + i.totalSales, 0);
  const grandTotalQty = items.reduce((sum, i) => sum + i.totalQty, 0);
  const grandTotalTaxable = items.reduce((sum, i) => sum + i.taxableValue, 0);
  const grandTotalTax = items.reduce((sum, i) => sum + i.taxAmount, 0);

  const enrichedItems = items.map((i, idx) => ({
    slNo: idx + 1,
    ...i,
    percentContribution: grandTotalSales > 0 ? ((i.totalSales / grandTotalSales) * 100).toFixed(1) : '0.0',
  }));

  return c.json({
    distributor: {
      id: distBiz?.id || 'all',
      name: isAll ? 'All Distributors Master Consolidation' : (distBiz?.name || 'Distributor Firm'),
      gstin: distBiz?.gstin || '',
      address: distBiz?.address || '',
      stateCode: distBiz?.stateCode || '32',
      isAll,
    },
    filters: {
      fromDate: fromDate || '',
      toDate: toDate || '',
      businessId: targetBizId,
      search,
    },
    summary: {
      distinctProducts: enrichedItems.length,
      totalQty: grandTotalQty,
      totalTaxable: grandTotalTaxable,
      totalTax: grandTotalTax,
      totalSales: grandTotalSales,
      totalInvoices: docs.length,
    },
    items: enrichedItems,
  });
});

export { reports as reportRoutes };
