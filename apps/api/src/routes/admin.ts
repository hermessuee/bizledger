import { Hono } from 'hono';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { memoryStore } from '../store';
import { MenuKey, Business, MENU_KEYS } from '@bizledger/shared';
import { recordAuditLog } from '../audit';

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
  const businessesWithStats = memoryStore.businesses.map((b) => {
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

export { admin as adminRoutes };
