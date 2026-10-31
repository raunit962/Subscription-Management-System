# Brightloop Subscription Management System — 4-Hour Build Plan

> **Hard limit: 4 hours total.** Stack: **React (Vite, JavaScript) · Node.js/Express (JavaScript) · PostgreSQL · Prisma**.
> **3 strictly sequential stages**, one owner each. A stage starts only after the previous one has **passed its test gate and been pushed + merged** to `main`.
> Scope is cut to what can be built, tested and demoed in 4h. Items marked **(cut-first)** are dropped the moment a stage runs late.

---

## 0. Timeline & Ownership

| Time | Stage | Owner | Branch | Tag |
|---|---|---|---|---|
| 0:00 – 1:15 | 1 — Foundation | Person A `<name>` | `stage-1` | `v0.1` |
| 1:15 – 2:35 | 2 — Billing Core | Person B `<name>` | `stage-2` | `v0.2` |
| 2:35 – 3:45 | 3 — Payments, Portal, Dashboard | Person C `<name>` | `stage-3` | `v1.0` |
| 3:45 – 4:00 | Buffer, README check, submission | All | `main` | — |

**Inside every stage:** build ≈ 55–60 min → test ≈ 10–12 min → push/merge ≈ 5 min.

**Hard rules for the clock**
- At **T-20 min** in your stage: stop new features, cut all *(cut-first)* items, start testing.
- A stage may not overrun by more than **10 min**. Unfinished work → listed in `docs/HANDOFF.md` and dropped.
- While waiting, B and C may only **prepare their machine** (Node 20, Docker/Postgres, editor, read `plan.md` + `claude.md`). No code — the stages are strictly sequential.
- Merge review = next owner runs `git pull && npm run setup && npm test` (≈3 min). That is the handoff check.

**Risk accepted:** strict sequencing means any Stage 1 slip directly shrinks Stages 2 and 3. Stage 1 must be ruthless about scope.

---

## 1. Scope (in / out)

| Brief requirement | In 4h version | Stage |
|---|---|---|
| Sign-up, unique email, password rule (>8, upper, lower, special) | ✅ | 1 |
| Password reset link | ✅ link **logged to server console** (no real email) | 1 |
| Roles Admin / Internal / Portal; only Admin creates staff | ✅ | 1 |
| Products + variants (Brand = Odoo → +560) | ✅ one attribute type, values with extra price | 1 |
| Recurring plans (period, min qty, dates, autoClose/closable/pausable/renewable flags) | ✅ flags stored; enforced in Stage 2 | 1 |
| Taxes, payment terms | ✅ simple CRUD | 1 |
| Quotation templates with validity days | ✅ minimal (plan + lines + validity) | 2 |
| Subscriptions + Draft → Quotation → Confirmed → Active → Closed | ✅ (+ Paused if plan allows) | 2 |
| Discounts (fixed/percent, min qty/purchase, dates, usage limit, product/subscription scope) | ✅ | 2 |
| Auto invoices, no double billing / no skipping | ✅ **manual "Run billing" button** (no cron) | 2 |
| Invoice confirm / cancel / send / print | ✅ send = console log; print = print-styled page + `window.print()` | 2 |
| Payments, paid vs outstanding, overdue | ✅ | 3 |
| Customer portal (own subscriptions, invoices) | ✅ read-only | 3 |
| Finance dashboard with filters + summary | ✅ KPI cards + filtered tables; charts *(cut-first)* | 3 |
| < 2s with thousands of subscriptions | ✅ indexes + pagination + 5k seed check | 3 |
| Real emails, PDFs, cron, CSV export, CI pipeline, Playwright | ❌ out of scope | — |

---

## 2. Architecture (fixed — don't debate it during the build)

See **§2.1 Folder Structure** for the full tree. Summary: `client/` (React + Vite, JS, React Router, Tailwind, `api.js` fetch wrapper) and `server/` (Express, Prisma, flat `routes/` + `lib/` + `tests/`).
- **Money:** Prisma `Decimal(12,2)` + `decimal.js` in `lib/money.js`. No float math.
- **Auth:** bcrypt + JWT in `Authorization: Bearer` header (simplest), role in token.
- **API:** `/api/*`, JSON, errors `{ error: "message" }` with correct HTTP status.
- **Lists:** paginated `?page=&pageSize=` (default 20, max 100).
- **Own Postgres** via `docker compose`.

