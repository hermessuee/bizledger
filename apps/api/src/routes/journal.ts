import { Hono } from 'hono';
import { createJournalEntrySchema } from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

const journal = new Hono<AppContext>();
journal.use('/*', authMiddleware);

// GET /journal - List journal entries
journal.get('/', requirePermission('journal', 'view'), (c) => {
  const businessId = c.get('businessId');
  const list = memoryStore.journalEntries
    .filter((e) => e.businessId === businessId)
    .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

  // Enrich with account and party names
  const enriched = list.map((entry) => ({
    ...entry,
    lines: entry.lines.map((line) => {
      const acct = memoryStore.accounts.find((a) => a.id === line.accountId);
      const party = line.partyId ? memoryStore.parties.find((p) => p.id === line.partyId) : null;
      return {
        ...line,
        accountName: acct?.name || 'Unknown Account',
        accountCode: acct?.code || '',
        partyName: party?.name,
      };
    }),
  }));

  return c.json({ entries: enriched });
});

// POST /journal - Create manual journal voucher
journal.post('/', requirePermission('journal', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid journal voucher', details: parsed.error.format() } }, 400);
  }

  const entry = memoryStore.createJournalEntry({
    businessId,
    entryDate: parsed.data.entryDate,
    narration: parsed.data.narration,
    sourceType: 'manual',
    createdBy: user.id,
    lines: parsed.data.lines,
  });

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'CREATE_JOURNAL_ENTRY',
    entity: 'journal_entries',
    entityId: entry.id,
    details: { entryNo: entry.entryNo, linesCount: entry.lines.length },
  });

  return c.json({ entry }, 201);
});

// POST /journal/:id/void - Voids an entry by creating an exact reversal entry!
journal.post('/:id/void', requirePermission('journal', 'delete'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = memoryStore.journalEntries.find((e) => e.id === id && e.businessId === businessId);
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Journal entry not found' } }, 404);
  }
  if (existing.isVoid) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Journal entry is already void' } }, 400);
  }

  existing.isVoid = true;

  // Swap debits and credits for reversal
  const reversalLines = existing.lines.map((l) => ({
    accountId: l.accountId,
    partyId: l.partyId,
    debit: l.credit,
    credit: l.debit,
  }));

  const reversalEntry = memoryStore.createJournalEntry({
    businessId,
    entryDate: new Date().toISOString().split('T')[0],
    narration: `Reversal of entry ${existing.entryNo}: ${existing.narration || ''}`,
    sourceType: 'manual',
    sourceId: existing.id,
    createdBy: user.id,
    lines: reversalLines,
  });

  existing.reversalOf = reversalEntry.id;

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'VOID_JOURNAL_ENTRY',
    entity: 'journal_entries',
    entityId: existing.id,
    details: { reversalEntryNo: reversalEntry.entryNo },
  });

  return c.json({ success: true, reversalEntry });
});

export { journal as journalRoutes };
