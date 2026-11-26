import { Hono } from 'hono';
import {
  createChequeSchema,
  updateChequeStatusSchema,
  snoozeChequeSchema,
  ChequeItem,
  ChequeAlertsResponse,
} from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

const cheques = new Hono<AppContext>();
cheques.use('/*', authMiddleware);

// Helper: auto-flag stale cheques (cheque date older than 90 days / 3 months)
function checkAndFlagStaleCheques(businessId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split('T')[0];

  for (const chq of memoryStore.cheques) {
    if (chq.businessId === businessId && chq.status === 'pending' && chq.chequeDate < cutoff) {
      chq.status = 'stale';
      recordAuditLog({
        businessId,
        action: 'CHEQUE_AUTO_STALE',
        entity: 'cheques',
        entityId: chq.id,
        details: { chequeNo: chq.chequeNo, chequeDate: chq.chequeDate },
      });
    }
  }
}

// GET /cheques/alerts - Pop-up alert items: Overdue, Due Today, Upcoming
cheques.get('/alerts', requirePermission('cheques', 'view'), (c) => {
  const businessId = c.get('businessId');
  checkAndFlagStaleCheques(businessId);

  const today = new Date().toISOString().split('T')[0];
  const currentBiz = memoryStore.businesses.find((b) => b.id === businessId) || memoryStore.business;
  const settings = currentBiz.settings || {};
  const alertDays = (settings.alertDaysBefore && settings.alertDaysBefore[0]) || 7;

  const upcomingCutoffDate = new Date();
  upcomingCutoffDate.setDate(upcomingCutoffDate.getDate() + alertDays);
  const upcomingCutoff = upcomingCutoffDate.toISOString().split('T')[0];

  const overdue: ChequeItem[] = [];
  const dueToday: ChequeItem[] = [];
  const upcoming: ChequeItem[] = [];

  for (const chq of memoryStore.cheques) {
    if (chq.businessId !== businessId) continue;
    // Skip if cleared, bounced, cancelled, stale, replaced
    if (chq.status !== 'pending' && chq.status !== 'deposited') continue;

    // Check snoozed_until
    if (chq.snoozedUntil && chq.snoozedUntil > today) {
      continue;
    }

    // Party details
    const party = memoryStore.parties.find((p) => p.id === chq.partyId);
    const enriched: ChequeItem = {
      ...chq,
      partyName: party?.name || 'Unknown Party',
    };

    if (chq.chequeDate < today) {
      overdue.push(enriched);
    } else if (chq.chequeDate === today) {
      dueToday.push(enriched);
    } else if (chq.chequeDate <= upcomingCutoff) {
      upcoming.push(enriched);
    }
  }

  const response: ChequeAlertsResponse = {
    overdue,
    dueToday,
    upcoming,
    totalCount: overdue.length + dueToday.length + upcoming.length,
  };

  return c.json(response);
});

// GET /cheques - Cheque register with filters
cheques.get('/', requirePermission('cheques', 'view'), (c) => {
  const businessId = c.get('businessId');
  checkAndFlagStaleCheques(businessId);

  const direction = c.req.query('direction');
  const status = c.req.query('status');
  const partyId = c.req.query('partyId');

  let list = memoryStore.cheques.filter((chq) => chq.businessId === businessId);
  if (direction) {
    list = list.filter((chq) => chq.direction === direction);
  }
  if (status) {
    list = list.filter((chq) => chq.status === status);
  }
  if (partyId) {
    list = list.filter((chq) => chq.partyId === partyId);
  }

  // Sort by chequeDate asc
  list.sort((a, b) => (a.chequeDate > b.chequeDate ? 1 : -1));

  const enriched = list.map((chq) => {
    const party = memoryStore.parties.find((p) => p.id === chq.partyId);
    return {
      ...chq,
      partyName: party?.name || 'Unknown Party',
    };
  });

  return c.json({ cheques: enriched });
});

