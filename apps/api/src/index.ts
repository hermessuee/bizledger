import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppContext, Env } from './types';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { partiesRoute, itemsRoute, accountsRoute } from './routes/masters';
import { journalRoutes } from './routes/journal';
import { documentRoutes } from './routes/documents';
import { paymentRoutes } from './routes/payments';
import { chequeRoutes } from './routes/cheques';
import { reportRoutes } from './routes/reports';
import { dashboardRoutes } from './routes/dashboard';
import { settingsRoute, auditRoute, backupRoute } from './routes/settings';
import { memoryStore } from './store';
import { formatPaise } from '@bizledger/shared';

const app = new Hono<AppContext>();

// Hydrate c.env from process.env if running on Node.js / Neon Functions
app.use('*', async (c, next) => {
  if (!c.env) {
    (c as any).env = {};
  }
  c.env.DATABASE_URL = c.env.DATABASE_URL || process.env.DATABASE_URL;
  c.env.JWT_SECRET = c.env.JWT_SECRET || process.env.JWT_SECRET || 'bizledger-super-secure-production-jwt-key-2026';
  c.env.ALLOWED_ORIGIN = c.env.ALLOWED_ORIGIN || process.env.ALLOWED_ORIGIN || '*';
  c.env.RESEND_API_KEY = c.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  c.env.EMAIL_FROM = c.env.EMAIL_FROM || process.env.EMAIL_FROM;
  await next();
});

// CORS middleware allowing GitHub Pages, custom domains, and localhost
app.use('*', async (c, next) => {
  return cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })(c, next);
});

// Standard Security Headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Standard Error Handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
      },
    },
    500
  );
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Mount API v1 routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/parties', partiesRoute);
app.route('/api/v1/items', itemsRoute);
app.route('/api/v1/accounts', accountsRoute);
app.route('/api/v1/journal', journalRoutes);
app.route('/api/v1/documents', documentRoutes);
app.route('/api/v1/payments', paymentRoutes);
app.route('/api/v1/cheques', chequeRoutes);
app.route('/api/v1/reports', reportRoutes);
app.route('/api/v1/dashboard', dashboardRoutes);
app.route('/api/v1/settings', settingsRoute);
app.route('/api/v1/audit-log', auditRoute);
app.route('/api/v1/backup', backupRoute);

export { app };

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger scheduled handler
  // Runs daily at 8:00 AM IST (02:30 UTC) to send cheque alert digest and flag stale cheques
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Daily Cheque Reminder & Stale Processing triggered');
    const today = new Date().toISOString().split('T')[0];

    // 1. Process Stale Cheques (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().split('T')[0];

    let staleCount = 0;
    for (const chq of memoryStore.cheques) {
      if (chq.status === 'pending' && chq.chequeDate < cutoff) {
        chq.status = 'stale';
        staleCount++;
      }
    }
    console.log(`[Cron] Marked ${staleCount} cheques as stale`);

    // 2. Identify due soon & overdue cheques for email digest
    const dueSoonCutoffDate = new Date();
    dueSoonCutoffDate.setDate(dueSoonCutoffDate.getDate() + 7);
    const dueSoonCutoff = dueSoonCutoffDate.toISOString().split('T')[0];

    const urgentCheques = memoryStore.cheques.filter(
      (c) => (c.status === 'pending' || c.status === 'deposited') && c.chequeDate <= dueSoonCutoff
    );

    if (urgentCheques.length > 0 && env.RESEND_API_KEY) {
      // Find active owner/accountant users
      const recipients = memoryStore.users.filter(
        (u) => u.isActive && (u.role === 'owner' || u.role === 'accountant')
      );

      for (const recipient of recipients) {
        try {
          const listHtml = urgentCheques
            .map(
              (c) => `<li>[${c.direction.toUpperCase()}] Cheque #${c.chequeNo} | Date: ${c.chequeDate} | Amount: ${formatPaise(c.amount, { showSymbol: true })}</li>`
            )
            .join('');

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM || 'BizLedger <notifications@bizledger.local>',
              to: [recipient.email],
              subject: `BizLedger Daily Cheque Digest: ${urgentCheques.length} Cheque(s) Due or Overdue`,
              html: `<p>Hello ${recipient.name},</p>
                     <p>Here is your daily cheque digest for ${today}:</p>
                     <ul>${listHtml}</ul>
                     <p>Please log in to BizLedger to take action.</p>`,
            }),
          });

          // Log in reminderLog
          for (const chq of urgentCheques) {
            memoryStore.reminderLogs.push({
              chequeId: chq.id,
              userId: recipient.id,
              sentOn: today,
            });
          }
        } catch (err) {
          console.error(`[Cron] Failed to send digest to ${recipient.email}:`, err);
        }
      }
    }
  },
};
