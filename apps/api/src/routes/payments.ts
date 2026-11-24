import { Hono } from 'hono';
import { createPaymentReceiptSchema } from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

const payments = new Hono<AppContext>();
payments.use('/*', authMiddleware);

// GET /payments
payments.get('/', async (c) => {
  const businessId = c.get('businessId');
  const kind = c.req.query('kind') as 'receipt' | 'payment' | undefined;
  let list = memoryStore.payments.filter((p) => p.businessId === businessId);
  if (kind) {
    list = list.filter((p) => p.kind === kind);
  }

  const enriched = list.map((item) => {
    const party = memoryStore.parties.find((p) => p.id === item.partyId);
    return {
      ...item,
      partyName: party?.name || 'Unknown Party',
    };
  });

  return c.json({ payments: enriched });
});

// POST /payments - Record Receipt or Payment
payments.post('/', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createPaymentReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid payment data', details: parsed.error.format() } }, 400);
  }

  const data = parsed.data;

  // Determine standard accounts
  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === businessId && a.code === code);
  const arAccount = findAccountByCode('1030'); // Accounts Receivable
  const apAccount = findAccountByCode('2010'); // Accounts Payable
  const cashAccount = findAccountByCode('1010'); // Cash in Hand
  const defaultBankAccount = findAccountByCode('1020'); // HDFC Bank

  let settlementAccountId = data.bankAccountId || defaultBankAccount?.id;
  if (data.mode === 'cash' && cashAccount) {
    settlementAccountId = cashAccount.id;
  }

  if (!settlementAccountId || !arAccount || !apAccount) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Required accounts missing' } }, 500);
  }

  // Create balanced double-entry journal entry:
  // If Receipt:
  //   Debit: Bank or Cash (data.amount)
  //   Credit: Accounts Receivable (data.amount)
  // If Payment:
  //   Debit: Accounts Payable (data.amount)
  //   Credit: Bank or Cash (data.amount)
  const lines: Array<{ accountId: string; partyId?: string | null; debit: number; credit: number }> = [];

  if (data.kind === 'receipt') {
    lines.push({ accountId: settlementAccountId, debit: data.amount, credit: 0 });
    lines.push({ accountId: arAccount.id, partyId: data.partyId, debit: 0, credit: data.amount });
  } else {
    lines.push({ accountId: apAccount.id, partyId: data.partyId, debit: data.amount, credit: 0 });
    lines.push({ accountId: settlementAccountId, debit: 0, credit: data.amount });
  }

  const journalEntry = memoryStore.createJournalEntry({
    businessId,
    entryDate: data.payDate,
    narration: `${data.kind === 'receipt' ? 'Receipt' : 'Payment'} via ${data.mode.toUpperCase()}${data.reference ? ' Ref: ' + data.reference : ''}`,
    sourceType: data.kind,
    createdBy: user.id,
    lines,
  });

  const newPayment = {
    id: crypto.randomUUID(),
    businessId,
    kind: data.kind,
    partyId: data.partyId,
    payDate: data.payDate,
    mode: data.mode,
    bankAccountId: data.bankAccountId,
    chequeId: data.chequeId,
    amount: data.amount,
    reference: data.reference,
    entryId: journalEntry.id,
    allocations: data.allocations,
  };

  // Update paid_amount on allocated documents
  if (data.allocations && data.allocations.length > 0) {
    for (const alloc of data.allocations) {
      const doc = memoryStore.documents.find((d) => d.id === alloc.documentId);
      if (doc) {
        doc.paidAmount = Math.min(doc.total, doc.paidAmount + alloc.amount);
      }
    }
  }

  memoryStore.payments.push(newPayment);

  recordAuditLog({
    businessId,
    userId: user.id,
    action: `RECORD_${data.kind.toUpperCase()}`,
    entity: 'payments',
    entityId: newPayment.id,
    details: { amount: newPayment.amount, mode: newPayment.mode },
  });

  return c.json({ payment: newPayment, journalEntry }, 201);
});

export { payments as paymentRoutes };
