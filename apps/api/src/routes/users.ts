import { Hono } from 'hono';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  updatePermissionsSchema,
  MENU_KEYS,
  MenuKey,
} from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { hashPassword } from '../crypto';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

const users = new Hono<AppContext>();

users.use('/*', authMiddleware);

// GET /users - list all users for the current business (strictly excludes any Super Admin)
users.get('/', requirePermission('users', 'view'), (c) => {
  const businessId = c.get('businessId');
  const userList = memoryStore.users
    .filter((u) => u.businessId === businessId && u.role !== 'super_admin' && u.username !== 'anoopsue')
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      permissions: u.permissions,
    }));

  return c.json({ users: userList });
});

// POST /users - add a new user
users.post('/', requirePermission('users', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const currentUser = c.get('user');
  const body = await c.req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid user data', details: parsed.error.format() } }, 400);
  }

  const data = parsed.data;

  // Strict: Super Admin can never be created from regular business user management
  if (data.role === 'super_admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Super Administrator cannot be created from tenant user management' } }, 403);
  }

  // Check unique username and email
  const existingUser = memoryStore.users.find(
    (u) =>
      u.email.toLowerCase() === data.email.toLowerCase() ||
      (u.businessId === businessId && u.username.toLowerCase() === data.username.toLowerCase())
  );
  if (existingUser) {
    return c.json({ error: { code: 'CONFLICT', message: 'Username or email already exists' } }, 409);
  }

  const passwordHash = await hashPassword(data.password);
  const permissions: any = {};
  for (const key of MENU_KEYS) {
    const provided = data.permissions?.find((p) => p.menuKey === key);
    permissions[key] = provided || {
      canView: data.role === 'owner',
      canCreate: data.role === 'owner',
      canEdit: data.role === 'owner',
      canDelete: data.role === 'owner',
      canExport: data.role === 'owner',
    };
  }

  const newUser = {
    id: crypto.randomUUID(),
    businessId,
    name: data.name,
    username: data.username,
    email: data.email,
    passwordHash,
    role: data.role,
    isActive: data.isActive,
    mustChangePassword: data.mustChangePassword,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    permissions,
  };

  memoryStore.users.push(newUser);

  recordAuditLog({
    businessId,
    userId: currentUser.id,
    action: 'CREATE_USER',
    entity: 'users',
    entityId: newUser.id,
    details: { username: newUser.username, role: newUser.role },
  });

  return c.json(
    {
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        mustChangePassword: newUser.mustChangePassword,
        permissions: newUser.permissions,
        createdAt: newUser.createdAt,
      },
    },
    201
  );
});

// PUT /users/:id - update user details (role, status)
users.put('/:id', requirePermission('users', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const currentUser = c.get('user');
  const id = c.req.param('id');
  const user = memoryStore.users.find((u) => u.id === id && u.businessId === businessId && u.role !== 'super_admin');
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.format() } }, 400);
  }

  const data = parsed.data;
  if (data.role === 'super_admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot assign Super Administrator role' } }, 403);
  }
  if (data.name !== undefined) user.name = data.name;
  if (data.email !== undefined) user.email = data.email;
  if (data.role !== undefined) user.role = data.role;
  if (data.isActive !== undefined) user.isActive = data.isActive;
  if (data.mustChangePassword !== undefined) user.mustChangePassword = data.mustChangePassword;

  recordAuditLog({
    businessId,
    userId: currentUser.id,
    action: 'UPDATE_USER',
    entity: 'users',
    entityId: user.id,
    details: data,
  });

  return c.json({ success: true, user });
});

// POST /users/:id/reset-password - admin resets user password
users.post('/:id/reset-password', requirePermission('users', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const currentUser = c.get('user');
  const id = c.req.param('id');
  const user = memoryStore.users.find((u) => u.id === id && u.businessId === businessId);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const body = await c.req.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid password format', details: parsed.error.format() } }, 400);
  }

  user.passwordHash = await hashPassword(parsed.data.password);
  user.mustChangePassword = parsed.data.mustChangePassword;
  user.failedAttempts = 0;
  user.lockedUntil = null;

  recordAuditLog({
    businessId,
    userId: currentUser.id,
    action: 'RESET_USER_PASSWORD',
    entity: 'users',
    entityId: user.id,
    details: { mustChangePassword: user.mustChangePassword },
  });

  return c.json({ success: true, message: 'Password reset successfully' });
});

// PUT /users/:id/permissions - update granular menu permissions checklist
users.put('/:id/permissions', requirePermission('users', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const currentUser = c.get('user');
  const id = c.req.param('id');
  const user = memoryStore.users.find((u) => u.id === id && u.businessId === businessId);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const body = await c.req.json();
  const parsed = updatePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid permissions format', details: parsed.error.format() } }, 400);
  }

  for (const perm of parsed.data.permissions) {
    user.permissions[perm.menuKey] = {
      canView: perm.canView,
      canCreate: perm.canCreate,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
      canExport: perm.canExport,
    };
  }

  recordAuditLog({
    businessId,
    userId: currentUser.id,
    action: 'UPDATE_USER_PERMISSIONS',
    entity: 'users',
    entityId: user.id,
    details: { permissions: user.permissions },
  });

  return c.json({ success: true, permissions: user.permissions });
});

export { users as userRoutes };
