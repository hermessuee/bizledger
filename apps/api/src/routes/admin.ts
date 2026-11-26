import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { memoryStore } from '../store';
import { MenuKey, Business, MENU_KEYS } from '@bizledger/shared';
import { recordAuditLog } from '../audit';
import { hashPassword } from '../crypto';

const admin = new Hono<AppContext>();

// Require authentication for all admin routes
admin.use('/*', authMiddleware);

// Middleware to ensure user is super_admin or owner
admin.use('/*', async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'super_admin' && user.role !== 'owner') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Super Administrator privileges required' } }, 403);
  }
  await next();
});

// GET /api/v1/admin/businesses - List all registered distributors with metrics
admin.get('/businesses', (c) => {
  const businessesWithStats = memoryStore.businesses
    .filter((b) => b.id !== '00000000-0000-0000-0000-000000000000') // Filter out platform admin from tenant list
    .map((b) => {
    const userCount = memoryStore.users.filter((u) => u.businessId === b.id).length;
    const customerCount = memoryStore.parties.filter((p) => p.businessId === b.id && (p.kind === 'customer' || p.kind === 'both')).length;
    const vendorCount = memoryStore.parties.filter((p) => p.businessId === b.id && (p.kind === 'vendor' || p.kind === 'both')).length;
    const invoiceCount = memoryStore.documents.filter((d) => d.businessId === b.id && d.docType === 'sales_invoice').length;
    const chequeCount = memoryStore.cheques.filter((ch) => ch.businessId === b.id).length;

    return {
      ...b,
      stats: {
        users: userCount,
        customers: customerCount,
        vendors: vendorCount,
        invoices: invoiceCount,
        cheques: chequeCount,
      },
    };
  });

  return c.json({ businesses: businessesWithStats, availableMenus: MENU_KEYS });
});

// POST /api/v1/admin/businesses - Register a new distributor directly from Super Admin Portal
admin.post('/businesses', async (c) => {
  const body = await c.req.json();
  const { businessName, gstin, stateCode, address, ownerName, email, username, password, enabledMenus } = body;

  if (!businessName || !ownerName || !email || !username || !password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'All required distributor fields must be filled' } }, 400);
  }

  const existing = memoryStore.users.find(
    (u) =>
      u.username.toLowerCase() === username.trim().toLowerCase() ||
      u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existing) {
    return c.json({ error: { code: 'DUPLICATE_USER', message: 'Distributor username or email is already registered' } }, 409);
  }

  const passwordHash = await hashPassword(password);
  const { business, user } = memoryStore.createBusiness({
    name: businessName.trim(),
    gstin: gstin ? gstin.trim().toUpperCase() : undefined,
    stateCode: stateCode || (gstin ? gstin.trim().slice(0, 2) : '27'),
    address: address ? address.trim() : undefined,
    ownerName: ownerName.trim(),
    ownerEmail: email.trim().toLowerCase(),
    ownerUsername: username.trim().toLowerCase(),
    ownerPasswordHash: passwordHash,
  });

  if (enabledMenus && Array.isArray(enabledMenus) && enabledMenus.length > 0) {
    business.enabledMenus = enabledMenus;
  }

  recordAuditLog({
    businessId: business.id,
    userId: c.get('user').id,
    action: 'SUPER_ADMIN_REGISTER_DISTRIBUTOR',
    details: { businessName: business.name, ownerUsername: user.username },
  });

  return c.json({
    success: true,
    business,
    user: { id: user.id, username: user.username, name: user.name, email: user.email },
  }, 201);
});

// PUT /api/v1/admin/businesses/:id/modules - Toggle modules/menus enabled for a distributor
admin.put('/businesses/:id/modules', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ enabledMenus: MenuKey[] }>();

  const business = memoryStore.businesses.find((b) => b.id === id);
  if (!business) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Distributor business not found' } }, 404);
  }

  business.enabledMenus = body.enabledMenus || [];
  recordAuditLog({
    businessId: business.id,
    userId: c.get('user').id,
    action: 'UPDATE_DISTRIBUTOR_MODULES',
    details: { businessName: business.name, enabledCount: business.enabledMenus.length },
  });

  return c.json({ success: true, business });
});

