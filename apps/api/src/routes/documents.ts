import { Hono } from 'hono';
import {
  createDocumentSchema,
  DocumentType,
  paiseToWords,
  formatPaise,
  calculateLineTax,
  calculateRoundOff,
} from '@bizledger/shared';
import { AppContext } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { memoryStore } from '../store';
import { recordAuditLog } from '../audit';

const documents = new Hono<AppContext>();
documents.use('/*', authMiddleware);

// GET /documents - List invoices, bills, credit/debit notes
documents.get('/', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const type = c.req.query('type') as DocumentType | undefined;
  const isSuperAdmin = user.role === 'super_admin';
  const isAll = isSuperAdmin && (!businessId || businessId === 'all' || businessId === '00000000-0000-0000-0000-000000000000');

  let list = isAll ? memoryStore.documents : memoryStore.documents.filter((d) => d.businessId === businessId);
  if (type) {
    list = list.filter((d) => d.docType === type);
  }

  // Enrich with party and distributor details
  const enriched = list.map((doc) => {
    const party = memoryStore.parties.find((p) => p.id === doc.partyId);
    const distBiz = memoryStore.businesses.find((b) => b.id === doc.businessId);
    return {
      ...doc,
      distributorName: distBiz?.name || 'Distributor',
      partyName: party?.name || 'Unknown Party',
      partyGstin: party?.gstin,
    };
  });

  return c.json({ documents: enriched });
});

// POST /documents - Create draft document
documents.post('/', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid document', details: parsed.error.format() } }, 400);
  }

  const data = parsed.data;
  const currentFy = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;
  const docNo = data.docNo || memoryStore.getNextDocNo(data.docType, currentFy);

  // Target distributor resolution
  const targetBusinessId = (isSuperAdmin && (body.businessId || body.targetBusinessId))
    ? (body.businessId || body.targetBusinessId)
    : (businessId !== 'all' ? businessId : (memoryStore.businesses[0]?.id || '11111111-1111-1111-1111-111111111111'));

  const newDoc = {
    id: crypto.randomUUID(),
    businessId: targetBusinessId,
    docType: data.docType,
    docNo,
    docDate: data.docDate,
    dueDate: data.dueDate,
    partyId: data.partyId,
    placeOfSupply: data.placeOfSupply,
    subtotal: data.subtotal,
    taxTotal: data.taxTotal,
    roundOff: data.roundOff,
    total: data.total,
    paidAmount: 0,
    status: 'draft' as const,
    lines: data.lines.map((l) => ({
      id: crypto.randomUUID(),
      ...l,
      unit: l.unit || 'PCS',
    })),
  };

  memoryStore.documents.push(newDoc);

  recordAuditLog({
    businessId: targetBusinessId,
    userId: user.id,
    action: 'CREATE_DOCUMENT',
    entity: 'documents',
    entityId: newDoc.id,
    details: { docType: newDoc.docType, docNo: newDoc.docNo, total: newDoc.total },
  });

  return c.json({ document: newDoc }, 201);
});

// PUT /documents/:id - Edit document (Super Admin has unrestricted power override across all distributors)
documents.put('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const doc = memoryStore.documents.find((d) => d.id === id && (isSuperAdmin || d.businessId === businessId));
  if (!doc) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  // Non-super-admin cannot edit posted or locked documents
  if (!isSuperAdmin && doc.status === 'posted') {
    return c.json(
      {
        error: {
          code: 'DOCUMENT_LOCKED',
          message:
            'This entry has already been Saved & Locked to accounting ledgers and CANNOT be edited. Edits are permanently locked to preserve accounting integrity.',
        },
      },
      403
    );
  }

  if (!isSuperAdmin && doc.status === 'void') {
    return c.json(
      {
        error: {
          code: 'DOCUMENT_VOID',
          message: 'Voided documents cannot be edited.',
        },
      },
      400
    );
  }

  const body = await c.req.json();
  if (body.docDate) doc.docDate = body.docDate;
  if (body.dueDate !== undefined) doc.dueDate = body.dueDate;
  if (body.partyId) doc.partyId = body.partyId;
  if (body.placeOfSupply) doc.placeOfSupply = body.placeOfSupply;
  if (body.docNo) doc.docNo = body.docNo;
  if (body.subtotal !== undefined) doc.subtotal = body.subtotal;
  if (body.taxTotal !== undefined) doc.taxTotal = body.taxTotal;
  if (body.roundOff !== undefined) doc.roundOff = body.roundOff;
  if (body.total !== undefined) doc.total = body.total;
  if (isSuperAdmin && body.businessId) doc.businessId = body.businessId;
  if (Array.isArray(body.lines)) {
    doc.lines = body.lines.map((l: any) => ({
      id: l.id || crypto.randomUUID(),
      ...l,
      unit: l.unit || 'PCS',
    }));
  }

  recordAuditLog({
    businessId: doc.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_UPDATE_DOCUMENT' : 'UPDATE_DOCUMENT',
    entity: 'documents',
    entityId: doc.id,
    details: { docNo: doc.docNo, total: doc.total, status: doc.status },
  });

  return c.json({ success: true, document: doc });
});

