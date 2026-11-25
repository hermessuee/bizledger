import { Hono } from 'hono';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from '@bizledger/shared';
import { AppContext } from '../types';
import { hashPassword, verifyPassword, generateRandomHex } from '../crypto';
import { signJwt } from '../jwt';
import { memoryStore } from '../store';
import { authMiddleware } from '../middleware/auth';
import { recordAuditLog } from '../audit';

const auth = new Hono<AppContext>();
const DEFAULT_DEV_JWT_SECRET = 'bizledger-dev-super-secure-jwt-secret-key-32chars!';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.format() } }, 400);
  }

  const { usernameOrEmail, password } = parsed.data;
  const identifier = usernameOrEmail.trim().toLowerCase();

  const user = memoryStore.users.find(
    (u) =>
      u.username.toLowerCase() === identifier ||
      u.email.toLowerCase() === identifier ||
      (identifier === 'superadmin' && u.username === 'anoopsue') ||
      (identifier === 'admin@bizledger.in' && u.username === 'admin')
  );

  // Timing safe dummy hash comparison if user doesn't exist
  if (!user) {
    await verifyPassword(password, 'pbkdf2$210000$1234567890abcdef1234567890abcdef$8d8d3f669aebf3f8dc84b901b08491c1b18ce426b1fca82d6da05fec24479c32');
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' } }, 401);
  }

  // Check lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / (60 * 1000));
    return c.json({
      error: {
        code: 'ACCOUNT_LOCKED',
        message: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      },
    }, 403);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
      recordAuditLog({
        businessId: user.businessId,
        userId: user.id,
        action: 'ACCOUNT_LOCKED',
        details: { reason: '5 consecutive failed password attempts' },
      });
      return c.json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account locked for 15 minutes due to 5 failed login attempts.',
        },
      }, 403);
    }
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' } }, 401);
  }

  // Reset failed attempts on success
  user.failedAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date().toISOString();

  // Create JWT access token
  const secret = c.env?.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;
  const accessToken = await signJwt(
    {
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
    },
    secret
  );

  // Create Refresh Token
  const refreshToken = generateRandomHex(32);
  const tokenHash = await hashPassword(refreshToken, 10000);
  memoryStore.refreshTokens.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    revoked: false,
  });

  recordAuditLog({
    businessId: user.businessId,
    userId: user.id,
    action: 'USER_LOGIN',
    details: { username: user.username },
  });

  const business = memoryStore.businesses.find((b) => b.id === user.businessId) || memoryStore.business;

  return c.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      businessId: user.businessId,
      businessName: business.name,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      permissions: user.permissions,
    },
    business,
  });
});

// POST /auth/register - New Distributor Business Onboarding
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const { businessName, gstin, stateCode, address, ownerName, email, username, password } = body;

  if (!businessName || !ownerName || !email || !username || !password) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'All required fields must be filled' } }, 400);
  }

  const existing = memoryStore.users.find(
    (u) =>
      u.username.toLowerCase() === username.trim().toLowerCase() ||
      u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existing) {
    return c.json({ error: { code: 'DUPLICATE_USER', message: 'Username or Email is already registered' } }, 409);
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

  const secret = c.env?.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;
  const accessToken = await signJwt(
    {
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
    },
    secret
  );

  const refreshToken = generateRandomHex(32);
  const tokenHash = await hashPassword(refreshToken, 10000);
  memoryStore.refreshTokens.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    revoked: false,
  });

  return c.json(
    {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        businessId: user.businessId,
        businessName: business.name,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        permissions: user.permissions,
      },
      business,
    },
    201
  );
});

// POST /auth/refresh
auth.post('/refresh', async (c) => {
  const body = await c.req.json();
  const parsed = refreshTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Refresh token required' } }, 400);
  }

  const { refreshToken } = parsed.data;

  // Find valid refresh token
  const now = new Date();
  let matchedTokenRecord: typeof memoryStore.refreshTokens[0] | null = null;
  let user: typeof memoryStore.users[0] | null = null;

  for (const record of memoryStore.refreshTokens) {
    if (!record.revoked && new Date(record.expiresAt) > now) {
      const match = await verifyPassword(refreshToken, record.tokenHash);
      if (match) {
        matchedTokenRecord = record;
        user = memoryStore.users.find((u) => u.id === record.userId) || null;
        break;
      }
    }
  }

  if (!matchedTokenRecord || !user || !user.isActive) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } }, 401);
  }

  const secret = c.env?.JWT_SECRET || DEFAULT_DEV_JWT_SECRET;
  const accessToken = await signJwt(
    {
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
    },
    secret
  );

  return c.json({ accessToken });
});

// POST /auth/logout
auth.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = body.refreshToken;
  if (refreshToken) {
    for (const record of memoryStore.refreshTokens) {
      if (!record.revoked) {
        const match = await verifyPassword(refreshToken, record.tokenHash);
        if (match) {
          record.revoked = true;
          break;
        }
      }
    }
  }
  return c.json({ success: true, message: 'Logged out successfully' });
});

// Protected routes
auth.use('/*', authMiddleware);

// GET /auth/me
auth.get('/me', (c) => {
  const user = c.get('user');
  const business = memoryStore.businesses.find((b) => b.id === user.businessId) || memoryStore.business;
  return c.json({ user, business });
});

// POST /auth/change-password
auth.post('/change-password', async (c) => {
  const userSession = c.get('user');
  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid password format', details: parsed.error.format() } }, 400);
  }

  const user = memoryStore.users.find((u) => u.id === userSession.id);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const isCurrentValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Current password does not match' } }, 400);
  }

  user.passwordHash = await hashPassword(parsed.data.newPassword);
  user.mustChangePassword = false;

  recordAuditLog({
    businessId: user.businessId,
    userId: user.id,
    action: 'CHANGE_PASSWORD',
    details: { username: user.username },
  });

  return c.json({ success: true, message: 'Password changed successfully' });
});

export { auth as authRoutes };