---

## 2.1 Folder Structure (maintained across all 3 stages)

Tags show **which stage creates the file**: `[S1]` Person A · `[S2]` Person B · `[S3]` Person C. Stage 1 creates every folder (with a `.gitkeep` where empty) so the tree exists from the first commit.

```
brightloop-subscriptions/
├── .gitignore                         [S1]  node_modules, .env, dist, coverage
├── .env.example                       [S1]  DATABASE_URL, DATABASE_URL_TEST, JWT_SECRET, PORT, CLIENT_URL
├── docker-compose.yml                 [S1]  postgres:16 (dev db + test db)
├── package.json                       [S1]  root scripts: setup, dev, test, seed (npm workspaces: client, server)
├── README.md                          [S1 create · S3 finalise]  setup, demo logins, demo script
├── plan.md                                  this file
├── claude.md                                build rules; "Current stage" updated by each owner
├── docs/
│   └── HANDOFF.md                     [S1 create · S2, S3 append]
│
├── server/
│   ├── package.json                   [S1]
│   ├── jest.config.js                 [S1]
│   ├── prisma/
│   │   ├── schema.prisma              [S1]  ALL models + indexes + unique constraints (§3)
│   │   ├── migrations/                [S1]  generated; S2/S3 add only if unavoidable
│   │   └── seed.js                    [S1 base data · S2 template/subs/discounts · S3 SEED_SIZE=large]
│   └── src/
│       ├── index.js                   [S1]  starts server
│       ├── app.js                     [S1]  express app, middleware, mounts routes (S2/S3 add mount lines only)
│       ├── lib/
│       │   ├── prisma.js              [S1]  single PrismaClient
│       │   ├── auth.js                [S1]  password validator, hash, JWT, requireAuth, requireRole
│       │   ├── money.js               [S1]  decimal helpers (add, mul, pct, round2)
│       │   ├── pagination.js          [S1]  parse page/pageSize, build { data, total, page, pageSize }
│       │   ├── errors.js              [S1]  HttpError + error-handler middleware
│       │   ├── numbering.js           [S2]  SUB-0001 / INV-0001 generators
│       │   ├── states.js              [S2]  subscription + invoice transition rules
│       │   ├── pricing.js             [S2]  line amount, discount applicability, tax calc
│       │   ├── billing.js             [S2]  generateInvoice, runBilling, period math
│       │   └── reports.js             [S3]  KPI aggregates (SQL/groupBy only)
│       ├── routes/
│       │   ├── auth.routes.js         [S1]  signup, login, me, forgot, reset
│       │   ├── users.routes.js        [S1]  admin: create/list staff
│       │   ├── customers.routes.js    [S1]
│       │   ├── products.routes.js     [S1]  products + attribute values (variants)
│       │   ├── plans.routes.js        [S1]
│       │   ├── taxes.routes.js        [S1]
│       │   ├── paymentTerms.routes.js [S1]
│       │   ├── templates.routes.js    [S2]  quotation templates
│       │   ├── subscriptions.routes.js[S2]  CRUD + /:id/transition
│       │   ├── discounts.routes.js    [S2]
│       │   ├── invoices.routes.js     [S2]  list, detail, confirm, cancel, send
│       │   ├── billing.routes.js      [S2]  POST /api/billing/run
│       │   ├── payments.routes.js     [S3]
│       │   ├── portal.routes.js       [S3]  /api/portal/* scoped by customerId
│       │   └── reports.routes.js      [S3]  dashboard KPIs, overdue
│       └── tests/
│           ├── helpers.js             [S1]  reset test DB, create users/tokens, fixtures
│           ├── auth.test.js           [S1]
│           ├── roles.test.js          [S1]
│           ├── products.test.js       [S1]  Odoo +560 variant
│           ├── states.test.js         [S2]
│           ├── billing.test.js        [S2]  idempotency, catch-up, paused/closed skipped
│           ├── discounts.test.js      [S2]
│           ├── totals.test.js         [S2]
│           ├── payments.test.js       [S3]
│           ├── portal.test.js         [S3]  cross-customer isolation
│           ├── reports.test.js        [S3]
│           └── perf.test.js           [S3]  < 2s checks on large seed (skipped unless PERF=1)
│
└── client/
    ├── package.json                   [S1]
    ├── vite.config.js                 [S1]  /api proxy → :4000
    ├── index.html                     [S1]
    ├── tailwind.config.js             [S1]
    └── src/
        ├── main.jsx                   [S1]
        ├── App.jsx                    [S1]  router; S2/S3 add <Route> lines only
        ├── api.js                     [S1]  fetch wrapper (token, JSON, errors)
        ├── auth/
        │   ├── AuthContext.jsx        [S1]  user, role, login/logout
        │   └── ProtectedRoute.jsx     [S1]  role-based guard
        ├── components/                [S1]  shared — S2/S3 reuse, never duplicate
        │   ├── Layout.jsx                    role-aware sidebar (S2/S3 add menu items)
        │   ├── Table.jsx                     server pagination + filters
        │   ├── FormModal.jsx
        │   ├── StatusBadge.jsx
        │   └── KpiCard.jsx            [S3]
        ├── utils/
        │   ├── validators.js          [S1]  same password regex as server
        │   └── format.js              [S1]  money/date formatting
        └── pages/
            ├── auth/                  [S1]  Login, Signup, ForgotPassword, ResetPassword
            ├── admin/                 [S1]  Users, Products, Plans, Taxes, PaymentTerms
            ├── sales/                 [S2]  Templates, Subscriptions, SubscriptionDetail, Discounts
            ├── billing/               [S2]  Invoices, InvoiceDetail, InvoicePrint, RunBilling
            ├── finance/               [S3]  Payments, Overdue, Dashboard
            └── portal/                [S3]  MySubscriptions, MyInvoices, MyPayments
```

