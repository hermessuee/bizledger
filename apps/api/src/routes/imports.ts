import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { memoryStore } from '../store';
import {
  Party,
  Item,
  ChequeItem,
  Account,
  rupeesToPaise,
  calculateLineTax,
  calculateRoundOff,
} from '@bizledger/shared';
import { recordAuditLog } from '../audit';

const imports = new Hono<AppContext>();

imports.use('/*', authMiddleware);

// POST /api/v1/imports/parties - Bulk import customers or vendors
imports.post('/parties', async (c) => {
  const businessId = c.get('businessId');
  const body = await c.req.json<{
    kind: 'customer' | 'vendor' | 'both';
    records: Array<{
      name: string;
      gstin?: string;
      phone?: string;
      email?: string;
      address?: string;
      creditDays?: number;
      openingBalance?: number; // in rupees
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const inserted: Party[] = [];
  for (const r of body.records) {
    if (!r.name || !r.name.trim()) continue;
    const openingBalancePaise = r.openingBalance ? Math.round(Number(r.openingBalance) * 100) : 0;
    const newParty: Party = {
      id: crypto.randomUUID(),
      businessId,
      kind: body.kind || 'customer',
      name: r.name.trim(),
      gstin: r.gstin ? r.gstin.trim().toUpperCase() : null,
      phone: r.phone ? r.phone.trim() : null,
      email: r.email ? r.email.trim() : null,
      address: r.address ? r.address.trim() : null,
      creditDays: Number(r.creditDays) || 30,
      openingBalance: openingBalancePaise,
      currentBalance: openingBalancePaise,
      isActive: true,
    };
    memoryStore.parties.push(newParty);
    inserted.push(newParty);
  }

  recordAuditLog({
    businessId,
    userId: c.get('user').id,
    action: 'BULK_IMPORT_PARTIES',
    details: { kind: body.kind, count: inserted.length },
  });

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

// POST /api/v1/imports/items - Bulk import items & products
imports.post('/items', async (c) => {
  const businessId = c.get('businessId');
  const body = await c.req.json<{
    records: Array<{
      name: string;
      hsnSac?: string;
      unit?: string;
      salePrice?: number; // rupees
      purchasePrice?: number; // rupees
      gstRate?: number;
      trackStock?: boolean;
      stockQty?: number;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const inserted: Item[] = [];
  for (const r of body.records) {
    if (!r.name || !r.name.trim()) continue;
    const newItem: Item = {
      id: crypto.randomUUID(),
      businessId,
      name: r.name.trim(),
      hsnSac: r.hsnSac ? r.hsnSac.trim() : null,
      unit: r.unit?.trim() || 'PCS',
      salePrice: r.salePrice ? Math.round(Number(r.salePrice) * 100) : 0,
      purchasePrice: r.purchasePrice ? Math.round(Number(r.purchasePrice) * 100) : 0,
      gstRate: Number(r.gstRate) || 18,
      trackStock: r.trackStock !== false,
      stockQty: Number(r.stockQty) || 0,
    };
    memoryStore.items.push(newItem);
    inserted.push(newItem);
  }

  recordAuditLog({
    businessId,
    userId: c.get('user').id,
    action: 'BULK_IMPORT_ITEMS',
    details: { count: inserted.length },
  });

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

// POST /api/v1/imports/cheques - Bulk import cheques & PDCs
imports.post('/cheques', async (c) => {
  const businessId = c.get('businessId');
  const body = await c.req.json<{
    records: Array<{
      direction: 'received' | 'issued';
      partyName: string;
      chequeNo: string;
      bankName?: string;
      branch?: string;
      amount: number; // rupees
      chequeDate: string; // YYYY-MM-DD
      remarks?: string;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const inserted: ChequeItem[] = [];
  for (const r of body.records) {
    if (!r.chequeNo || !r.amount || !r.chequeDate) continue;

    let party = memoryStore.parties.find(
      (p) => p.businessId === businessId && p.name.toLowerCase() === (r.partyName || '').trim().toLowerCase()
    );
    if (!party && r.partyName) {
      party = {
        id: crypto.randomUUID(),
        businessId,
        kind: r.direction === 'received' ? 'customer' : 'vendor',
        name: r.partyName.trim(),
        creditDays: 30,
        openingBalance: 0,
        isActive: true,
      };
      memoryStore.parties.push(party);
    }

    const newCheque: ChequeItem = {
      id: crypto.randomUUID(),
      businessId,
      direction: r.direction === 'issued' ? 'issued' : 'received',
      partyId: party ? party.id : crypto.randomUUID(),
      partyName: r.partyName?.trim() || 'General Party',
      chequeNo: String(r.chequeNo).trim(),
      bankName: r.bankName?.trim() || 'Bank',
      branch: r.branch?.trim() || null,
      amount: Math.round(Number(r.amount) * 100),
      chequeDate: r.chequeDate,
      txnDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      remarks: r.remarks?.trim() || 'Bulk Imported PDC',
      createdAt: new Date().toISOString(),
    };
    memoryStore.cheques.push(newCheque);
    inserted.push(newCheque);
  }

  recordAuditLog({
    businessId,
    userId: c.get('user').id,
    action: 'BULK_IMPORT_CHEQUES',
    details: { count: inserted.length },
  });

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

// POST /api/v1/imports/accounts - Bulk import opening balances / chart of accounts
imports.post('/accounts', async (c) => {
  const businessId = c.get('businessId');
  const body = await c.req.json<{
    records: Array<{
      code: string;
      name: string;
      type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
      openingBalance?: number;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const inserted: Account[] = [];
  for (const r of body.records) {
    if (!r.code || !r.name) continue;
    const existing = memoryStore.accounts.find((a) => a.businessId === businessId && a.code === String(r.code).trim());
    if (existing) continue;

    const newAcc: Account = {
      id: crypto.randomUUID(),
      businessId,
      code: String(r.code).trim(),
      name: r.name.trim(),
      type: r.type || 'expense',
      isSystem: false,
      isActive: true,
    };
    memoryStore.accounts.push(newAcc);
    inserted.push(newAcc);
  }

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

// POST /api/v1/imports/invoices - Bulk import Sales Invoices with ledger & GST posting
imports.post('/invoices', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json<{
    records: Array<{
      invoiceNo?: string;
      date?: string;
      customerName: string;
      placeOfSupply?: string;
      itemDescription?: string;
      hsnSac?: string;
      qty?: number;
      rate?: number; // rupees
      gstRate?: number;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const business = memoryStore.businesses.find((b) => b.id === businessId);
  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);
  const arAccount = findAccountByCode('1030');
  const salesAccount = findAccountByCode('4010');
  const outputCgst = findAccountByCode('2030');
  const outputSgst = findAccountByCode('2031');
  const outputIgst = findAccountByCode('2032');

  const insertedDocs: any[] = [];
  const currentFy = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;

  for (const r of body.records) {
    if (!r.customerName) continue;

    // Find or create customer
    let party = memoryStore.parties.find(
      (p) => p.businessId === businessId && p.name.toLowerCase() === r.customerName.trim().toLowerCase()
    );
    if (!party) {
      party = {
        id: crypto.randomUUID(),
        businessId,
        kind: 'customer',
        name: r.customerName.trim(),
        creditDays: 30,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      };
      memoryStore.parties.push(party);
    }

    const pos = r.placeOfSupply?.trim() || business?.stateCode || '27';
    const isInterState = pos !== (business?.stateCode || '27');
    const qty = Number(r.qty) || 1;
    const ratePaise = Math.round(Number(r.rate || 0) * 100);
    const taxablePaise = BigInt(qty * ratePaise);
    const gstRate = Number(r.gstRate !== undefined ? r.gstRate : 18);

    const taxRes = calculateLineTax({
      taxableAmount: taxablePaise,
      gstRate,
      isInterState,
    });

    const subtotal = Number(taxRes.taxableAmount);
    const taxTotal = Number(taxRes.totalTax);
    const { roundOff, finalTotal } = calculateRoundOff(BigInt(subtotal + taxTotal));

    const docNo = r.invoiceNo?.trim() || memoryStore.getNextDocNo('sales_invoice', currentFy);
    const docDate = r.date?.trim() || new Date().toISOString().split('T')[0];

    const newDoc = {
      id: crypto.randomUUID(),
      businessId,
      docType: 'sales_invoice' as const,
      docNo,
      docDate,
      partyId: party.id,
      placeOfSupply: pos,
      subtotal,
      taxTotal,
      roundOff: Number(roundOff),
      total: Number(finalTotal),
      paidAmount: 0,
      status: 'posted' as const,
      lines: [
        {
          id: crypto.randomUUID(),
          description: r.itemDescription?.trim() || 'General Goods / Services',
          hsnSac: r.hsnSac?.trim() || '',
          qty,
          rate: ratePaise,
          discount: 0,
          gstRate,
          cgst: Number(taxRes.cgst),
          sgst: Number(taxRes.sgst),
          igst: Number(taxRes.igst),
          lineTotal: Number(taxRes.lineTotal),
        },
      ],
    };
    memoryStore.documents.push(newDoc);
    insertedDocs.push(newDoc);

    // Create posted journal entry
    if (arAccount && salesAccount) {
      const jLines: any[] = [
        { accountId: arAccount.id, partyId: party.id, debit: Number(finalTotal), credit: 0 },
        { accountId: salesAccount.id, debit: 0, credit: subtotal },
      ];
      if (Number(taxRes.cgst) > 0 && outputCgst) jLines.push({ accountId: outputCgst.id, debit: 0, credit: Number(taxRes.cgst) });
      if (Number(taxRes.sgst) > 0 && outputSgst) jLines.push({ accountId: outputSgst.id, debit: 0, credit: Number(taxRes.sgst) });
      if (Number(taxRes.igst) > 0 && outputIgst) jLines.push({ accountId: outputIgst.id, debit: 0, credit: Number(taxRes.igst) });

      memoryStore.createJournalEntry({
        businessId,
        entryDate: docDate,
        narration: `Bulk Import Sales Invoice #${docNo} (${party.name})`,
        sourceType: 'sales_invoice',
        sourceId: newDoc.id,
        createdBy: user?.id || 'system',
        lines: jLines,
      });
    }
  }

  recordAuditLog({
    businessId,
    userId: user?.id || 'system',
    action: 'BULK_IMPORT_INVOICES',
    details: { count: insertedDocs.length },
  });

  return c.json({ success: true, count: insertedDocs.length, records: insertedDocs }, 201);
});

// POST /api/v1/imports/bills - Bulk import Purchase Bills with ledger & ITC posting
imports.post('/bills', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json<{
    records: Array<{
      billNo?: string;
      date?: string;
      vendorName: string;
      placeOfSupply?: string;
      itemDescription?: string;
      hsnSac?: string;
      qty?: number;
      rate?: number; // rupees
      gstRate?: number;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const business = memoryStore.businesses.find((b) => b.id === businessId);
  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);
  const apAccount = findAccountByCode('2010');
  const purchasesAccount = findAccountByCode('5010');
  const inputCgst = findAccountByCode('1050');
  const inputSgst = findAccountByCode('1051');
  const inputIgst = findAccountByCode('1052');

  const insertedDocs: any[] = [];
  const currentFy = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;

  for (const r of body.records) {
    if (!r.vendorName) continue;

    // Find or create vendor
    let party = memoryStore.parties.find(
      (p) => p.businessId === businessId && p.name.toLowerCase() === r.vendorName.trim().toLowerCase()
    );
    if (!party) {
      party = {
        id: crypto.randomUUID(),
        businessId,
        kind: 'vendor',
        name: r.vendorName.trim(),
        creditDays: 30,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      };
      memoryStore.parties.push(party);
    }

    const pos = r.placeOfSupply?.trim() || business?.stateCode || '27';
    const isInterState = pos !== (business?.stateCode || '27');
    const qty = Number(r.qty) || 1;
    const ratePaise = Math.round(Number(r.rate || 0) * 100);
    const taxablePaise = BigInt(qty * ratePaise);
    const gstRate = Number(r.gstRate !== undefined ? r.gstRate : 18);

    const taxRes = calculateLineTax({
      taxableAmount: taxablePaise,
      gstRate,
      isInterState,
    });

    const subtotal = Number(taxRes.taxableAmount);
    const taxTotal = Number(taxRes.totalTax);
    const { roundOff, finalTotal } = calculateRoundOff(BigInt(subtotal + taxTotal));

    const docNo = r.billNo?.trim() || memoryStore.getNextDocNo('purchase_bill', currentFy);
    const docDate = r.date?.trim() || new Date().toISOString().split('T')[0];

    const newDoc = {
      id: crypto.randomUUID(),
      businessId,
      docType: 'purchase_bill' as const,
      docNo,
      docDate,
      partyId: party.id,
      placeOfSupply: pos,
      subtotal,
      taxTotal,
      roundOff: Number(roundOff),
      total: Number(finalTotal),
      paidAmount: 0,
      status: 'posted' as const,
      lines: [
        {
          id: crypto.randomUUID(),
          description: r.itemDescription?.trim() || 'Purchased Materials',
          hsnSac: r.hsnSac?.trim() || '',
          qty,
          rate: ratePaise,
          discount: 0,
          gstRate,
          cgst: Number(taxRes.cgst),
          sgst: Number(taxRes.sgst),
          igst: Number(taxRes.igst),
          lineTotal: Number(taxRes.lineTotal),
        },
      ],
    };
    memoryStore.documents.push(newDoc);
    insertedDocs.push(newDoc);

    // Create posted journal entry
    if (apAccount && purchasesAccount) {
      const jLines: any[] = [
        { accountId: purchasesAccount.id, debit: subtotal, credit: 0 },
      ];
      if (Number(taxRes.cgst) > 0 && inputCgst) jLines.push({ accountId: inputCgst.id, debit: Number(taxRes.cgst), credit: 0 });
      if (Number(taxRes.sgst) > 0 && inputSgst) jLines.push({ accountId: inputSgst.id, debit: Number(taxRes.sgst), credit: 0 });
      if (Number(taxRes.igst) > 0 && inputIgst) jLines.push({ accountId: inputIgst.id, debit: Number(taxRes.igst), credit: 0 });
      jLines.push({ accountId: apAccount.id, partyId: party.id, debit: 0, credit: Number(finalTotal) });

      memoryStore.createJournalEntry({
        businessId,
        entryDate: docDate,
        narration: `Bulk Import Purchase Bill #${docNo} (${party.name})`,
        sourceType: 'purchase_bill',
        sourceId: newDoc.id,
        createdBy: user?.id || 'system',
        lines: jLines,
      });
    }
  }

  recordAuditLog({
    businessId,
    userId: user?.id || 'system',
    action: 'BULK_IMPORT_BILLS',
    details: { count: insertedDocs.length },
  });

  return c.json({ success: true, count: insertedDocs.length, records: insertedDocs }, 201);
});

// POST /api/v1/imports/payments - Bulk import Receipts & Payments
imports.post('/payments', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json<{
    records: Array<{
      kind: 'receipt' | 'payment';
      partyName: string;
      mode?: string;
      reference?: string;
      amount: number; // rupees
      payDate?: string;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);
  const arAccount = findAccountByCode('1030');
  const apAccount = findAccountByCode('2010');
  const bankAccount = findAccountByCode('1020');
  const cashAccount = findAccountByCode('1010');

  const inserted: any[] = [];
  for (const r of body.records) {
    if (!r.partyName || !r.amount) continue;

    const isReceipt = r.kind === 'receipt';
    let party = memoryStore.parties.find(
      (p) => p.businessId === businessId && p.name.toLowerCase() === r.partyName.trim().toLowerCase()
    );
    if (!party) {
      party = {
        id: crypto.randomUUID(),
        businessId,
        kind: isReceipt ? 'customer' : 'vendor',
        name: r.partyName.trim(),
        creditDays: 30,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      };
      memoryStore.parties.push(party);
    }

    const amountPaise = Math.round(Number(r.amount) * 100);
    const payDate = r.payDate?.trim() || new Date().toISOString().split('T')[0];
    const mode = (r.mode?.toLowerCase() === 'cash' ? 'cash' : 'bank') as 'bank' | 'cash';
    const settlementAcct = mode === 'cash' ? cashAccount : bankAccount;

    if (!settlementAcct || !arAccount || !apAccount) continue;

    const jLines: any[] = [];
    if (isReceipt) {
      jLines.push({ accountId: settlementAcct.id, debit: amountPaise, credit: 0 });
      jLines.push({ accountId: arAccount.id, partyId: party.id, debit: 0, credit: amountPaise });
    } else {
      jLines.push({ accountId: apAccount.id, partyId: party.id, debit: amountPaise, credit: 0 });
      jLines.push({ accountId: settlementAcct.id, debit: 0, credit: amountPaise });
    }

    const jEntry = memoryStore.createJournalEntry({
      businessId,
      entryDate: payDate,
      narration: `Bulk Import ${isReceipt ? 'Receipt' : 'Payment'} (${party.name}) Ref: ${r.reference || 'N/A'}`,
      sourceType: r.kind,
      createdBy: user?.id || 'system',
      lines: jLines,
    });

    const newPayment = {
      id: crypto.randomUUID(),
      businessId,
      kind: r.kind,
      partyId: party.id,
      payDate,
      mode,
      amount: amountPaise,
      reference: r.reference?.trim() || 'Bulk Import',
      entryId: jEntry.id,
    };
    memoryStore.payments.push(newPayment);
    inserted.push(newPayment);
  }

  recordAuditLog({
    businessId,
    userId: user?.id || 'system',
    action: 'BULK_IMPORT_PAYMENTS',
    details: { count: inserted.length },
  });

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

// POST /api/v1/imports/journal - Bulk import Journal Vouchers
imports.post('/journal', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json<{
    records: Array<{
      entryDate?: string;
      narration?: string;
      debitAccountCode: string;
      creditAccountCode: string;
      amount: number; // rupees
      partyName?: string;
    }>;
  }>();

  if (!body.records || !Array.isArray(body.records)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Records array is required' } }, 400);
  }

  const inserted: any[] = [];
  for (const r of body.records) {
    if (!r.debitAccountCode || !r.creditAccountCode || !r.amount) continue;

    const debitAcc = memoryStore.accounts.find((a) => a.businessId === businessId && a.code === String(r.debitAccountCode).trim());
    const creditAcc = memoryStore.accounts.find((a) => a.businessId === businessId && a.code === String(r.creditAccountCode).trim());
    if (!debitAcc || !creditAcc) continue;

    let partyId: string | undefined;
    if (r.partyName) {
      const party = memoryStore.parties.find((p) => p.businessId === businessId && p.name.toLowerCase() === r.partyName!.trim().toLowerCase());
      partyId = party?.id;
    }

    const amountPaise = Math.round(Number(r.amount) * 100);
    const entryDate = r.entryDate?.trim() || new Date().toISOString().split('T')[0];

    const jEntry = memoryStore.createJournalEntry({
      businessId,
      entryDate,
      narration: r.narration?.trim() || 'Bulk Import Journal Voucher',
      sourceType: 'journal',
      createdBy: user?.id || 'system',
      lines: [
        { accountId: debitAcc.id, partyId, debit: amountPaise, credit: 0 },
        { accountId: creditAcc.id, partyId, debit: 0, credit: amountPaise },
      ],
    });
    inserted.push(jEntry);
  }

  recordAuditLog({
    businessId,
    userId: user?.id || 'system',
    action: 'BULK_IMPORT_JOURNAL',
    details: { count: inserted.length },
  });

  return c.json({ success: true, count: inserted.length, records: inserted }, 201);
});

export { imports as importRoutes };
