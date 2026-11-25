export const ROLES = ['super_admin', 'owner', 'accountant', 'staff', 'viewer'] as const;
export type Role = typeof ROLES[number];

export const MENU_KEYS = [
  'dashboard',
  'customers',
  'vendors',
  'items',
  'sales_invoices',
  'purchase_bills',
  'receipts',
  'payments',
  'cheques',
  'banking',
  'journal',
  'chart_of_accounts',
  'reports',
  'gst',
  'bulk_upload',
  'admin_portal',
  'settings',
  'users',
  'audit_log',
] as const;
export type MenuKey = typeof MENU_KEYS[number];

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  vendors: 'Vendors',
  items: 'Items & Services',
  sales_invoices: 'Sales Invoices',
  purchase_bills: 'Purchase Bills',
  receipts: 'Receipts',
  payments: 'Payments',
  cheques: 'Cheques & PDC',
  banking: 'Banking',
  journal: 'Journal Entries',
  chart_of_accounts: 'Chart of Accounts',
  reports: 'Reports',
  gst: 'GST Reports',
  bulk_upload: 'Bulk Upload & Templates',
  admin_portal: 'Distributor Portal (Super Admin)',
  settings: 'Company Settings',
  users: 'User Management',
  audit_log: 'Audit Log',
};

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const CHEQUE_DIRECTIONS = ['received', 'issued'] as const;
export type ChequeDirection = typeof CHEQUE_DIRECTIONS[number];

export const CHEQUE_STATUSES = [
  'pending',
  'deposited',
  'cleared',
  'bounced',
  'cancelled',
  'stale',
  'replaced',
] as const;
export type ChequeStatus = typeof CHEQUE_STATUSES[number];

export const DOCUMENT_TYPES = ['sales_invoice', 'purchase_bill', 'credit_note', 'debit_note'] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};