// POST /cheques - Add a new cheque (Received PDC or Issued)
cheques.post('/', requirePermission('cheques', 'create'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createChequeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid cheque input', details: parsed.error.format() } }, 400);
  }

  const data = parsed.data;
  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);

  const newCheque: ChequeItem = {
    id: crypto.randomUUID(),
    businessId,
    direction: data.direction,
    partyId: data.partyId,
    chequeNo: data.chequeNo,
    bankName: data.bankName,
    branch: data.branch,
    bankAccountId: data.bankAccountId,
    amount: data.amount,
    chequeDate: data.chequeDate,
    txnDate: data.txnDate,
    status: 'pending',
    remarks: data.remarks,
    createdAt: new Date().toISOString(),
  };

  // If received post-dated cheque, create initial journal entry:
  // Debit: Cheques in Hand (1040)
  // Credit: Accounts Receivable (1030)
  if (data.direction === 'received') {
    const chequesInHand = findAccountByCode('1040');
    const arAccount = findAccountByCode('1030');
    if (chequesInHand && arAccount) {
      memoryStore.createJournalEntry({
        businessId,
        entryDate: data.txnDate,
        narration: `Received PDC #${data.chequeNo} dated ${data.chequeDate}`,
        sourceType: 'cheque',
        sourceId: newCheque.id,
        createdBy: user.id,
        lines: [
          { accountId: chequesInHand.id, debit: data.amount, credit: 0 },
          { accountId: arAccount.id, partyId: data.partyId, debit: 0, credit: data.amount },
        ],
      });
    }
  } else if (data.direction === 'issued') {
    // If issued cheque:
    // Debit: Accounts Payable (2010)
    // Credit: Cheques Issued Clearing (2020)
    const apAccount = findAccountByCode('2010');
    const chequesIssuedAccount = findAccountByCode('2020');
    if (apAccount && chequesIssuedAccount) {
      memoryStore.createJournalEntry({
        businessId,
        entryDate: data.txnDate,
        narration: `Issued Cheque #${data.chequeNo} dated ${data.chequeDate}`,
        sourceType: 'cheque',
        sourceId: newCheque.id,
        createdBy: user.id,
        lines: [
          { accountId: apAccount.id, partyId: data.partyId, debit: data.amount, credit: 0 },
          { accountId: chequesIssuedAccount.id, debit: 0, credit: data.amount },
        ],
      });
    }
  }

  memoryStore.cheques.push(newCheque);

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'CREATE_CHEQUE',
    entity: 'cheques',
    entityId: newCheque.id,
    details: { chequeNo: newCheque.chequeNo, amount: newCheque.amount, direction: newCheque.direction },
  });

  return c.json({ cheque: newCheque }, 201);
});