// PUT /api/v1/admin/businesses/:id/status - Update distributor account status (active, suspended, trial)
admin.put('/businesses/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status: 'active' | 'suspended' | 'trial' }>();

  const business = memoryStore.businesses.find((b) => b.id === id);
  if (!business) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Distributor business not found' } }, 404);
  }

  business.status = body.status;
  recordAuditLog({
    businessId: business.id,
    userId: c.get('user').id,
    action: 'UPDATE_DISTRIBUTOR_STATUS',
    details: { businessName: business.name, newStatus: body.status },
  });

  return c.json({ success: true, business });
});

// =========================================================================
// SUPER ADMIN MASTER TRANSACTION EXPLORER & FULL CRUD APIS
// Allows Super Admin to view, create, edit, and delete ANY transaction across ANY firm
// =========================================================================

// GET /api/v1/admin/transactions - Aggregate all transactions across all firms
admin.get('/transactions', (c) => {
  const businessId = c.req.query('businessId');
  const typeFilter = c.req.query('type');
  const search = (c.req.query('search') || '').toLowerCase().trim();

  const allTx: Array<{
    id: string;
    businessId: string;
    businessName: string;
    type: string;
    refNo: string;
    date: string;
    partyId?: string | null;
    partyName: string;
    amount: number;
    status: string;
    narration: string;
    createdBy?: string;
    raw: any;
  }> = [];

  const getBizName = (bId: string) => {
    return memoryStore.businesses.find((b) => b.id === bId)?.name || 'Unknown Firm';
  };

  const getPartyName = (pId?: string | null) => {
    if (!pId) return '-';
    return memoryStore.parties.find((p) => p.id === pId)?.name || 'Unknown Party';
  };

  // 1. Documents (Sales Invoices & Purchase Bills)
  const docs = (businessId && businessId !== 'all')
    ? memoryStore.documents.filter((d) => d.businessId === businessId)
    : memoryStore.documents;

  for (const doc of docs) {
    if (!typeFilter || typeFilter === 'all' || typeFilter === doc.docType) {
      allTx.push({
        id: doc.id,
        businessId: doc.businessId,
        businessName: getBizName(doc.businessId),
        type: doc.docType,
        refNo: doc.docNo,
        date: doc.docDate,
        partyId: doc.partyId,
        partyName: getPartyName(doc.partyId),
        amount: doc.total,
        status: doc.status,
        narration: `Items: ${doc.lines?.length || 0} line(s) • Tax: ₹${((doc.taxTotal || 0) / 100).toFixed(2)}`,
        raw: doc,
      });
    }
  }

  // 2. Payments & Receipts
  const payments = (businessId && businessId !== 'all')
    ? memoryStore.payments.filter((p) => p.businessId === businessId)
    : memoryStore.payments;

  for (const pay of payments) {
    if (!typeFilter || typeFilter === 'all' || typeFilter === pay.kind) {
      allTx.push({
        id: pay.id,
        businessId: pay.businessId,
        businessName: getBizName(pay.businessId),
        type: pay.kind,
        refNo: pay.reference || `PAY-${pay.id.slice(0, 6)}`,
        date: pay.payDate,
        partyId: pay.partyId,
        partyName: getPartyName(pay.partyId),
        amount: pay.amount,
        status: 'posted',
        narration: `Mode: ${pay.mode.toUpperCase()}${pay.reference ? ' • Ref: ' + pay.reference : ''}`,
        raw: pay,
      });
    }
  }

  // 3. Cheques & PDCs
  const cheques = (businessId && businessId !== 'all')
    ? memoryStore.cheques.filter((ch) => ch.businessId === businessId)
    : memoryStore.cheques;

  for (const ch of cheques) {
    if (!typeFilter || typeFilter === 'all' || typeFilter === 'cheque') {
      allTx.push({
        id: ch.id,
        businessId: ch.businessId,
        businessName: getBizName(ch.businessId),
        type: 'cheque',
        refNo: ch.chequeNumber,
        date: ch.chequeDate,
        partyId: ch.partyId,
        partyName: getPartyName(ch.partyId),
        amount: ch.amount,
        status: ch.status,
        narration: `${ch.direction === 'inward' ? 'Received PDC' : 'Issued Cheque'} • Bank: ${ch.bankName}`,
        raw: ch,
      });
    }
  }

  // 4. Journal Entries
  const journals = (businessId && businessId !== 'all')
    ? memoryStore.journalEntries.filter((j) => j.businessId === businessId)
    : memoryStore.journalEntries;

  for (const j of journals) {
    if (!typeFilter || typeFilter === 'all' || typeFilter === 'journal') {
      const debitTotal = j.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0;
      allTx.push({
        id: j.id,
        businessId: j.businessId,
        businessName: getBizName(j.businessId),
        type: 'journal',
        refNo: j.entryNo,
        date: j.entryDate,
        partyName: 'General Ledger',
        amount: debitTotal,
        status: j.isVoid ? 'void' : 'posted',
        narration: j.narration || 'Manual Journal Voucher',
        raw: j,
      });
    }
  }

  // Sort descending by date
  allTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter by search string if provided
  const filtered = search
    ? allTx.filter(
        (tx) =>
          tx.refNo.toLowerCase().includes(search) ||
          tx.partyName.toLowerCase().includes(search) ||
          tx.businessName.toLowerCase().includes(search) ||
          tx.narration.toLowerCase().includes(search)
      )
    : allTx;

  return c.json({ transactions: filtered });
});

