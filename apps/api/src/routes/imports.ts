import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { memoryStore } from '../store';
import { Party, Item, ChequeItem, Account, rupeesToPaise } from '@bizledger/shared';
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

    // Find party or create party if doesn't exist
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

export { imports as importRoutes };