// POST /cheques/:id/status - Status transitions with accounting entries!
// Workflow: PENDING -> DEPOSITED -> CLEARED or BOUNCED
cheques.post('/:id/status', requirePermission('cheques', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateChequeStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status data', details: parsed.error.format() } }, 400);
  }

  const chq = memoryStore.cheques.find((c) => c.id === id && c.businessId === businessId);
  if (!chq) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cheque not found' } }, 404);
  }

  const { status, bounceReason, bankCharges = 0, depositBankAccountId } = parsed.data;
  const oldStatus = chq.status;
  chq.status = status;
  if (bounceReason) chq.bounceReason = bounceReason;
  if (bankCharges) chq.bankCharges = bankCharges;

  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);
  const bankAccount = depositBankAccountId
    ? memoryStore.accounts.find((a) => a.id === depositBankAccountId)
    : findAccountByCode('1020'); // HDFC Bank
  const chequesInHand = findAccountByCode('1040');
  const arAccount = findAccountByCode('1030');
  const apAccount = findAccountByCode('2010');
  const chequesIssuedAccount = findAccountByCode('2020');
  const bankChargesAccount = findAccountByCode('5040');

  const today = new Date().toISOString().split('T')[0];

  // Perform accounting journal entry based on transition
  if (status === 'cleared') {
    if (chq.direction === 'received' && bankAccount && chequesInHand) {
      // Received cheque cleared:
      // Debit: Bank Account (1020)
      // Credit: Cheques in Hand (1040)
      memoryStore.createJournalEntry({
        businessId,
        entryDate: today,
        narration: `Cheque #${chq.chequeNo} cleared in bank`,
        sourceType: 'cheque',
        sourceId: chq.id,
        createdBy: user.id,
        lines: [
          { accountId: bankAccount.id, debit: chq.amount, credit: 0 },
          { accountId: chequesInHand.id, debit: 0, credit: chq.amount },
        ],
      });
    } else if (chq.direction === 'issued' && bankAccount && chequesIssuedAccount) {
      // Issued cheque cleared:
      // Debit: Cheques Issued Clearing (2020)
      // Credit: Bank Account (1020)
      memoryStore.createJournalEntry({
        businessId,
        entryDate: today,
        narration: `Issued Cheque #${chq.chequeNo} presented and cleared`,
        sourceType: 'cheque',
        sourceId: chq.id,
        createdBy: user.id,
        lines: [
          { accountId: chequesIssuedAccount.id, debit: chq.amount, credit: 0 },
          { accountId: bankAccount.id, debit: 0, credit: chq.amount },
        ],
      });
    }
  } else if (status === 'bounced') {
    // Received cheque bounced:
    // Debit: Accounts Receivable (reopens customer outstanding)
    // Optional Debit: Bank Charges (5040)
    // Credit: Cheques in Hand or Bank (depending on if it was deposited/cleared previously)
    if (chq.direction === 'received' && arAccount && chequesInHand) {
      const creditAccount = (oldStatus === 'cleared' && bankAccount) ? bankAccount : chequesInHand;
      const lines = [
        { accountId: arAccount.id, partyId: chq.partyId, debit: chq.amount + bankCharges, credit: 0 },
        { accountId: creditAccount.id, debit: 0, credit: chq.amount },
      ];
      if (bankCharges > 0 && bankChargesAccount) {
        // If bank charges occurred, credit bank account for the charge
        lines.push({ accountId: bankChargesAccount.id, debit: bankCharges, credit: 0 });
        if (bankAccount) {
          lines.push({ accountId: bankAccount.id, debit: 0, credit: bankCharges });
        }
      }
      memoryStore.createJournalEntry({
        businessId,
        entryDate: today,
        narration: `Cheque #${chq.chequeNo} BOUNCED: ${bounceReason || 'Insufficient funds'}. Reopened receivable.`,
        sourceType: 'cheque',
        sourceId: chq.id,
        createdBy: user.id,
        lines,
      });
    }
  }

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'UPDATE_CHEQUE_STATUS',
    entity: 'cheques',
    entityId: chq.id,
    details: { oldStatus, newStatus: status, bounceReason, bankCharges },
  });

  return c.json({ success: true, cheque: chq });
});

// POST /cheques/:id/snooze - Snooze alert for 1 to 30 days
cheques.post('/:id/snooze', requirePermission('cheques', 'edit'), async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = snoozeChequeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid snooze days' } }, 400);
  }

  const chq = memoryStore.cheques.find((c) => c.id === id && c.businessId === businessId);
  if (!chq) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Cheque not found' } }, 404);
  }

  const snoozeDate = new Date();
  snoozeDate.setDate(snoozeDate.getDate() + parsed.data.days);
  chq.snoozedUntil = snoozeDate.toISOString().split('T')[0];

  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'SNOOZE_CHEQUE',
    entity: 'cheques',
    entityId: chq.id,
    details: { snoozedUntil: chq.snoozedUntil, days: parsed.data.days },
  });

  return c.json({ success: true, cheque: chq });
});

export { cheques as chequeRoutes };
