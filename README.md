# BizLedger - Small Business Accounting & Finance Web App

A production-grade, double-entry web application engineered for small businesses in India, built entirely on free-tier services:
- **Frontend**: Next.js with static export (`output: 'export'`), deployed to **GitHub Pages**.
- **Backend API**: Cloudflare Workers using the **Hono** framework + TypeScript.
- **Database**: **Neon PostgreSQL** serverless driver via `@neondatabase/serverless`.
- **Client-Side PDF**: **jsPDF** & **jspdf-autotable** for zero-cost PDF generation.
- **Transactional Email**: **Resend** free tier.
- **Scheduled Jobs**: **Cloudflare Cron Triggers** running daily at 8:00 AM IST for cheque alert digests.
- **CI/CD**: Automatic GitHub Actions workflows for web and API deployments.

---

## 🌟 Key Features

1. **Pop-up Cheque & PDC Alerts (Must-Have)**:
   - Automated pop-up modal on login and on viewing the dashboard.
   - Categorized into:
     - 🔴 **Overdue Cheques** (Past due date & un-cleared)
     - 🟠 **Due Today**
     - 🟡 **Due in Next 7 Days**
   - Quick actions per cheque: **Mark Cleared**, **Mark Deposited**, **Snooze (1d, 3d)**, or **Dismiss**.
   - Header notification bell with live unread badge count, polling every 5 minutes.
   - Daily 8:00 AM IST email digest via Cloudflare Cron Trigger and Resend.
   - Auto-flags stale cheques after 90 days.

2. **Indian GST Invoicing & Compliance**:
   - GSTIN format and state code verification.
   - Automatic tax engine: Intra-state (**CGST + SGST**) vs Inter-state (**IGST**).
   - Line items with HSN/SAC codes, tax rates (0%, 5%, 12%, 18%, 28%), and automatic nearest-rupee round-off.
   - Downloadable and printable Tax Invoice PDFs and Cheque Vouchers with amount in Indian words (*Lakhs & Crores*).
   - GSTR-1 Sales Register and ITC Summary exportable to CSV.

3. **Strict Double-Entry Bookkeeping**:
   - Amounts stored as integer **paise** (`BIGINT`), formatted in Indian numbering (`₹ 12,34,567.89`).
   - Every transaction (invoices, receipts, cheque clearances, bounces) automatically produces balanced journal entries where `Debit === Credit`. Unbalanced entries are strictly rejected.
   - Immutable audit trail: posted records are voided with exact reversal entries, never hard-deleted.
   - Live **Trial Balance**, **Profit & Loss**, **Balance Sheet** (`Assets = Liabilities + Equity`), and **Account Ledgers**.

4. **Granular Menu-Level Permissions & Security**:
   - Four roles: **Owner**, **Accountant**, **Staff**, **Viewer**.
   - Admin screen allows custom per-user checklist across all 17 menus: **View**, **Create**, **Edit**, **Delete/Void**, and **Export**.
   - Enforced both in UI and on every backend API endpoint.
   - Password hashing with **PBKDF2-SHA256** (210,000 iterations) via Web Crypto.
   - Rate limiting: 5 failed attempts locks the account for 15 minutes.

---

## 📁 Repository Layout

```
bizledger/
  apps/
    web/            # Next.js static export (GitHub Pages)
    api/            # Cloudflare Worker API (Hono)
  packages/
    shared/         # Shared TypeScript types, zod schemas, money & GST utils
  db/
    migrations/     # SQL migration files for Neon PostgreSQL
    seed.sql        # Demo business, admin user, standard Indian chart of accounts
  .github/workflows/
    deploy-web.yml  # Deploys static export to GitHub Pages
    deploy-api.yml  # Deploys Worker to Cloudflare
  .env.example
  README.md
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js >= 20
- npm >= 10

### 1. Installation
```bash
npm install
```

### 2. Run Tests
Run unit tests verifying GST calculations, Indian money conversions, double-entry balance check, and PBKDF2 hashing:
```bash
npm run test --workspace=@bizledger/api
```

### 3. Run Locally
Start the frontend and backend concurrently:
```bash
# Terminal 1: Backend API (Cloudflare Worker via Wrangler)
npm run dev:api

# Terminal 2: Frontend Web App (Next.js)
npm run dev:web
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Demo Credentials
- **Username**: `admin`
- **Password**: `Admin@1234`

---

## 🗄️ Database Setup (Neon PostgreSQL)

1. Create a free PostgreSQL instance on [Neon](https://neon.tech).
2. Run the migration script in Neon SQL Console:
   - `db/migrations/001_initial_schema.sql`
3. Seed default demo data (Standard Indian Chart of Accounts, Apex Trading company, sample PDC cheques):
   - `db/seed.sql`

---

## ☁️ Cloudflare Workers Deployment

1. Install and authenticate Wrangler:
   ```bash
   npx wrangler login
   ```
2. Set your production secrets:
   ```bash
   cd apps/api
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put ALLOWED_ORIGIN
   ```
3. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy --workspace=@bizledger/api
   ```

---

## 🌐 GitHub Pages Frontend Deployment

1. Push the code to your GitHub repository `main` branch.
2. In GitHub repository **Settings -> Pages**:
   - Set **Source** to **GitHub Actions**.
3. In GitHub repository **Settings -> Secrets and variables -> Actions**:
   - Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   - Add `NEXT_PUBLIC_API_URL` (URL of your deployed Cloudflare Worker)
4. The workflow in `.github/workflows/deploy-web.yml` will automatically build the static export and deploy to GitHub Pages.

---

## 🛡️ Free-Tier Best Practices Followed
- **Neon**: Uses `@neondatabase/serverless` connection pooler. Client includes automatic retry for idle database wake-up.
- **Cloudflare Workers**: Lightweight V8 execution, minimal bundle size, zero Node runtime polyfills.
- **GitHub Pages**: Zero server overhead with client-side PDF generation via jsPDF and client-side routing.
- **Resend**: Aggregates daily cheque alerts into a single digest email per user to conserve daily quotas.
