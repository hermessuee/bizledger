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
  const kind = c.req.query('kind'); // 'customer' | 'vendor'
  let list = memoryStore.parties.filter((p) => p.businessId === businessId);
  if (kind) {
    list = list.filter((p) => p.kind === kind || p.kind === 'both');
  }

  // Calculate current balances from journal lines
  const enriched = list.map((party) => {
    let balance = party.openingBalance;
    for (const entry of memoryStore.journalEntries) {
      if (!entry.isVoid) {
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
    return { ...party, currentBalance: balance };
  });

  return c.json({ parties: enriched });
});

partiesRoute.post('/', requirePermission('customers', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createPartySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid party data', details: parsed.error.format() } }, 400);
  }

  const newParty = {
    id: crypto.randomUUID(),
    businessId,
    ...parsed.data,
    currentBalance: parsed.data.openingBalance,
  };

  memoryStore.parties.push(newParty);

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'CREATE_PARTY',
    entity: 'parties',
    entityId: newParty.id,
    details: { name: newParty.name, kind: newParty.kind },
  });

  return c.json({ party: newParty }, 201);
});

// Items & Services
export const itemsRoute = new Hono<AppContext>();
itemsRoute.use('/*', authMiddleware);

itemsRoute.get('/', requirePermission('items', 'view'), (c) => {
  const businessId = c.get('businessId');
  const list = memoryStore.items.filter((i) => i.businessId === businessId);
  return c.json({ items: list });
});

itemsRoute.post('/', requirePermission('items', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item data', details: parsed.error.format() } }, 400);
  }

  const newItem = {
    id: crypto.randomUUID(),
    businessId,
    ...parsed.data,
  };

  memoryStore.items.push(newItem);

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'CREATE_ITEM',
    entity: 'items',
    entityId: newItem.id,
    details: { name: newItem.name, hsnSac: newItem.hsnSac },
  });

  return c.json({ item: newItem }, 201);
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