**Structure rules (all stages)**
1. **One module = one route file + one test file** with matching names (`payments.routes.js` ↔ `payments.test.js`). Shared logic goes in `server/src/lib/`, never copied between route files.
2. **New pages go in the folder of their area** (`admin/`, `sales/`, `billing/`, `finance/`, `portal/`). Shared UI only in `components/`.
3. **Shared files are append-only for later stages:** `app.js` (mount lines), `App.jsx` (routes), `Layout.jsx` (menu items), `seed.js` (new seed blocks). Don't rewrite what a previous stage wrote.
4. **`schema.prisma` belongs to Stage 1.** Later stages change it only if a test gate can't pass otherwise, and must record it in HANDOFF.md.
5. **No new top-level folders** and no renaming/moving existing files. If something doesn't fit, ask the next owner or note it in HANDOFF.md.
6. **Before each stage PR**, the owner runs `git status` and checks every new file sits where this tree says. The next owner checks the same during the merge review.

---

## 3. Data Model (Stage 1 writes the **whole** schema once, so later stages don't migrate under time pressure)

| Model | Key fields |
|---|---|
| `User` | email (unique, lowercased), passwordHash, name, role `ADMIN/INTERNAL/PORTAL`, customerId?, resetToken?, resetExpires? |
| `Customer` | name, email, phone |
| `Product` | name, type, salesPrice, costPrice, notes |
| `AttributeValue` | productId, attribute (e.g. "Brand"), value (e.g. "Odoo"), extraPrice |
| `Plan` | name, price, period `DAILY/WEEKLY/MONTHLY/YEARLY`, minQty, startDate, endDate, autoClose, closable, pausable, renewable |
| `Tax` | name, percent |
| `PaymentTerm` | name, dueDays |
| `QuoteTemplate` | name, planId, validityDays, lines (Json: productId, attributeValueId?, qty) |
| `Subscription` | number, customerId, planId, startDate, expiryDate, paymentTermId, status, nextInvoiceDate |
| `SubscriptionLine` | subscriptionId, productId, attributeValueId?, qty, unitPrice, taxId?, amount |
| `Discount` | name, type `FIXED/PERCENT`, value, minQty, minPurchase, startDate, endDate, usageLimit, usageCount, scope `PRODUCT/SUBSCRIPTION`, productId? |
| `Invoice` | number, subscriptionId, customerId, periodStart, periodEnd, billedPeriod?, invoiceDate, dueDate, status `DRAFT/CONFIRMED/PAID/CANCELLED`, subtotal, discountTotal, taxTotal, total, amountPaid |
| `InvoiceLine` | invoiceId, description, qty, unitPrice, discount, tax, amount |
| `Payment` | invoiceId, method, amount, date, note |

