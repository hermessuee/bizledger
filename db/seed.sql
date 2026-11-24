-- Seed Script for BizLedger
-- Default Demo Business, Admin User, Chart of Accounts, and Sample Data

-- 1. Demo Business
INSERT INTO businesses (id, name, gstin, state_code, address, currency, fy_start_month, settings)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Apex Trading & Services Pvt Ltd',
  '27AAPCA1234M1Z5',
  '27',
  'Shop 14, Commercial Complex, Andheri East, Mumbai, Maharashtra 400069',
  'INR',
  4,
  '{"alertDaysBefore": [7, 3, 1, 0], "alertReceived": true, "alertIssued": true, "invoicePrefix": "INV", "fyFormat": "YYYY-YY"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Admin User
-- Password: Admin@1234
-- PBKDF2 hash format: pbkdf2$iterations$salt_hex$hash_hex
-- iterations: 210000, salt: 1234567890abcdef1234567890abcdef
-- Pre-computed PBKDF2-SHA256 for 'Admin@1234':
INSERT INTO users (id, business_id, name, email, username, password_hash, role, is_active, must_change_password)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Rajesh Kumar (Owner)',
  'admin@bizledger.local',
  'admin',
  'pbkdf2$210000$1234567890abcdef1234567890abcdef$00983abf87ae0728ebca0f1f2affa73e9548c69445aa48286103edbe34623474',
  'owner',
  true,
  false
) ON CONFLICT (email) DO NOTHING;

-- Grant owner full menu permissions
INSERT INTO user_menu_permissions (user_id, menu_key, can_view, can_create, can_edit, can_delete, can_export)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  m,
  true, true, true, true, true
FROM unnest(ARRAY[
  'dashboard', 'customers', 'vendors', 'items', 'sales_invoices', 'purchase_bills',
  'receipts', 'payments', 'cheques', 'banking', 'journal', 'chart_of_accounts',
  'reports', 'gst', 'settings', 'users', 'audit_log'
]) AS m
ON CONFLICT (user_id, menu_key) DO NOTHING;

-- 3. Default Chart of Accounts for Indian Small Business
-- Assets (1000s)
INSERT INTO accounts (id, business_id, code, name, type, is_system) VALUES
('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '1010', 'Cash in Hand', 'asset', true),
('a0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '1020', 'HDFC Bank Current A/c', 'asset', true),
('a0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '1030', 'Accounts Receivable (Sundry Debtors)', 'asset', true),
('a0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '1040', 'Cheques in Hand (PDC Received)', 'asset', true),
('a0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '1050', 'Input CGST', 'asset', true),
('a0000001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '1051', 'Input SGST', 'asset', true),
('a0000001-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '1052', 'Input IGST', 'asset', true),
('a0000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '1060', 'Inventory', 'asset', true)
ON CONFLICT (business_id, code) DO NOTHING;

-- Liabilities (2000s)
INSERT INTO accounts (id, business_id, code, name, type, is_system) VALUES
('b0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2010', 'Accounts Payable (Sundry Creditors)', 'liability', true),
('b0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2020', 'Cheques Issued Clearing Account', 'liability', true),
('b0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '2030', 'Output CGST', 'liability', true),
('b0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '2031', 'Output SGST', 'liability', true),
('b0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '2032', 'Output IGST', 'liability', true),
('b0000001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '2040', 'TDS Payable', 'liability', true)
ON CONFLICT (business_id, code) DO NOTHING;

-- Equity (3000s)
INSERT INTO accounts (id, business_id, code, name, type, is_system) VALUES
('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '3010', 'Owner Capital', 'equity', true),
('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '3020', 'Retained Earnings', 'equity', true)
ON CONFLICT (business_id, code) DO NOTHING;

-- Income (4000s)
INSERT INTO accounts (id, business_id, code, name, type, is_system) VALUES
('d0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '4010', 'Sales Income', 'income', true),
('d0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '4020', 'Service Income', 'income', true),
('d0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '4030', 'Discount Received', 'income', false)
ON CONFLICT (business_id, code) DO NOTHING;

-- Expenses (5000s)
INSERT INTO accounts (id, business_id, code, name, type, is_system) VALUES
('e0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '5010', 'Purchases', 'expense', true),
('e0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '5020', 'Rent Expense', 'expense', false),
('e0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '5030', 'Salaries & Wages', 'expense', false),
('e0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '5040', 'Bank Charges', 'expense', true),
('e0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '5050', 'Round Off Expense / Adjustment', 'expense', true)
ON CONFLICT (business_id, code) DO NOTHING;

-- 4. Sample Parties
INSERT INTO parties (id, business_id, kind, name, gstin, phone, email, address, credit_days, opening_balance) VALUES
('p0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'customer', 'Shree Ram Enterprises', '27BBRPA9876K1Z1', '9820011223', 'accounts@shreeram.in', 'Dadar West, Mumbai, MH', 30, 0),
('p0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'customer', 'TechCorp Solutions Bengaluru', '29AAGCT5544R1Z0', '9845012345', 'billing@techcorp.io', 'Whitefield, Bengaluru, KA', 15, 0),
('p0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'vendor', 'Mahalaxmi Stationery & Logistics', '27AAMFM3322P1Z8', '9821098765', 'orders@mahalaxmi.com', 'Fort, Mumbai, MH', 30, 0)
ON CONFLICT (id) DO NOTHING;

-- 5. Sample Items
INSERT INTO items (id, business_id, name, hsn_sac, unit, sale_price, purchase_price, gst_rate, track_stock, stock_qty) VALUES
('i0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Accounting Consultation Services', '998222', 'Hours', 250000, 0, 18.0, false, 0),
('i0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Enterprise Server Hard Drive 2TB', '847170', 'Nos', 750000, 520000, 18.0, true, 45),
('i0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'GST Filing & Compliance Retainer', '998231', 'Months', 1000000, 0, 18.0, false, 0)
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Cheques to demonstrate Alerts (Overdue, Due Today, Upcoming)
INSERT INTO cheques (id, business_id, direction, party_id, cheque_no, bank_name, branch, amount, cheque_date, status, remarks) VALUES
-- Overdue Cheque (Date 5 days ago)
('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'received', 'p0000001-0000-0000-0000-000000000001', '000412', 'State Bank of India', 'Dadar Branch', 12500000, CURRENT_DATE - INTERVAL '5 days', 'pending', 'Invoice 001 partial payment'),
-- Due Today Cheque
('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'received', 'p0000001-0000-0000-0000-000000000002', '552319', 'ICICI Bank', 'Whitefield Branch', 8500000, CURRENT_DATE, 'pending', 'Annual maintenance PDC'),
-- Upcoming Cheque (Due in 4 days)
('c0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'issued', 'p0000001-0000-0000-0000-000000000003', '100801', 'HDFC Bank', 'Andheri East', 4200000, CURRENT_DATE + INTERVAL '4 days', 'pending', 'Office supplies advance')
ON CONFLICT (id) DO NOTHING;
