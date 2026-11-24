import { MiddlewareHandler } from 'hono';
import { AppContext } from '../types';
import { verifyJwt } from '../jwt';
import { memoryStore } from '../store';

const DEFAULT_DEV_JWT_SECRET = 'bizledger-dev-super-secure-jwt-secret-key-32chars!';

export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      401
    );
  }

  const token = authHeader.substring(7).trim();
  const secret = c.env?.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;

  const payload = await verifyJwt(token, secret);
  if (!payload) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Token is invalid or expired' } },
      401
    );
  }

  // Find user in store
  const user = memoryStore.users.find(
    (u) => u.id === payload.sub && u.businessId === payload.businessId
  );

  if (!user) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'User account not found' } },
      401
    );
  }

  if (!user.isActive) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'User account has been deactivated' } },
      403
    );
  }

  // Check lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return c.json(
      {
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to multiple failed logins. Try again later.',
        },
      },
      403
    );
  }

  c.set('user', {
    id: user.id,
    businessId: user.businessId,
    businessName: memoryStore.business.name,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    permissions: user.permissions,
  });
  c.set('businessId', user.businessId);

  await next();
};
