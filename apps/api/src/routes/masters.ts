import { Hono } from 'hono';
import {
  createPartySchema,
  createItemSchema,
  createAccountSchema,
} from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

export const partiesRoute = new Hono<AppContext>();
partiesRoute.use('/*', authMiddleware);

partiesRoute.get('/', requirePermission('customers', 'view'), (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');
  const kind = c.req.query('kind'); // 'customer' | 'vendor'

  let list = isAll ? memoryStore.parties : memoryStore.parties.filter((p) => p.businessId === businessId);
  if (kind) {
    list = list.filter((p) => p.kind === kind || p.kind === 'both');
  }

  // Calculate current balances from journal lines
  const enriched = list.map((party) => {
    let balance = party.openingBalance;
    for (const entry of memoryStore.journalEntries) {
      if (entry.businessId === party.businessId && !entry.isVoid) {
        for (const line of entry.lines) {
          if (line.partyId === party.id) {
            // Debit increases customer balance (receivable), credit decreases
            if (party.kind === 'customer') {
              balance += line.debit - line.credit;
            } else {
              balance += line.credit - line.debit;
            }
          }
        }
      }
    }
    const distBiz = memoryStore.businesses.find((b) => b.id === party.businessId);
    return {
      ...party,
      distributorName: distBiz?.name || 'Distributor',
      currentBalance: balance,
    };
  });

  return c.json({ parties: enriched });
});

partiesRoute.post('/', requirePermission('customers', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();
  const parsed = createPartySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid party data', details: parsed.error.format() } }, 400);
  }

  const targetBusinessId = (isSuperAdmin && (body.businessId || body.targetBusinessId))
    ? (body.businessId || body.targetBusinessId)
    : (businessId !== 'all' ? businessId : (memoryStore.businesses[0]?.id || '11111111-1111-1111-1111-111111111111'));

  const newParty = {
    id: crypto.randomUUID(),
    businessId: targetBusinessId,
    ...parsed.data,
    currentBalance: parsed.data.openingBalance,
  };

  memoryStore.parties.push(newParty);

  recordAuditLog({
    businessId: targetBusinessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_CREATE_PARTY' : 'CREATE_PARTY',
    entity: 'parties',
    entityId: newParty.id,
    details: { name: newParty.name, kind: newParty.kind },
  });

  return c.json({ party: newParty }, 201);
});

// PUT /parties/:id - Edit customer or vendor details (including enable/disable isActive)
partiesRoute.put('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();

  const party = memoryStore.parties.find((p) => p.id === id && (isSuperAdmin || p.businessId === businessId));
  if (!party) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);
  }

  if (body.name !== undefined) party.name = body.name.trim();
  if (body.gstin !== undefined) party.gstin = body.gstin ? body.gstin.trim().toUpperCase() : null;
  if (body.phone !== undefined) party.phone = body.phone ? body.phone.trim() : null;
  if (body.email !== undefined) party.email = body.email ? body.email.trim() : null;
  if (body.address !== undefined) party.address = body.address ? body.address.trim() : null;
  if (body.creditDays !== undefined) party.creditDays = Number(body.creditDays) || 30;
  if (body.isActive !== undefined) party.isActive = Boolean(body.isActive);
  if (isSuperAdmin && body.businessId) party.businessId = body.businessId;

  recordAuditLog({
    businessId: party.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_UPDATE_PARTY' : 'UPDATE_PARTY',
    entity: 'parties',
    entityId: party.id,
    details: { name: party.name, isActive: party.isActive },
  });

  return c.json({ success: true, party });
});

// DELETE /parties/:id - Delete party (Super Admin master authority)
partiesRoute.delete('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const idx = memoryStore.parties.findIndex((p) => p.id === id && (isSuperAdmin || p.businessId === businessId));
  if (idx === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Party not found' } }, 404);
  }

  const deleted = memoryStore.parties.splice(idx, 1)[0];

  recordAuditLog({
    businessId: deleted.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_DELETE_PARTY' : 'DELETE_PARTY',
    entity: 'parties',
    entityId: id,
    details: { name: deleted.name },
  });

  return c.json({ success: true, message: 'Party removed successfully' });
});

// Items & Services
export const itemsRoute = new Hono<AppContext>();
itemsRoute.use('/*', authMiddleware);

