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

export { admin as adminRoutes };