**Must-have constraints & indexes (in schema from Stage 1):**
- Unique per subscription + billed period on `Invoice` → no double billing. To allow re-billing after a cancel, `billedPeriod` (nullable copy of `periodStart`) carries the unique constraint and is set to `null` on cancel — Postgres treats NULLs as distinct, so the period frees up. Constraint is therefore `@@unique([subscriptionId, billedPeriod])`.
- Indexes: `Subscription(status)`, `Subscription(customerId)`, `Subscription(nextInvoiceDate)`, `Invoice(status, dueDate)`, `Invoice(customerId)`, `Payment(invoiceId)`.
- Numbers `SUB-0001`, `INV-0001` generated from a DB sequence/count inside the transaction.

---

## 4. Stage 1 — Foundation · Person A · 0:00 – 1:15

### Build (in this order)
1. **(10 min)** Repo skeleton, `docker-compose.yml`, root scripts: `setup` (install + migrate + seed), `dev`, `test`. `.env.example`.
2. **(10 min)** Full Prisma schema (§3) + migration + seed: 1 admin, 1 internal, 2 portal customers, 3 products (one with Brand: Odoo +560, Generic +0), 3 plans (monthly, yearly, weekly), 2 taxes, 2 payment terms.
3. **(15 min)** Auth: signup (PORTAL + creates Customer), login, `me`, forgot (logs link), reset. Password validator in `lib/auth.js`. `requireRole(...roles)` middleware.
4. **(10 min)** Admin-only: create/list internal users.
5. **(10 min)** CRUD APIs: products + attribute values, plans, taxes, payment terms.
6. **(15 min)** Client: login/signup/forgot/reset pages, layout with role-based sidebar, generic `Table` + `FormModal` components, pages for users, products, plans, taxes, payment terms.

**(cut-first):** edit/delete screens (keep create + list), payment-term UI (seed only).

### Test gate (≈10 min) — all must pass
- [ ] `password rule: rejects 8 chars / no upper / no lower / no special; accepts valid`
- [ ] `signup: duplicate email (different case) → 409`
- [ ] `reset: token works once, then fails`
- [ ] `roles: INTERNAL creating staff → 403; PORTAL on /api/products POST → 403`
- [ ] `variant price: Odoo adds 560`
- [ ] Manual: fresh `npm run setup && npm run dev` → log in as admin, internal, portal.

### Push
`stage-1` → PR → Person B pulls, runs `setup` + `test` → merge → tag `v0.1`. Update `docs/HANDOFF.md`.

---

## 5. Stage 2 — Billing Core · Person B · 1:15 – 2:35

**Start:** `v0.1` merged and runs on B's machine.

### Build
1. **(10 min)** `lib/states.js` — allowed transitions:
   `DRAFT→QUOTATION→CONFIRMED→ACTIVE→CLOSED`; `ACTIVE↔PAUSED` only if `plan.pausable`; `ACTIVE→CLOSED` early only if `plan.closable`; renew (extend expiry) only if `plan.renewable`. Invalid → 409.
2. **(15 min)** Subscriptions API + page: create (manual or from template), lines with qty ≥ plan.minQty, unit price = product price + variant extra, tax per line, status buttons, status badge in list.
3. **(5 min)** Quote templates: create/list; "use template" pre-fills subscription. Quotation expiry = created + validityDays (shown, not enforced by job).
4. **(10 min)** Discounts (admin only): create/list; `isApplicable(discount, sub, date)` in `lib/billing.js`.
5. **(20 min)** `lib/billing.js`:
   - `generateInvoice(sub, periodStart)` in one transaction: lines → discount → tax → totals; increments discount usage; advances `nextInvoiceDate`.
   - `runBilling(date)`: for each ACTIVE subscription, loop while `nextInvoiceDate ≤ date` (catches up missed periods). Unique constraint + catch on duplicate → skip, never double bill.
   - autoClose: plan with `autoClose` and expiry passed → CLOSED, not billed.