itemsRoute.get('/', requirePermission('items', 'view'), (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');

  let list = isAll ? memoryStore.items : memoryStore.items.filter((i) => i.businessId === businessId);
  const enriched = list.map((item) => {
    const distBiz = memoryStore.businesses.find((b) => b.id === item.businessId);
    return {
      ...item,
      distributorName: distBiz?.name || 'Distributor',
    };
  });
  return c.json({ items: enriched });
});

itemsRoute.post('/', requirePermission('items', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item data', details: parsed.error.format() } }, 400);
  }

  const targetBusinessId = (isSuperAdmin && (body.businessId || body.targetBusinessId))
    ? (body.businessId || body.targetBusinessId)
    : (businessId !== 'all' ? businessId : (memoryStore.businesses[0]?.id || '11111111-1111-1111-1111-111111111111'));

  const newItem = {
    id: crypto.randomUUID(),
    businessId: targetBusinessId,
    ...parsed.data,
  };

  memoryStore.items.push(newItem);

  recordAuditLog({
    businessId: targetBusinessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_CREATE_ITEM' : 'CREATE_ITEM',
    entity: 'items',
    entityId: newItem.id,
    details: { name: newItem.name, hsnSac: newItem.hsnSac },
  });

  return c.json({ item: newItem }, 201);
});

// PUT /items/:id - Edit item details (including unit and enable/disable isActive)
itemsRoute.put('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();

  const item = memoryStore.items.find((i) => i.id === id && (isSuperAdmin || i.businessId === businessId));
  if (!item) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404);
  }

  if (body.name !== undefined) item.name = body.name.trim();
  if (body.hsnSac !== undefined) item.hsnSac = body.hsnSac ? body.hsnSac.trim() : null;
  if (body.unit !== undefined) item.unit = body.unit.trim().toUpperCase() || 'PCS';
  if (body.salePrice !== undefined) item.salePrice = Math.round(Number(body.salePrice));
  if (body.purchasePrice !== undefined) item.purchasePrice = Math.round(Number(body.purchasePrice));
  if (body.gstRate !== undefined) item.gstRate = Number(body.gstRate);
  if (body.stockQty !== undefined) item.stockQty = Number(body.stockQty);
  if (body.isActive !== undefined) item.isActive = Boolean(body.isActive);
  if (isSuperAdmin && body.businessId) item.businessId = body.businessId;

  recordAuditLog({
    businessId: item.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_UPDATE_ITEM' : 'UPDATE_ITEM',
    entity: 'items',
    entityId: item.id,
    details: { name: item.name, unit: item.unit, isActive: item.isActive },
  });

  return c.json({ success: true, item });
});

// DELETE /items/:id - Delete item (Super Admin master authority)
itemsRoute.delete('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const idx = memoryStore.items.findIndex((i) => i.id === id && (isSuperAdmin || i.businessId === businessId));
  if (idx === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404);
  }

  const deleted = memoryStore.items.splice(idx, 1)[0];

  recordAuditLog({
    businessId: deleted.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_DELETE_ITEM' : 'DELETE_ITEM',
    entity: 'items',
    entityId: id,
    details: { name: deleted.name },
  });

  return c.json({ success: true, message: 'Item removed successfully' });
});

// Chart of Accounts
export const accountsRoute = new Hono<AppContext>();
accountsRoute.use('/*', authMiddleware);

accountsRoute.get('/', requirePermission('chart_of_accounts', 'view'), (c) => {
  const businessId = c.get('businessId');
  const list = memoryStore.accounts.filter((a) => a.businessId === businessId);
  return c.json({ accounts: list });
});

accountsRoute.post('/', requirePermission('chart_of_accounts', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid account data', details: parsed.error.format() } }, 400);
  }

  // Check unique code
  if (memoryStore.accounts.some((a) => a.businessId === businessId && a.code === parsed.data.code)) {
    return c.json({ error: { code: 'CONFLICT', message: 'Account code already exists' } }, 409);
  }

  const newAccount = {
    id: crypto.randomUUID(),
    businessId,
    ...parsed.data,
    isSystem: false,
    isActive: true,
  };

  memoryStore.accounts.push(newAccount);

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'CREATE_ACCOUNT',
    entity: 'accounts',
    entityId: newAccount.id,
    details: { code: newAccount.code, name: newAccount.name },
  });

  return c.json({ account: newAccount }, 201);
});
