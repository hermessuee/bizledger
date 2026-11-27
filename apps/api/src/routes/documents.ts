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

// POST /documents/batch - Save multiple purchase bills or invoices in a single multi-vendor entry
documents.post('/batch', async (c) => {
  const businessId = c.get('businessId');
  const user = c.get('user');
  const isSuperAdmin = user.role === 'super_admin';
  const body = await c.req.json();
  const docsList = Array.isArray(body.documents) ? body.documents : [];
  const finalizeAndLock = Boolean(body.finalizeAndLock);

  if (docsList.length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No documents provided in batch' } }, 400);
  }

  const createdDocs = [];
  const currentFy = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;

  for (const item of docsList) {
    const parsed = createDocumentSchema.safeParse(item);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid document in batch', details: parsed.error.format() } }, 400);
    }
    const data = parsed.data;
    const docNo = data.docNo || memoryStore.getNextDocNo(data.docType, currentFy);
    const targetBusinessId = (isSuperAdmin && (item.businessId || body.businessId))
      ? (item.businessId || body.businessId)
      : (businessId !== 'all' ? businessId : (memoryStore.businesses[0]?.id || '11111111-1111-1111-1111-111111111111'));

    const newDoc = {
      id: crypto.randomUUID(),
      businessId: targetBusinessId,
      docType: data.docType,
      docNo,
      docDate: data.docDate,
      dueDate: data.dueDate,
      partyId: data.partyId,
      placeOfSupply: data.placeOfSupply || '32',
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
    createdDocs.push(newDoc);

    recordAuditLog({
      businessId: targetBusinessId,
      userId: user.id,
      action: 'CREATE_DOCUMENT',
      entity: 'documents',
      entityId: newDoc.id,
      details: { docType: newDoc.docType, docNo: newDoc.docNo, total: newDoc.total },
    });
  }

  if (finalizeAndLock) {
    for (const doc of createdDocs) {
      memoryStore.postDocument(doc.id, user.id);
    }
  }

  return c.json({ success: true, count: createdDocs.length, documents: createdDocs }, 201);
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

  // Cascade delete linked journal entries
  memoryStore.journalEntries = memoryStore.journalEntries.filter(
    (j) => j.id !== doc.entryId && j.sourceId !== doc.id
  );
  // Cascade clean up any payment allocations
  for (const p of memoryStore.payments) {
    if (p.allocations) {
      p.allocations = p.allocations.filter((a) => a.documentId !== doc.id);
    }
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

  const updatedDoc = memoryStore.postDocument(doc.id, user.id);
  const journalEntry = updatedDoc?.entryId
    ? memoryStore.journalEntries.find((j) => j.id === updatedDoc.entryId)
    : null;

  recordAuditLog({
    businessId: doc.businessId,
    userId: user.id,
    action: 'POST_DOCUMENT',
    entity: 'documents',
    entityId: doc.id,
    details: { docNo: doc.docNo, journalEntryNo: journalEntry?.entryNo },
  });

  return c.json({ success: true, document: updatedDoc, journalEntry });
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
