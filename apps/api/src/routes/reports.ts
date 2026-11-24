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
  const accounts = memoryStore.accounts.filter((a) => a.businessId === businessId);

  // Compute debit and credit sums per account
  const accountBalances: Record<string, { debit: number; credit: number }> = {};
  for (const acct of accounts) {
    accountBalances[acct.id] = { debit: 0, credit: 0 };
  }

  for (const entry of memoryStore.journalEntries) {
    if (entry.businessId === businessId && !entry.isVoid) {
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
  const accounts = memoryStore.accounts.filter((a) => a.businessId === businessId);

  let totalIncome = 0;
  let totalExpense = 0;

  const incomeRows: any[] = [];
  const expenseRows: any[] = [];

  for (const acct of accounts) {
    if (acct.type !== 'income' && acct.type !== 'expense') continue;

    let debit = 0;
    let credit = 0;
    for (const entry of memoryStore.journalEntries) {
      if (entry.businessId === businessId && !entry.isVoid) {
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
  const accounts = memoryStore.accounts.filter((a) => a.businessId === businessId);

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
      if (entry.businessId === businessId && !entry.isVoid) {
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
        if (entry.businessId === businessId && !entry.isVoid) {
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

export { reports as reportRoutes };