6. **(10 min)** Invoice API + pages: list (status filter), detail, confirm / cancel / send (console log) / print (print-styled detail page).

**(cut-first):** quote templates UI (keep API + seed one template), renew button.

### Test gate (≈12 min) — all must pass
- [ ] Stage 1 tests still green.
- [ ] `states: every invalid transition → 409; pause blocked when plan not pausable`
- [ ] `billing: running twice for same date creates no duplicates`
- [ ] `billing: subscription 3 months behind → exactly 3 invoices`
- [ ] `billing: paused/closed subscriptions not billed`
- [ ] `discount: limit 1 used by 2 subscriptions → applied once; expired → not applied`
- [ ] `totals: fixture invoice subtotal/discount/tax/total match by hand to the cent`
- [ ] Manual: create sub from template → activate → Run billing → invoice correct → print view opens.

### Push
`stage-2` → PR → Person C pulls, `setup` + `test` → merge → tag `v0.2`. Update HANDOFF.

---

## 6. Stage 3 — Payments, Portal, Dashboard · Person C · 2:35 – 3:45

**Start:** `v0.2` merged and runs on C's machine.

### Build
1. **(15 min)** Payments API + UI: record against invoice (method, amount, date, note). Reject amount ≤ 0, > outstanding, or on DRAFT/CANCELLED invoice. When `amountPaid = total` → PAID.
2. **(10 min)** Outstanding / overdue: outstanding = CONFIRMED and unpaid balance; overdue = outstanding and `dueDate < today`. Overdue page with days overdue.
3. **(10 min)** Portal (PORTAL role): My subscriptions, My invoices (with print view), My payments — every query filtered by `req.user.customerId`.
4. **(15 min)** Dashboard: KPI cards (active subscriptions, revenue collected in range, outstanding, overdue count + amount, MRR); filters (date range, plan, status); summary table. Aggregates with Prisma `aggregate`/`groupBy` — no loading full tables.
5. **(10 min)** Performance: `SEED_SIZE=large` seeds 5,000 subscriptions + invoices via `createMany`; check list + dashboard endpoints < 2s; README with setup + demo logins + demo script.

**(cut-first):** charts, payments list page (keep payments on invoice detail), MRR.

### Test gate (≈10 min) — all must pass
- [ ] Stage 1 + 2 tests green.
- [ ] `payments: overpayment rejected; partial then full → PAID; payment on DRAFT rejected`
- [ ] `overdue: due today is not overdue; due yesterday is`
- [ ] `portal: customer A reading customer B's invoice/subscription → 404`
- [ ] `dashboard: KPIs on fixed fixture equal hand-calculated values`
- [ ] Timing: with large seed, subscriptions list, invoices list and dashboard each < 2s (simple timed request in test or `curl -w`).
- [ ] Manual demo run-through (§7) works end to end.

### Push
`stage-3` → PR → Person A pulls, `setup` + `test` → merge → tag `v1.0`.

---

## 7. Demo Script (final 15 min check, ≈5 min to present)

1. Sign up as a new customer (show password rule error first).
2. Admin: create product with Brand Odoo (+560), monthly plan, 10% discount min qty 5.
3. Internal: create subscription from template, qty 5, activate.
4. Run billing → invoice shows discount + tax; run again → no duplicate.
5. Record partial then full payment → PAID.
6. Customer portal shows the subscription and paid invoice.
7. Dashboard: KPIs and overdue list update; filter by plan.

---

## 8. HANDOFF.md (each owner, 3 min max)
- Built: endpoints + pages.
- Contracts next stage uses (function names, routes, components).
- Cut items / known bugs.
- Test results (count passed).

## 9. Git
- `main` changes only through stage PRs.
- Commit + push the stage branch every ~20 min (backup).
- Conventional-ish messages: `feat: ...`, `fix: ...`, `test: ...`.
- Never commit `.env`.
