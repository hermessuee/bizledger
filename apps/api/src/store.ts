import {
  Business,
  UserSession,
  Role,
  MenuKey,
  MENU_KEYS,
  Party,
  Item,
  Account,
  ChequeItem,
  ChequeStatus,
  ChequeDirection,
  DocumentType,
} from '@bizledger/shared';
import { hashPassword, verifyPassword, generateRandomHex } from './crypto';

// In-memory persistent data store for local dev, testing, and fallback
export class MemoryStore {
  businesses: Business[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Apex Trading & Services Pvt Ltd',
      gstin: '27AAPCA1234M1Z5',
      stateCode: '27',
      address: 'Shop 14, Commercial Complex, Andheri East, Mumbai, Maharashtra 400069',
      currency: 'INR',
      fyStartMonth: 4,
      status: 'active',
      enabledMenus: [...MENU_KEYS],
      settings: {
        alertDaysBefore: [7, 3, 1, 0],
        alertReceived: true,
        alertIssued: true,
        invoicePrefix: 'INV',
        fyFormat: 'YYYY-YY',
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNo: '50200012345678',
          ifsc: 'HDFC0000123',
          branch: 'Andheri East, Mumbai',
        },
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: '11111111-1111-1111-1111-111111111112',
      name: 'Sai Krupa Pharma Distributors',
      gstin: '24ABCDE5678F1Z2',
      stateCode: '24',
      address: 'Plot 88, GIDC Industrial Estate, Ahmedabad, Gujarat 380015',
      currency: 'INR',
      fyStartMonth: 4,
      status: 'active',
      enabledMenus: [
        'dashboard',
        'customers',
        'vendors',
        'items',
        'sales_invoices',
        'purchase_bills',
        'payments',
        'receipts',
        'cheques',
        'gst',
        'bulk_upload',
        'master_governance',
        'settings',
        'users',
      ],
      settings: {
        invoicePrefix: 'SKP',
        alertReceived: true,
        alertIssued: true,
      },
      createdAt: new Date().toISOString(),
    },
  ];

  get business() {
    return this.businesses[0];
  }

  users: Array<{
    id: string;
    businessId: string;
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: Role;
    isActive: boolean;
    mustChangePassword: boolean;
    failedAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: string | null;
    createdAt: string;
    permissions: Record<MenuKey, {
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canExport: boolean;
    }>;
  }> = [];

  refreshTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revoked: boolean;
  }> = [];

  accounts: Account[] = [];
  parties: Party[] = [];
  items: Item[] = [];

  journalEntries: Array<{
    id: string;
    businessId: string;
    entryNo: string;
    entryDate: string;
    narration?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    isVoid: boolean;
    reversalOf?: string | null;
    createdBy?: string | null;
    createdAt: string;
    lines: Array<{
      id: string;
      accountId: string;
      partyId?: string | null;
      debit: number;
      credit: number;
    }>;
  }> = [];

  documents: Array<{
    id: string;
    businessId: string;
    docType: DocumentType;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    partyId: string;
    placeOfSupply: string;
    subtotal: number;
    taxTotal: number;
    roundOff: number;
    total: number;
    paidAmount: number;
    status: 'draft' | 'posted' | 'void';
    entryId?: string | null;
    lines: Array<{
      id: string;
      itemId?: string | null;
      description: string;
      hsnSac?: string | null;
      qty: number;
      rate: number;
      discount: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      lineTotal: number;
    }>;
  }> = [];

  cheques: ChequeItem[] = [];

  payments: Array<{
    id: string;
    businessId: string;
    kind: 'receipt' | 'payment';
    partyId: string;
    payDate: string;
    mode: 'cash' | 'bank' | 'upi' | 'cheque';
    bankAccountId?: string | null;
    chequeId?: string | null;
    amount: number;
    reference?: string | null;
    entryId?: string | null;
    allocations?: Array<{ documentId: string; amount: number }>;
  }> = [];

  docCounters: Record<string, number> = {};

  auditLogs: Array<{
    id: number;
    businessId: string;
    userId?: string | null;
    action: string;
    entity?: string | null;
    entityId?: string | null;
    details?: any;
    ip?: string | null;
    createdAt: string;
  }> = [];

  reminderLogs: Array<{
    chequeId: string;
    userId: string;
    sentOn: string;
  }> = [];

  constructor() {
    this.seed();
  }

  seed() {
    const allPerms: any = {};
    for (const key of MENU_KEYS) {
      allPerms[key] = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true };
    }

    // 0. Master Super Administrator (Platform Owner: anoopsue)
    this.users.push({
      id: '00000000-0000-0000-0000-000000000001',
      businessId: 'all',
      name: 'Platform Super Administrator (anoopsue)',
      email: 'anoopsue@bizledger.in',
      username: 'anoopsue',
      // High-performance PBKDF2 hash of hermes1*
      passwordHash: 'pbkdf2$10000$1234567890abcdef1234567890abcdef$61e7cb401d0fd7d3fa9b8b8b4f5e4fdaced4e39c085f8532b9a02b3be30ae01d',
      role: 'super_admin',
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      permissions: allPerms,
    });

    // 1. Distributor 1 Admin user (Password: Admin@1234)
    this.users.push({
      id: '22222222-2222-2222-2222-222222222222',
      businessId: this.business.id,
      name: 'Rajesh Kumar (Owner)',
      email: 'admin@bizledger.local',
      username: 'admin',
      // Hash of Admin@1234
      passwordHash: 'pbkdf2$10000$1234567890abcdef1234567890abcdef$653e65463f4dfb82ac3559796e6c4464d82277e5132b752f8ade68cf6aef5729',
      role: 'owner',
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      permissions: allPerms,
    });

    // 2. Distributor 2 Admin user (Password: Admin@1234)
    this.users.push({
      id: '22222222-2222-2222-2222-222222222223',
      businessId: '11111111-1111-1111-1111-111111111112',
      name: 'Suresh Patel (Sai Krupa Pharma)',
      email: 'owner@saikrupa.in',
      username: 'saikrupa',
      passwordHash: 'pbkdf2$10000$1234567890abcdef1234567890abcdef$653e65463f4dfb82ac3559796e6c4464d82277e5132b752f8ade68cf6aef5729',
      role: 'owner',
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      permissions: allPerms,
    });

    this.seedDefaultAccountsForBusiness('11111111-1111-1111-1111-111111111112');

    // 2. Standard Chart of Accounts
    this.accounts = [
      { id: 'a0000001-0000-0000-0000-000000000001', businessId: this.business.id, code: '1010', name: 'Cash in Hand', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000002', businessId: this.business.id, code: '1020', name: 'HDFC Bank Current A/c', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000003', businessId: this.business.id, code: '1030', name: 'Accounts Receivable (Sundry Debtors)', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000004', businessId: this.business.id, code: '1040', name: 'Cheques in Hand (PDC Received)', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000005', businessId: this.business.id, code: '1050', name: 'Input CGST', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000006', businessId: this.business.id, code: '1051', name: 'Input SGST', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000007', businessId: this.business.id, code: '1052', name: 'Input IGST', type: 'asset', isSystem: true, isActive: true },
      { id: 'a0000001-0000-0000-0000-000000000008', businessId: this.business.id, code: '1060', name: 'Inventory', type: 'asset', isSystem: true, isActive: true },

      { id: 'b0000001-0000-0000-0000-000000000001', businessId: this.business.id, code: '2010', name: 'Accounts Payable (Sundry Creditors)', type: 'liability', isSystem: true, isActive: true },
      { id: 'b0000001-0000-0000-0000-000000000002', businessId: this.business.id, code: '2020', name: 'Cheques Issued Clearing Account', type: 'liability', isSystem: true, isActive: true },
      { id: 'b0000001-0000-0000-0000-000000000003', businessId: this.business.id, code: '2030', name: 'Output CGST', type: 'liability', isSystem: true, isActive: true },
      { id: 'b0000001-0000-0000-0000-000000000004', businessId: this.business.id, code: '2031', name: 'Output SGST', type: 'liability', isSystem: true, isActive: true },
      { id: 'b0000001-0000-0000-0000-000000000005', businessId: this.business.id, code: '2032', name: 'Output IGST', type: 'liability', isSystem: true, isActive: true },
      { id: 'b0000001-0000-0000-0000-000000000006', businessId: this.business.id, code: '2040', name: 'TDS Payable', type: 'liability', isSystem: true, isActive: true },

      { id: 'c0000001-0000-0000-0000-000000000001', businessId: this.business.id, code: '3010', name: 'Owner Capital', type: 'equity', isSystem: true, isActive: true },
      { id: 'c0000001-0000-0000-0000-000000000002', businessId: this.business.id, code: '3020', name: 'Retained Earnings', type: 'equity', isSystem: true, isActive: true },

      { id: 'd0000001-0000-0000-0000-000000000001', businessId: this.business.id, code: '4010', name: 'Sales Income', type: 'income', isSystem: true, isActive: true },
      { id: 'd0000001-0000-0000-0000-000000000002', businessId: this.business.id, code: '4020', name: 'Service Income', type: 'income', isSystem: true, isActive: true },
      { id: 'd0000001-0000-0000-0000-000000000003', businessId: this.business.id, code: '4030', name: 'Discount Received', type: 'income', isSystem: false, isActive: true },

      { id: 'e0000001-0000-0000-0000-000000000001', businessId: this.business.id, code: '5010', name: 'Purchases', type: 'expense', isSystem: true, isActive: true },
      { id: 'e0000001-0000-0000-0000-000000000002', businessId: this.business.id, code: '5020', name: 'Rent Expense', type: 'expense', isSystem: false, isActive: true },
      { id: 'e0000001-0000-0000-0000-000000000003', businessId: this.business.id, code: '5030', name: 'Salaries & Wages', type: 'expense', isSystem: false, isActive: true },
      { id: 'e0000001-0000-0000-0000-000000000004', businessId: this.business.id, code: '5040', name: 'Bank Charges', type: 'expense', isSystem: true, isActive: true },
      { id: 'e0000001-0000-0000-0000-000000000005', businessId: this.business.id, code: '5050', name: 'Round Off Expense / Adjustment', type: 'expense', isSystem: true, isActive: true },
    ];

    // 3. Parties
    this.parties = [
      {
        id: '70000001-0000-0000-0000-000000000001',
        businessId: this.business.id,
        kind: 'customer',
        name: 'Shree Ram Enterprises',
        gstin: '27BBRPA9876K1Z1',
        phone: '9820011223',
        email: 'accounts@shreeram.in',
        address: 'Dadar West, Mumbai, MH',
        creditDays: 30,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      },
      {
        id: '70000001-0000-0000-0000-000000000002',
        businessId: this.business.id,
        kind: 'customer',
        name: 'TechCorp Solutions Bengaluru',
        gstin: '29AAGCT5544R1Z0',
        phone: '9845012345',
        email: 'billing@techcorp.io',
        address: 'Whitefield, Bengaluru, KA',
        creditDays: 15,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      },
      {
        id: '70000001-0000-0000-0000-000000000003',
        businessId: this.business.id,
        kind: 'vendor',
        name: 'Mahalaxmi Stationery & Logistics',
        gstin: '27AAMFM3322P1Z8',
        phone: '9821098765',
        email: 'orders@mahalaxmi.com',
        address: 'Fort, Mumbai, MH',
        creditDays: 30,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
      },
    ];

    // 4. Items
    this.items = [
      {
        id: '80000001-0000-0000-0000-000000000001',
        businessId: this.business.id,
        name: 'Accounting Consultation Services',
        hsnSac: '998222',
        unit: 'SET',
        salePrice: 250000,
        purchasePrice: 0,
        gstRate: 18.0,
        trackStock: false,
        stockQty: 0,
        isActive: true,
      },
      {
        id: '80000001-0000-0000-0000-000000000002',
        businessId: this.business.id,
        name: 'Enterprise Server Hard Drive 2TB',
        hsnSac: '847170',
        unit: 'NOS',
        salePrice: 750000,
        purchasePrice: 520000,
        gstRate: 18.0,
        trackStock: true,
        stockQty: 45,
        isActive: true,
      },
      {
        id: '80000001-0000-0000-0000-000000000003',
        businessId: this.business.id,
        name: 'GST Filing & Compliance Retainer',
        hsnSac: '998231',
        unit: 'BOX',
        salePrice: 1000000,
        purchasePrice: 0,
        gstRate: 18.0,
        trackStock: false,
        stockQty: 0,
        isActive: true,
      },
    ];

    // 5. Cheques to demonstrate Alerts
    const today = new Date();
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const overdueDate = new Date(today);
    overdueDate.setDate(today.getDate() - 5);

    const upcomingDate = new Date(today);
    upcomingDate.setDate(today.getDate() + 4);

    this.cheques = [
      {
        id: 'c0000001-0000-0000-0000-000000000001',
        businessId: this.business.id,
        direction: 'received',
        partyId: '70000001-0000-0000-0000-000000000001',
        partyName: 'Shree Ram Enterprises',
        chequeNo: '000412',
        bankName: 'State Bank of India',
        branch: 'Dadar Branch',
        amount: 12500000, // Rs 1,25,000.00
        chequeDate: toDateStr(overdueDate),
        txnDate: toDateStr(overdueDate),
        status: 'pending',
        remarks: 'Overdue customer cheque pending presentation',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'c0000001-0000-0000-0000-000000000002',
        businessId: this.business.id,
        direction: 'received',
        partyId: '70000001-0000-0000-0000-000000000002',
        partyName: 'TechCorp Solutions Bengaluru',
        chequeNo: '552319',
        bankName: 'ICICI Bank',
        branch: 'Whitefield Branch',
        amount: 8500000, // Rs 85,000.00
        chequeDate: toDateStr(today),
        txnDate: toDateStr(today),
        status: 'pending',
        remarks: 'PDC maturing today for clearing',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'c0000001-0000-0000-0000-000000000003',
        businessId: this.business.id,
        direction: 'issued',
        partyId: '70000001-0000-0000-0000-000000000003',
        partyName: 'Mahalaxmi Stationery & Logistics',
        chequeNo: '100801',
        bankName: 'HDFC Bank',
        branch: 'Andheri East',
        amount: 4200000, // Rs 42,000.00
        chequeDate: toDateStr(upcomingDate),
        txnDate: toDateStr(today),
        status: 'pending',
        remarks: 'Advance cheque issued to vendor',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  // Next Doc Number Sequence (e.g. INV/2026-27/0001)
  getNextDocNo(docType: DocumentType, fy: string): string {
    const key = `${docType}_${fy}`;
    const nextNo = (this.docCounters[key] || 0) + 1;
    this.docCounters[key] = nextNo;
    const prefixMap: Record<DocumentType, string> = {
      sales_invoice: 'INV',
      purchase_bill: 'BILL',
      credit_note: 'CN',
      debit_note: 'DN',
    };
    const prefix = prefixMap[docType] || 'DOC';
    return `${prefix}/${fy}/${String(nextNo).padStart(4, '0')}`;
  }

  // Double-entry validation & journal creation
  createJournalEntry(entry: {
    businessId: string;
    entryDate: string;
    narration?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    createdBy?: string | null;
    lines: Array<{
      accountId: string;
      partyId?: string | null;
      debit: number;
      credit: number;
    }>;
  }) {
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);

    if (totalDebit !== totalCredit || totalDebit <= 0) {
      throw new Error(`Unbalanced journal entry: Debits (${totalDebit}) must equal Credits (${totalCredit})`);
    }

    const entryNo = `JV/${new Date().getFullYear()}/${String(this.journalEntries.length + 1).padStart(4, '0')}`;
    const id = crypto.randomUUID();

    const created = {
      id,
      businessId: entry.businessId,
      entryNo,
      entryDate: entry.entryDate,
      narration: entry.narration,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      isVoid: false,
      createdBy: entry.createdBy,
      createdAt: new Date().toISOString(),
      lines: entry.lines.map((l) => ({
        id: crypto.randomUUID(),
        ...l,
      })),
    };

    this.journalEntries.push(created);
    return created;
  }

  seedDefaultAccountsForBusiness(businessId: string) {
    const defaultAccounts: Array<Omit<Account, 'id'>> = [
      { businessId, code: '1010', name: 'Cash in Hand', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1020', name: 'Primary Bank Current A/c', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1030', name: 'Accounts Receivable (Sundry Debtors)', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1040', name: 'Cheques in Hand (PDC Received)', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1050', name: 'Input CGST', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1051', name: 'Input SGST', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1052', name: 'Input IGST', type: 'asset', isSystem: true, isActive: true },
      { businessId, code: '1060', name: 'Inventory Asset', type: 'asset', isSystem: true, isActive: true },

      { businessId, code: '2010', name: 'Accounts Payable (Sundry Creditors)', type: 'liability', isSystem: true, isActive: true },
      { businessId, code: '2020', name: 'Cheques Issued Clearing Account', type: 'liability', isSystem: true, isActive: true },
      { businessId, code: '2030', name: 'Output CGST', type: 'liability', isSystem: true, isActive: true },
      { businessId, code: '2031', name: 'Output SGST', type: 'liability', isSystem: true, isActive: true },
      { businessId, code: '2032', name: 'Output IGST', type: 'liability', isSystem: true, isActive: true },
      { businessId, code: '2040', name: 'TDS Payable', type: 'liability', isSystem: true, isActive: true },

      { businessId, code: '3010', name: 'Owner Capital', type: 'equity', isSystem: true, isActive: true },
      { businessId, code: '3020', name: 'Retained Earnings', type: 'equity', isSystem: true, isActive: true },

      { businessId, code: '4010', name: 'Sales Income', type: 'income', isSystem: true, isActive: true },
      { businessId, code: '4020', name: 'Service Income', type: 'income', isSystem: true, isActive: true },
      { businessId, code: '4030', name: 'Discount Received', type: 'income', isSystem: false, isActive: true },

      { businessId, code: '5010', name: 'Purchases', type: 'expense', isSystem: true, isActive: true },
      { businessId, code: '5020', name: 'Rent Expense', type: 'expense', isSystem: false, isActive: true },
      { businessId, code: '5030', name: 'Salaries & Wages', type: 'expense', isSystem: false, isActive: true },
      { businessId, code: '5040', name: 'Bank Charges', type: 'expense', isSystem: true, isActive: true },
      { businessId, code: '5050', name: 'Round Off Expense / Adjustment', type: 'expense', isSystem: true, isActive: true },
    ];

    for (const acc of defaultAccounts) {
      this.accounts.push({
        id: crypto.randomUUID(),
        ...acc,
      });
    }
  }

  createBusiness(params: {
    name: string;
    gstin?: string;
    stateCode?: string;
    address?: string;
    ownerName: string;
    ownerEmail: string;
    ownerUsername: string;
    ownerPasswordHash: string;
  }) {
    const businessId = crypto.randomUUID();
    const newBusiness: Business = {
      id: businessId,
      name: params.name,
      gstin: params.gstin || null,
      stateCode: params.stateCode || (params.gstin ? params.gstin.slice(0, 2) : '27'),
      address: params.address || null,
      currency: 'INR',
      fyStartMonth: 4,
      status: 'active',
      enabledMenus: [...MENU_KEYS].filter((k) => k !== 'admin_portal'),
      settings: {
        alertDaysBefore: [7, 3, 1, 0],
        alertReceived: true,
        alertIssued: true,
        invoicePrefix: 'INV',
        fyFormat: 'YYYY-YY',
      },
      createdAt: new Date().toISOString(),
    };
    this.businesses.push(newBusiness);

    // Seed default standard Chart of Accounts
    this.seedDefaultAccountsForBusiness(businessId);

    // Create owner user
    const ownerPerms: any = {};
    for (const key of MENU_KEYS) {
      ownerPerms[key] = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true };
    }
    const ownerUser = {
      id: crypto.randomUUID(),
      businessId,
      name: params.ownerName,
      email: params.ownerEmail,
      username: params.ownerUsername,
      passwordHash: params.ownerPasswordHash,
      role: 'owner' as Role,
      isActive: true,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      permissions: ownerPerms,
    };
    this.users.push(ownerUser);

    return { business: newBusiness, user: ownerUser };
  }
}

// Global singleton instance for memory mode
export const memoryStore = new MemoryStore();
