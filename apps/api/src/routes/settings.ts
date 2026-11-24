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
  return c.json({ business: memoryStore.business });
});

settingsRoute.put('/', requirePermission('settings', 'edit'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (body.name) memoryStore.business.name = body.name;
  if (body.gstin) memoryStore.business.gstin = body.gstin;
  if (body.address) memoryStore.business.address = body.address;
  if (body.settings) {
    memoryStore.business.settings = {
      ...memoryStore.business.settings,
      ...body.settings,
    };
  }

  recordAuditLog({
    businessId: memoryStore.business.id,
    userId: user.id,
    action: 'UPDATE_SETTINGS',
    entity: 'settings',
    details: body,
  });

  return c.json({ success: true, business: memoryStore.business });
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
