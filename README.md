# Brightloop — Subscription Management System

One system to run plans, subscriptions and recurring billing: products with variants, recurring plans, quotations, automatic invoicing with no double billing, discounts, taxes, payments, a customer portal and a finance dashboard that stays fast with thousands of subscriptions.

**Stack:** React + Vite + Tailwind · Node 20 + Express · Prisma + PostgreSQL · Jest + Supertest

---

## Contents

- [Quick start](#quick-start)
  - [macOS / Linux (Docker)](#macos--linux-docker)
  - [Windows](#windows)
- [Demo logins](#demo-logins)
- [Demo walkthrough](#demo-walkthrough)
- [What's built](#whats-built)
- [Business rules the system enforces](#business-rules-the-system-enforces)
- [Tests](#tests)
- [Performance check (5,000 subscriptions)](#performance-check-5000-subscriptions)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [API overview](#api-overview)
- [Known limitations](#known-limitations)

---

## Quick start

You need **Node.js 20+** and **Git**. Both setups end with the app at **http://localhost:5173**.

### macOS / Linux (Docker)

```bash
docker compose up -d   # PostgreSQL 16 on port 5432
npm run setup          # creates .env from .env.example, installs, migrates dev + test DBs, seeds demo data
npm run dev            # client :5173, server :4001
```

### Windows

Choose one way to run PostgreSQL.

**Option A — local PostgreSQL, no Docker.** Install [PostgreSQL 18](https://www.postgresql.org/download/windows/) to the default folder `C:\Program Files\PostgreSQL\18`. The `.bat` scripts run a separate database on **port 5433** inside the repo's `.pgdata` folder, so it won't clash with any Postgres you already have. In PowerShell, from the repo folder:

```powershell
Copy-Item .env.example .env
notepad .env          # change 5432 → 5433 on the two DATABASE_URL lines
.\start-db.bat        # starts Postgres, creates brightloop + brightloop_test on first run
npm run setup
npm test              # expect 68 passed
.\start-dev.bat       # day to day: starts the database, then server + client in two windows
```

`.\stop-db.bat` stops the database. `.\setup-db.bat` re-runs migrations and the seed on the dev database only.

**Option B — Docker Desktop.** Same as macOS:

```powershell
docker compose up -d
npm run setup
npm run dev
```

**Windows notes**
- `npm run setup` copies the root `.env` to `server/.env` only if that file doesn't exist yet. The tests and seed read the root file; Prisma and the server read `server/.env`. If you change one, change the other, or delete `server/.env` and run `npm run setup` again.
- Different PostgreSQL version or folder? Edit the `C:\Program Files\PostgreSQL\18\bin` path in `start-db.bat` and `stop-db.bat`.
- `VAR=value command` doesn't work in PowerShell; the Windows versions of the performance commands are [below](#performance-check-5000-subscriptions).

---

## Demo logins

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@brightloop.com` | `Admin@123!` | Subscriptions (full menu) |
| Internal staff | `staff@brightloop.com` | `Staff@123!` | Subscriptions |
| Customer | `alice@example.com` | `Portal@123!` | My Subscriptions |
| Customer | `bob@example.com` | `Portal@123!` | My Subscriptions |

The seed also creates 3 products (CRM Software has Brand variants: Odoo +560, Generic +0), 3 plans (weekly, monthly, yearly), 2 taxes, 2 payment terms, 1 quotation template, 1 discount rule and 3 active subscriptions.

---

## Demo walkthrough

1. **Sign up** at `/signup`. Try `password1` first to see the rule error, then a valid one such as `Sunrise@2026`.
2. **Admin** (`/admin/products`, `/admin/plans`, `/sales/discounts`, `/admin/users`): products with variants, plans with period, minimum quantity, availability dates and the auto-close / closable / pausable / renewable flags, discount rules, staff accounts.
3. **Staff**: Subscriptions → **New** → pick the *Enterprise CRM Package* template (pre-fills plan and lines) → set a tax per line, expiry date and payment terms → Save → **Send Quote → Confirm → Activate**.
4. **Run Billing** for today: invoices are generated with discount and tax. Run again: *0 generated*.
5. Open the invoice → **Confirm** → **Record payment** for part of it (stays CONFIRMED) → record the rest → **PAID**. **Send** logs the email; **Print View** opens a print-ready page.
6. **Dashboard** (`/finance/dashboard`): KPIs and summary tables change with the plan, date and status filters. **Overdue** lists past-due invoices with days overdue.
7. **Customer** (`alice@example.com` or the account you created): My Subscriptions (pause / resume / renew / close where the plan allows), My Invoices with print view, My Payments.

---

## What's built

| Area | Features |
|---|---|
| **Accounts & roles** | Sign-up with unique email (case-insensitive) and password rule; login; forgot/reset password with a one-time, expiring token; roles ADMIN / INTERNAL / PORTAL; only ADMIN creates staff, taxes, discounts, products and plans |
| **Catalog** | Products (name, type, sales price, cost price, notes) with attribute variants that add to the price; taxes; payment terms |
| **Plans** | Price, period (daily / weekly / monthly / yearly), minimum quantity, availability dates, auto-close / closable / pausable / renewable flags |
| **Quotations & subscriptions** | Quotation templates with validity days; subscriptions with number, customer, plan, start/expiry dates, payment terms and lines (product, variant, qty, unit price, tax, amount); Draft → Quotation → Confirmed → Active → Closed, plus Paused; renew extends the expiry |
| **Billing** | One-click billing run creates invoices from active subscriptions, catches up missed periods, never bills a period twice or past the expiry; discounts and taxes applied automatically; confirm / cancel / send / print; Draft → Confirmed → Paid |
| **Discounts** | Fixed or percent; minimum quantity or purchase; start/end dates; usage limit; product or subscription scope; applied on the next invoice by themselves |
| **Payments** | Method, amount, date, note against an invoice; partial payments; PAID when fully settled; outstanding and overdue views |
| **Customer portal** | Own subscriptions, invoices (with print view) and payments only; pause / resume / renew / close where the plan allows |
| **Finance dashboard** | Active subscriptions, MRR, revenue collected, outstanding, overdue (count + amount), invoices and subscriptions by status; filters by date range, plan and invoice status |

---

## Business rules the system enforces

- **Money** is stored as `Decimal(12,2)` and computed with `decimal.js`; never floating point. Line order is `qty × unit price → discount → tax`, rounded to 2 decimals.
- **Password:** more than 8 characters, with an uppercase letter, a lowercase letter and a special character. Emails are lowercased before save and lookup.
- **Status changes** go through one state machine (`server/src/lib/states.js`); invalid moves return `409`. Pausing needs `plan.pausable`; closing early needs `plan.closable`; renewing needs `plan.renewable`; confirming a quotation after its validity date is refused.
- **No double billing:** a unique constraint on `(subscriptionId, billedPeriod)` plus a catch in the billing run. Cancelling an invoice frees its period for re-billing. Billing never creates a period that starts on or after the subscription's expiry.
- **Discount usage** is incremented in the same transaction as the invoice.
- **PAID** is set only by the payments route, only when `amountPaid = total`. Payments are rejected when the amount is ≤ 0, more than the outstanding balance, or the invoice isn't CONFIRMED. The invoice row is locked while a payment is recorded.
- **Overdue** = CONFIRMED with a balance and `dueDate` before today. Due today is not overdue.
- **Portal isolation:** every portal query is filtered by the customer id in the login token, never by an id from the URL. Another customer's record returns `404`.
- **Reports** use `aggregate` / `groupBy` / `count`; no table is loaded into memory. Lists are paginated (`page`, `pageSize` ≤ 100).

---

## Tests

```bash
npm test
```

68 tests in 10 suites, run against `brightloop_test`, each suite starting from an empty database. They cover: password rule, duplicate email, reset token, role guards, variant price, state transitions, billing idempotency and catch-up, paused/closed not billed, expiry stops billing, quotation validity, plan availability dates, discount usage limit and expiry, invoice totals to the cent (product and subscription discounts), payments (overpayment, partial → full → PAID, draft rejected), overdue boundary, portal isolation and self-service, dashboard KPIs against a hand-calculated fixture.

---

## Performance check (5,000 subscriptions)

macOS / Linux:

```bash
SEED_SIZE=large npm run seed     # +500 customers, 5,000 subscriptions, 10,000 invoices, ~5,750 payments
PERF=1 npm test -- perf          # subscriptions list, invoices list, dashboard, overdue: each must answer < 2 s
```

Windows (PowerShell):

```powershell
$env:SEED_SIZE="large"; npm run seed; Remove-Item Env:SEED_SIZE
$env:PERF="1"; npm test -- perf; Remove-Item Env:PERF
```

Measured on an M-series Mac: every endpoint answers in 5–60 ms. To go back to the small demo seed:

```bash
npx -w server prisma migrate reset --force
```

---

## Configuration

`.env` in the repo root (created from `.env.example` by `npm run setup`):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/brightloop` | Dev database |
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5432/brightloop_test` | Test database (`npm test`) |
| `JWT_SECRET` | dev value | **Change before deploying** |
| `PORT` | `4001` | Server port; the Vite proxy reads the same value |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |

**Before deploying:** set a long random `JWT_SECRET`, and don't run the demo seed against the production database (its passwords are in this README).

| Script | What it does |
|---|---|
| `npm run setup` | Create `.env` if missing, install, migrate dev + test DBs, seed |
| `npm run dev` | Start client and server |
| `npm test` | Server tests (perf suite skipped unless `PERF=1`) |
| `npm run seed` | Re-seed (`SEED_SIZE=large` for the 5k data set) |

---

## Project layout

```
client/src/
  api.js                 fetch wrapper (token, JSON, errors)
  auth/                  AuthContext, ProtectedRoute
  components/            Layout, Table, FormModal, StatusBadge, KpiCard, LineItemsEditor
  pages/auth|admin|sales|billing|finance|portal/
server/
  prisma/schema.prisma   all models, indexes, unique constraints
  prisma/seed.js         demo data (+ SEED_SIZE=large)
  src/app.js             Express app, route mounts
  src/lib/               auth, money, pagination, errors, numbering, states, pricing, billing, reports
  src/routes/            one file per module
  src/tests/             one test file per module
docs/HANDOFF.md          build notes per stage: contracts, decisions, cut items
```

---

## API overview

All routes are under `/api`, JSON in and out, `Authorization: Bearer <token>`. Errors are `{ "error": "message" }` with 400 / 401 / 403 / 404 / 409. Lists return `{ data, total, page, pageSize }`.

| Module | Routes | Roles |
|---|---|---|
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/forgot`, `/auth/reset`, `GET /auth/me` | public / any |
| Users | `GET/POST /users` | ADMIN |
| Customers | `GET/POST /customers`, `GET /customers/:id` | ADMIN, INTERNAL |
| Products | `GET/POST /products`, `GET/PUT /products/:id`, `POST/PUT/DELETE /products/:id/attributes` | read: staff · write: ADMIN |
| Plans, Taxes, Payment terms | `GET/POST /plans`, `/taxes`, `/payment-terms` (+ `:id`) | read: staff · write: ADMIN |
| Templates | `GET/POST /templates`, `GET/PUT/DELETE /templates/:id` | ADMIN, INTERNAL |
| Subscriptions | `GET/POST /subscriptions`, `GET /subscriptions/:id`, `POST /subscriptions/:id/transition`, `POST /subscriptions/:id/renew` | ADMIN, INTERNAL |
| Discounts | `GET /discounts`; `POST/PUT/DELETE` | read: staff · write: ADMIN |
| Billing | `POST /billing/run { date }` | ADMIN, INTERNAL |
| Invoices | `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/confirm` / `cancel` / `send` | ADMIN, INTERNAL |
| Payments | `GET /payments`, `POST /payments { invoiceId, amount, method, date, note }` | ADMIN, INTERNAL |
| Reports | `GET /reports/dashboard?from&to&planId&status`, `GET /reports/overdue` | ADMIN, INTERNAL |
| Portal | `GET /portal/subscriptions`, `/portal/subscriptions/:id`, `/portal/invoices`, `/portal/invoices/:id`, `/portal/payments`; `POST /portal/subscriptions/:id/transition` / `renew` | PORTAL (own data only) |

---

## Known limitations

- **No email provider.** The password reset link and "send invoice" are written to the server console instead of being emailed.
- **Invoice amounts come from the subscription's product lines** (product price + variant extra). The plan's price is shown as the list price and sets the billing period and rules; it isn't added to invoices on top of the lines.
- Invoice "print" uses the browser's print dialog; there's no PDF generation.
- Billing is started with the **Run Billing** button; there's no scheduler.