// POST /api/v1/admin/transactions - Super Admin directly adds a transaction for any firm
admin.post('/transactions', async (c) => {
  const body = await c.req.json();
  const { businessId, type, date, amount, partyId, refNo, narration, mode, bankName } = body;

  if (!businessId || !type || amount === undefined) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'businessId, type, and amount are required' } }, 400);
  }

  const currentUser = c.get('user');
  const txDate = date || new Date().toISOString().split('T')[0];

  if (type === 'sales_invoice' || type === 'purchase_bill') {
    const docNo = refNo || memoryStore.getNextDocNo(type, '2026-27');
    const newDoc = {
      id: crypto.randomUUID(),
      businessId,
      docType: type,
      docNo,
      docDate: txDate,
      partyId: partyId || (memoryStore.parties.find((p) => p.businessId === businessId)?.id || ''),
      placeOfSupply: '27',
      subtotal: Math.round(amount * 0.82),
      taxTotal: Math.round(amount * 0.18),
      roundOff: 0,
      total: amount,
      paidAmount: 0,
      status: 'posted' as const,
      lines: [
        {
          id: crypto.randomUUID(),
          description: narration || 'Super Admin provisioned transaction',
          qty: 1,
          rate: Math.round(amount * 0.82),
          discount: 0,
          gstRate: 18,
          cgst: Math.round(amount * 0.09),
          sgst: Math.round(amount * 0.09),
          igst: 0,
          lineTotal: amount,
        },
      ],
    };
    memoryStore.documents.push(newDoc);
    recordAuditLog({
      businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_CREATE_DOCUMENT',
      details: { docNo: newDoc.docNo, type, amount },
    });
    return c.json({ success: true, transaction: newDoc }, 201);
  }

  if (type === 'receipt' || type === 'payment') {
    const newPay = {
      id: crypto.randomUUID(),
      businessId,
      kind: type as 'receipt' | 'payment',
      partyId: partyId || '',
      payDate: txDate,
      mode: (mode as any) || 'bank',
      amount,
      reference: refNo || `SA-${Date.now().toString().slice(-4)}`,
    };
    memoryStore.payments.push(newPay);
    recordAuditLog({
      businessId,
      userId: currentUser.id,
      action: `SUPER_ADMIN_CREATE_${type.toUpperCase()}`,
      details: { amount, mode: newPay.mode },
    });
    return c.json({ success: true, transaction: newPay }, 201);
  }

  if (type === 'cheque') {
    const newCheque = {
      id: crypto.randomUUID(),
      businessId,
      chequeNumber: refNo || String(Math.floor(100000 + Math.random() * 900000)),
      chequeDate: txDate,
      amount,
      bankName: bankName || 'State Bank of India',
      partyId: partyId || '',
      direction: 'inward' as const,
      status: 'received' as const,
      isPdc: true,
      notes: narration || 'Super Admin Cheque Entry',
      alertsEnabled: true,
      snoozedUntil: null,
      clearingDate: null,
      bouncedDate: null,
      bounceReason: null,
      createdAt: new Date().toISOString(),
    };
    memoryStore.cheques.push(newCheque);
    recordAuditLog({
      businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_CREATE_CHEQUE',
      details: { chequeNumber: newCheque.chequeNumber, amount },
    });
    return c.json({ success: true, transaction: newCheque }, 201);
  }

  return c.json({ error: { code: 'INVALID_TYPE', message: `Unsupported transaction type: ${type}` } }, 400);
});

