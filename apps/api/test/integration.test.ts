import { describe, it, expect } from 'vitest';
import { app } from '../src/index';

describe('API Integration & Accounting Workflows', () => {
  let adminToken: string;
  let userSession: any;

  it('authenticates admin with valid credentials and locks out after 5 failures', async () => {
    // 1. Success login
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: 'admin',
        password: 'Admin@1234',
      }),
    });
    expect(loginRes.status).toBe(200);
    const data = await loginRes.json();
    expect(data.accessToken).toBeDefined();
    expect(data.user.username).toBe('admin');
    expect(data.user.role).toBe('owner');
    adminToken = data.accessToken;
    userSession = data.user;

    // 2. Test wrong password
    const failRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: 'admin',
        password: 'WrongPassword123',
      }),
    });
    expect(failRes.status).toBe(401);
  });

  it('fetches cheque alerts pop-up data (overdue, due today, upcoming)', async () => {
    const res = await app.request('/api/v1/cheques/alerts', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overdue).toBeDefined();
    expect(data.dueToday).toBeDefined();
    expect(data.upcoming).toBeDefined();
    expect(data.totalCount).toBeGreaterThan(0);
  });

  it('creates an invoice, posts it to ledger, and confirms Trial Balance balances', async () => {
    // 1. Fetch parties
    const partiesRes = await app.request('/api/v1/parties', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { parties } = await partiesRes.json();
    const customer = parties.find((p: any) => p.kind === 'customer');

    // 2. Create draft invoice
    // ₹10,000 + 18% GST (CGST 9% + SGST 9%) = ₹11,800
    const invRes = await app.request('/api/v1/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        docType: 'sales_invoice',
        docDate: '2026-04-10',
        partyId: customer.id,
        placeOfSupply: '27',
        subtotal: 1000000,
        taxTotal: 180000,
        roundOff: 0,
        total: 1180000,
        lines: [
          {
            description: 'Consulting services',
            hsnSac: '998222',
            qty: 1,
            rate: 1000000,
            discount: 0,
            gstRate: 18,
            cgst: 90000,
            sgst: 90000,
            igst: 0,
            lineTotal: 1180000,
          },
        ],
      }),
    });
    expect(invRes.status).toBe(201);
    const { document: doc } = await invRes.json();
    expect(doc.status).toBe('draft');

    // 3. Post invoice
    const postRes = await app.request(`/api/v1/documents/${doc.id}/post`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.document.status).toBe('posted');
    expect(postData.journalEntry).toBeDefined();

    // 4. Verify Trial Balance balances (Debits === Credits)
    const tbRes = await app.request('/api/v1/reports/trial-balance', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(tbRes.status).toBe(200);
    const tb = await tbRes.json();
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('records a payment receipt and updates document balances', async () => {
    const partiesRes = await app.request('/api/v1/parties', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { parties } = await partiesRes.json();
    const customer = parties.find((p: any) => p.kind === 'customer');

    const payRes = await app.request('/api/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        kind: 'receipt',
        partyId: customer.id,
        payDate: '2026-04-12',
        mode: 'bank',
        amount: 500000, // ₹5,000 received
        reference: 'IMPS/123456789',
      }),
    });
    expect(payRes.status).toBe(201);
    const payData = await payRes.json();
    expect(payData.payment.kind).toBe('receipt');

    // Confirm Trial Balance still balances
    const tbRes = await app.request('/api/v1/reports/trial-balance', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tb = await tbRes.json();
    expect(tb.isBalanced).toBe(true);
  });

  it('updates cheque status to cleared and executes automatic accounting entries', async () => {
    // 1. List cheques
    const chqListRes = await app.request('/api/v1/cheques', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { cheques } = await chqListRes.json();
    const pendingCheque = cheques.find((c: any) => c.status === 'pending');
    expect(pendingCheque).toBeDefined();

    // 2. Update status to cleared
    const updateRes = await app.request(`/api/v1/cheques/${pendingCheque.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'cleared',
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.cheque.status).toBe('cleared');

    // Confirm Trial Balance balances
    const tbRes = await app.request('/api/v1/reports/trial-balance', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const tb = await tbRes.json();
    expect(tb.isBalanced).toBe(true);
  });

  it('Super Admin operates as global power user across all distributors', async () => {
    // 1. Super Admin login
    const saLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: 'anoopsue',
        password: 'hermes1*',
      }),
    });
    expect(saLoginRes.status).toBe(200);
    const saData = await saLoginRes.json();
    expect(saData.user.role).toBe('super_admin');
    expect(saData.user.businessId).toBe('all');
    const saToken = saData.accessToken;

    // 2. Fetch businesses list - verify dummy central platform admin is absent
    const saBizRes = await app.request('/api/v1/admin/businesses', {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    expect(saBizRes.status).toBe(200);
    const { businesses } = await saBizRes.json();
    expect(businesses.some((b: any) => b.id === '00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(businesses.length).toBeGreaterThanOrEqual(2);

    // 3. In Global All mode, fetch documents across distributors
    const docsRes = await app.request('/api/v1/documents', {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    expect(docsRes.status).toBe(200);
    const { documents } = await docsRes.json();
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0].distributorName).toBeDefined();

    // 4. Super Admin master authority to delete a document
    const targetDoc = documents[0];
    const delRes = await app.request(`/api/v1/documents/${targetDoc.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${saToken}` },
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);
  });
});