// DELETE /documents/:id - Delete document (Super Admin has unrestricted authority)
documents.delete('/:id', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const docIdx = memoryStore.documents.findIndex((d) => d.id === id && (isSuperAdmin || d.businessId === businessId));
  if (docIdx === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const doc = memoryStore.documents[docIdx];
  if (!isSuperAdmin && doc.status === 'posted') {
    return c.json(
      {
        error: {
          code: 'DOCUMENT_LOCKED',
          message:
            'This entry has already been Saved & Locked to accounting ledgers and CANNOT be deleted. Please use Void to reverse posted entries.',
        },
      },
      403
    );
  }

  memoryStore.documents.splice(docIdx, 1);

  recordAuditLog({
    businessId: doc.businessId,
    userId: user.id,
    action: isSuperAdmin ? 'SUPER_ADMIN_DELETE_DOCUMENT' : 'DELETE_DOCUMENT',
    entity: 'documents',
    entityId: doc.id,
    details: { docNo: doc.docNo },
  });

  return c.json({ success: true, message: `Document #${doc.docNo} deleted` });
});

// POST /documents/:id/post - Post document & create balanced double-entry journal lines!
documents.post('/:id/post', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const doc = memoryStore.documents.find((d) => d.id === id && (isSuperAdmin || d.businessId === businessId));
  if (!doc) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  if (doc.status !== 'draft') {
    return c.json({ error: { code: 'BAD_REQUEST', message: `Document is already ${doc.status}` } }, 400);
  }

  // Find standard accounts for the document's distributor
  const docBusinessId = doc.businessId;
  const findAccountByCode = (code: string) => memoryStore.accounts.find((a) => a.businessId === docBusinessId && a.code === code);

  const arAccount = findAccountByCode('1030'); // Accounts Receivable
  const apAccount = findAccountByCode('2010'); // Accounts Payable
  const salesAccount = findAccountByCode('4010'); // Sales Income
  const purchasesAccount = findAccountByCode('5010'); // Purchases
  const outputCgst = findAccountByCode('2030');
  const outputSgst = findAccountByCode('2031');
  const outputIgst = findAccountByCode('2032');
  const inputCgst = findAccountByCode('1050');
  const inputSgst = findAccountByCode('1051');
  const inputIgst = findAccountByCode('1052');
  const roundOffAccount = findAccountByCode('5050'); // Round Off Expense / Adjustment

  if (!arAccount || !apAccount || !salesAccount || !purchasesAccount) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Standard system accounts not found for distributor' } }, 500);
  }

  const lines: Array<{ accountId: string; partyId?: string | null; debit: number; credit: number }> = [];

  // Calculate tax totals per CGST, SGST, IGST across lines
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  for (const l of doc.lines) {
    totalCgst += l.cgst;
    totalSgst += l.sgst;
    totalIgst += l.igst;
  }

  if (doc.docType === 'sales_invoice') {
    lines.push({ accountId: arAccount.id, partyId: doc.partyId, debit: doc.total, credit: 0 });
    lines.push({ accountId: salesAccount.id, debit: 0, credit: doc.subtotal });

    if (totalCgst > 0 && outputCgst) lines.push({ accountId: outputCgst.id, debit: 0, credit: totalCgst });
    if (totalSgst > 0 && outputSgst) lines.push({ accountId: outputSgst.id, debit: 0, credit: totalSgst });
    if (totalIgst > 0 && outputIgst) lines.push({ accountId: outputIgst.id, debit: 0, credit: totalIgst });

    if (doc.roundOff !== 0 && roundOffAccount) {
      if (doc.roundOff > 0) {
        lines.push({ accountId: roundOffAccount.id, debit: 0, credit: doc.roundOff });
      } else {
        lines.push({ accountId: roundOffAccount.id, debit: -doc.roundOff, credit: 0 });
      }
    }
  } else if (doc.docType === 'purchase_bill') {
    lines.push({ accountId: purchasesAccount.id, debit: doc.subtotal, credit: 0 });

    if (totalCgst > 0 && inputCgst) lines.push({ accountId: inputCgst.id, debit: totalCgst, credit: 0 });
    if (totalSgst > 0 && inputSgst) lines.push({ accountId: inputSgst.id, debit: totalSgst, credit: 0 });
    if (totalIgst > 0 && inputIgst) lines.push({ accountId: inputIgst.id, debit: totalIgst, credit: 0 });

    if (doc.roundOff !== 0 && roundOffAccount) {
      if (doc.roundOff > 0) {
        lines.push({ accountId: roundOffAccount.id, debit: doc.roundOff, credit: 0 });
      } else {
        lines.push({ accountId: roundOffAccount.id, debit: 0, credit: -doc.roundOff });
      }
    }

    lines.push({ accountId: apAccount.id, partyId: doc.partyId, debit: 0, credit: doc.total });
  }

  // Create journal entry with strict double-entry guarantee
  const journalEntry = memoryStore.createJournalEntry({
    businessId: docBusinessId,
    entryDate: doc.docDate,
    narration: `Posting for ${doc.docType} #${doc.docNo}`,
    sourceType: doc.docType,
    sourceId: doc.id,
    createdBy: user.id,
    lines,
  });

  doc.status = 'posted';
  doc.entryId = journalEntry.id;

  recordAuditLog({
    businessId: docBusinessId,
    userId: user.id,
    action: 'POST_DOCUMENT',
    entity: 'documents',
    entityId: doc.id,
    details: { docNo: doc.docNo, journalEntryNo: journalEntry.entryNo },
  });

  return c.json({ success: true, document: doc, journalEntry });
});