// PUT /api/v1/admin/transactions/:type/:id - Super Admin edits ANY transaction of ANY type
admin.put('/transactions/:type/:id', async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id');
  const body = await c.req.json();
  const currentUser = c.get('user');

  if (type === 'sales_invoice' || type === 'purchase_bill' || type === 'document') {
    const doc = memoryStore.documents.find((d) => d.id === id);
    if (!doc) return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);

    if (body.docDate) doc.docDate = body.docDate;
    if (body.dueDate !== undefined) doc.dueDate = body.dueDate;
    if (body.docNo) doc.docNo = body.docNo;
    if (body.partyId) doc.partyId = body.partyId;
    if (body.status) doc.status = body.status;
    if (body.amount !== undefined) {
      doc.total = body.amount;
      doc.subtotal = Math.round(body.amount * 0.82);
      doc.taxTotal = Math.round(body.amount * 0.18);
    }
    recordAuditLog({
      businessId: doc.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_UPDATE_DOCUMENT',
      details: { id: doc.id, docNo: doc.docNo, updates: body },
    });
    return c.json({ success: true, transaction: doc });
  }

  if (type === 'receipt' || type === 'payment') {
    const pay = memoryStore.payments.find((p) => p.id === id);
    if (!pay) return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);

    if (body.payDate) pay.payDate = body.payDate;
    if (body.amount !== undefined) pay.amount = body.amount;
    if (body.partyId) pay.partyId = body.partyId;
    if (body.reference !== undefined) pay.reference = body.reference;
    if (body.mode) pay.mode = body.mode;

    recordAuditLog({
      businessId: pay.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_UPDATE_PAYMENT',
      details: { id: pay.id, updates: body },
    });
    return c.json({ success: true, transaction: pay });
  }

  if (type === 'cheque') {
    const ch = memoryStore.cheques.find((item) => item.id === id);
    if (!ch) return c.json({ error: { code: 'NOT_FOUND', message: 'Cheque not found' } }, 404);

    if (body.chequeNumber) ch.chequeNumber = body.chequeNumber;
    if (body.chequeDate) ch.chequeDate = body.chequeDate;
    if (body.amount !== undefined) ch.amount = body.amount;
    if (body.status) ch.status = body.status;
    if (body.bankName) ch.bankName = body.bankName;
    if (body.notes !== undefined) ch.notes = body.notes;

    recordAuditLog({
      businessId: ch.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_UPDATE_CHEQUE',
      details: { id: ch.id, updates: body },
    });
    return c.json({ success: true, transaction: ch });
  }

  if (type === 'journal') {
    const j = memoryStore.journalEntries.find((item) => item.id === id);
    if (!j) return c.json({ error: { code: 'NOT_FOUND', message: 'Journal entry not found' } }, 404);

    if (body.entryDate) j.entryDate = body.entryDate;
    if (body.narration !== undefined) j.narration = body.narration;
    if (body.isVoid !== undefined) j.isVoid = body.isVoid;

    recordAuditLog({
      businessId: j.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_UPDATE_JOURNAL',
      details: { id: j.id, updates: body },
    });
    return c.json({ success: true, transaction: j });
  }

  return c.json({ error: { code: 'INVALID_TYPE', message: `Unknown transaction type: ${type}` } }, 400);
});

