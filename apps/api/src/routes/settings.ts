import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

// Settings
export const settingsRoute = new Hono<AppContext>();
settingsRoute.use('/*', authMiddleware);

settingsRoute.get('/', requirePermission('settings', 'view'), (c) => {
  const businessId = c.get('businessId');
  const currentBiz = memoryStore.businesses.find((b) => b.id === businessId) || memoryStore.business;
  return c.json({ business: currentBiz });
});

settingsRoute.put('/', requirePermission('settings', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const currentBiz = memoryStore.businesses.find((b) => b.id === businessId) || memoryStore.business;

  if (body.name) currentBiz.name = body.name;
  if (body.gstin) currentBiz.gstin = body.gstin;
  if (body.address) currentBiz.address = body.address;
  if (body.settings) {
    currentBiz.settings = {
      ...currentBiz.settings,
      ...body.settings,
    };
  }

  recordAuditLog({
    businessId: currentBiz.id,
    userId: user.id,
    action: 'UPDATE_SETTINGS',
    entity: 'settings',
    details: body,
  });

  return c.json({ success: true, business: currentBiz });
});

// Audit Log Viewer
export const auditRoute = new Hono<AppContext>();
auditRoute.use('/*', authMiddleware);

auditRoute.get('/', requirePermission('audit_log', 'view'), (c) => {
  const businessId = c.get('businessId');
  const logs = memoryStore.auditLogs
    .filter((l) => l.businessId === businessId)
    .slice(0, 100);
  return c.json({ logs });
});

// Backup
export const backupRoute = new Hono<AppContext>();
backupRoute.use('/*', authMiddleware);

backupRoute.get('/export', requirePermission('settings', 'export'), (c) => {
  const businessId = c.get('businessId');
  const dump = {
    exportedAt: new Date().toISOString(),
    business: memoryStore.business,
    accounts: memoryStore.accounts.filter((a) => a.businessId === businessId),
    parties: memoryStore.parties.filter((p) => p.businessId === businessId),
    items: memoryStore.items.filter((i) => i.businessId === businessId),
    documents: memoryStore.documents.filter((d) => d.businessId === businessId),
    journalEntries: memoryStore.journalEntries.filter((j) => j.businessId === businessId),
    cheques: memoryStore.cheques.filter((c) => c.businessId === businessId),
    payments: memoryStore.payments.filter((p) => p.businessId === businessId),
  };
  return c.json(dump);
});
