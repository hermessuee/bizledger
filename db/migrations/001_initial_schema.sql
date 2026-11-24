-- BizLedger Database Migration 001
-- PostgreSQL on Neon

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gstin TEXT,
  state_code TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  fy_start_month INT NOT NULL DEFAULT 4,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','accountant','staff','viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, username),
  UNIQUE (email)
);

-- 3. User Menu Permissions
CREATE TABLE IF NOT EXISTS user_menu_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, menu_key)
);

-- 4. Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false
);

-- 5. Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id UUID REFERENCES accounts(id),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (business_id, code)
);

-- 6. Parties (Customers & Vendors)
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('customer','vendor','both')),
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_days INT DEFAULT 0,
  opening_balance BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 7. Items & Services
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hsn_sac TEXT,
  unit TEXT DEFAULT 'Nos',
  sale_price BIGINT DEFAULT 0,
  purchase_price BIGINT DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  track_stock BOOLEAN DEFAULT false,
  stock_qty NUMERIC(14,3) DEFAULT 0
);

-- 8. Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_no TEXT NOT NULL,
  entry_date DATE NOT NULL,
  narration TEXT,
  source_type TEXT, -- 'invoice', 'bill', 'receipt', 'payment', 'cheque', 'manual'
  source_id UUID,
  is_void BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Journal Lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  party_id UUID REFERENCES parties(id),
  debit BIGINT NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit BIGINT NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (debit = 0 OR credit = 0),
  CHECK (debit > 0 OR credit > 0)
);

-- 10. Documents (Sales Invoices, Purchase Bills, Credit/Debit Notes)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('sales_invoice','purchase_bill','credit_note','debit_note')),
  doc_no TEXT NOT NULL,
  doc_date DATE NOT NULL,
  due_date DATE,
  party_id UUID NOT NULL REFERENCES parties(id),
  place_of_supply TEXT,
  subtotal BIGINT NOT NULL,
  tax_total BIGINT NOT NULL,
  round_off BIGINT DEFAULT 0,
  total BIGINT NOT NULL,
  paid_amount BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'posted', 'void'
  entry_id UUID REFERENCES journal_entries(id),
  UNIQUE (business_id, doc_type, doc_no)
);

-- 11. Document Lines
CREATE TABLE IF NOT EXISTS document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description TEXT,
  hsn_sac TEXT,
  qty NUMERIC(14,3) NOT NULL,
  rate BIGINT NOT NULL,
  discount BIGINT DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  cgst BIGINT DEFAULT 0,
  sgst BIGINT DEFAULT 0,
  igst BIGINT DEFAULT 0,
  line_total BIGINT NOT NULL
);

-- 12. Cheques & Post-Dated Cheques
CREATE TABLE IF NOT EXISTS cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('received','issued')),
  party_id UUID NOT NULL REFERENCES parties(id),
  cheque_no TEXT NOT NULL,
  bank_name TEXT,
  branch TEXT,
  bank_account_id UUID REFERENCES accounts(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  cheque_date DATE NOT NULL,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','deposited','cleared','bounced','cancelled','stale','replaced')),
  bounce_reason TEXT,
  bank_charges BIGINT DEFAULT 0,
  snoozed_until DATE,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Cheque Documents Link
CREATE TABLE IF NOT EXISTS cheque_documents (
  cheque_id UUID REFERENCES cheques(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  amount BIGINT,
  PRIMARY KEY (cheque_id, document_id)
);

-- 14. Payments Received & Paid
CREATE TABLE IF NOT EXISTS payments_received_paid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('receipt','payment')),
  party_id UUID NOT NULL REFERENCES parties(id),
  pay_date DATE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cash','bank','upi','cheque')),
  bank_account_id UUID REFERENCES accounts(id),
  cheque_id UUID REFERENCES cheques(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  reference TEXT,
  entry_id UUID REFERENCES journal_entries(id)
);

-- 15. Document Counters (Gap-Free Sequence Per Type & FY)
CREATE TABLE IF NOT EXISTS doc_counters (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  fy TEXT NOT NULL,
  last_no INT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, doc_type, fy)
);

-- 16. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Reminder Log
CREATE TABLE IF NOT EXISTS reminder_log (
  cheque_id UUID REFERENCES cheques(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sent_on DATE NOT NULL,
  PRIMARY KEY (cheque_id, user_id, sent_on)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_cheques_lookup ON cheques (business_id, status, cheque_date);
CREATE INDEX IF NOT EXISTS idx_documents_lookup ON documents (business_id, doc_type, doc_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_biz ON audit_log (business_id, created_at DESC);