// DELETE /api/v1/admin/transactions/:type/:id - Super Admin permanently deletes ANY transaction
admin.delete('/transactions/:type/:id', async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id');
  const currentUser = c.get('user');

  if (type === 'sales_invoice' || type === 'purchase_bill' || type === 'document') {
    const idx = memoryStore.documents.findIndex((d) => d.id === id);
    if (idx === -1) return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
    const removed = memoryStore.documents.splice(idx, 1)[0];
    if (removed.entryId) {
      const jIdx = memoryStore.journalEntries.findIndex((j) => j.id === removed.entryId);
      if (jIdx !== -1) memoryStore.journalEntries.splice(jIdx, 1);
    }
    recordAuditLog({
      businessId: removed.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_DELETE_DOCUMENT',
      details: { id: removed.id, docNo: removed.docNo, type: removed.docType },
    });
    return c.json({ success: true, message: `Document #${removed.docNo} deleted successfully` });
  }

  if (type === 'receipt' || type === 'payment') {
    const idx = memoryStore.payments.findIndex((p) => p.id === id);
    if (idx === -1) return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
    const removed = memoryStore.payments.splice(idx, 1)[0];
    if (removed.entryId) {
      const jIdx = memoryStore.journalEntries.findIndex((j) => j.id === removed.entryId);
      if (jIdx !== -1) memoryStore.journalEntries.splice(jIdx, 1);
    }
    recordAuditLog({
      businessId: removed.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_DELETE_PAYMENT',
      details: { id: removed.id, kind: removed.kind, amount: removed.amount },
    });
    return c.json({ success: true, message: `${removed.kind} record deleted successfully` });
  }

  if (type === 'cheque') {
    const idx = memoryStore.cheques.findIndex((ch) => ch.id === id);
    if (idx === -1) return c.json({ error: { code: 'NOT_FOUND', message: 'Cheque not found' } }, 404);
    const removed = memoryStore.cheques.splice(idx, 1)[0];
    recordAuditLog({
      businessId: removed.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_DELETE_CHEQUE',
      details: { id: removed.id, chequeNumber: removed.chequeNumber },
    });
    return c.json({ success: true, message: `Cheque #${removed.chequeNumber} deleted successfully` });
  }

  if (type === 'journal') {
    const idx = memoryStore.journalEntries.findIndex((j) => j.id === id);
    if (idx === -1) return c.json({ error: { code: 'NOT_FOUND', message: 'Journal entry not found' } }, 404);
    const removed = memoryStore.journalEntries.splice(idx, 1)[0];
    recordAuditLog({
      businessId: removed.businessId,
      userId: currentUser.id,
      action: 'SUPER_ADMIN_DELETE_JOURNAL',
      details: { id: removed.id, entryNo: removed.entryNo },
    });
    return c.json({ success: true, message: `Journal Entry #${removed.entryNo} deleted successfully` });
  }

  return c.json({ error: { code: 'INVALID_TYPE', message: `Unknown transaction type: ${type}` } }, 400);
});

export { admin as adminRoutes };