// POST /documents/:id/void - Void document and reverse journal entry
documents.post('/:id/void', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const doc = memoryStore.documents.find((d) => d.id === id && (isSuperAdmin || d.businessId === businessId));
  if (!doc) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  if (doc.status === 'void') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Document is already void' } }, 400);
  }

  doc.status = 'void';

  // Reverse journal entry if posted
  if (doc.entryId) {
    const entry = memoryStore.journalEntries.find((e) => e.id === doc.entryId);
    if (entry && !entry.isVoid) {
      entry.isVoid = true;
      const reversalLines = entry.lines.map((l) => ({
        accountId: l.accountId,
        partyId: l.partyId,
        debit: l.credit,
        credit: l.debit,
      }));
      memoryStore.createJournalEntry({
        businessId: doc.businessId,
        entryDate: new Date().toISOString().split('T')[0],
        narration: `Void reversal for ${doc.docType} #${doc.docNo}`,
        sourceType: doc.docType,
        sourceId: doc.id,
        createdBy: user.id,
        lines: reversalLines,
      });
    }
  }

  recordAuditLog({
    businessId: doc.businessId,
    userId: user.id,
    action: 'VOID_DOCUMENT',
    entity: 'documents',
    entityId: doc.id,
    details: { docNo: doc.docNo },
  });

  return c.json({ success: true, document: doc });
});

// GET /documents/:id/pdf-data - Full data payload ready for jsPDF rendering in the frontend
documents.get('/:id/pdf-data', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const isSuperAdmin = user.role === 'super_admin';

  const doc = memoryStore.documents.find((d) => d.id === id && (isSuperAdmin || d.businessId === businessId));
  if (!doc) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const party = memoryStore.parties.find((p) => p.id === doc.partyId);
  const currentBiz = memoryStore.businesses.find((b) => b.id === doc.businessId) || memoryStore.business;

  return c.json({
    business: currentBiz,
    document: doc,
    party,
    amountInWords: paiseToWords(doc.total),
    formattedTotal: formatPaise(doc.total, { showSymbol: true }),
  });
});

// POST /documents/:id/email - Send invoice email via Resend
documents.post('/:id/email', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const doc = memoryStore.documents.find((d) => d.id === id && d.businessId === businessId);
  if (!doc) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const party = memoryStore.parties.find((p) => p.id === doc.partyId);
  const recipientEmail = body.toEmail || party?.email;

  if (!recipientEmail) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Recipient email address not provided' } }, 400);
  }

  // If RESEND_API_KEY is configured, call Resend API
  if (c.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: c.env.EMAIL_FROM || 'BizLedger <notifications@bizledger.local>',
          to: [recipientEmail],
          subject: `${memoryStore.business.name}: Invoice ${doc.docNo}`,
          html: `<p>Dear ${party?.name || 'Customer'},</p>
                 <p>Please find attached Invoice <strong>${doc.docNo}</strong> dated ${doc.docDate} for <strong>${formatPaise(doc.total, { showSymbol: true })}</strong>.</p>
                 <p>Thank you for your business!</p>
                 <p>Best regards,<br/>${memoryStore.business.name}</p>`,
        }),
      });
      const data = await res.json();
      recordAuditLog({
        businessId,
        userId: user.id,
        action: 'EMAIL_DOCUMENT',
        entity: 'documents',
        entityId: doc.id,
        details: { to: recipientEmail, resendResponse: data },
      });
      return c.json({ success: true, message: `Email sent to ${recipientEmail}`, resend: data });
    } catch (err: any) {
      return c.json({ error: { code: 'EMAIL_FAILED', message: err.message } }, 500);
    }
  }

  // Simulated email dispatch in local/dev mode
  recordAuditLog({
    businessId,
    userId: user.id,
    action: 'EMAIL_DOCUMENT_SIMULATED',
    entity: 'documents',
    entityId: doc.id,
    details: { to: recipientEmail, simulated: true },
  });

  return c.json({
    success: true,
    message: `[Dev Mode] Invoice ${doc.docNo} simulated email sent to ${recipientEmail}`,
  });
});

export { documents as documentRoutes };
