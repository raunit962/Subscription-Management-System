# Handoff Notes

## Stage 1 — Foundation (Person A)

---

### Built

#### Server — routes live at `/api/*`

| Route file | Endpoints |
|---|---|
| `auth.routes.js` | `POST /signup`, `POST /login`, `GET /me`, `POST /forgot`, `POST /reset` |
| `users.routes.js` | `POST /users` (ADMIN), `GET /users` (ADMIN), `GET /users/:id` (ADMIN) |
| `customers.routes.js` | `POST /customers`, `GET /customers`, `GET /customers/:id` (ADMIN/INTERNAL) |
| `products.routes.js` | `GET/POST /products`, `GET/PUT /products/:id`, `POST/PUT/DELETE /products/:id/attributes` |
| `plans.routes.js` | `GET/POST /plans`, `GET/PUT /plans/:id` |
| `taxes.routes.js` | `GET/POST /taxes`, `GET/PUT/DELETE /taxes/:id` |
| `paymentTerms.routes.js` | `GET/POST /payment-terms`, `GET/PUT/DELETE /payment-terms/:id` |

#### Server — lib

| File | Exports |
|---|---|
| `lib/auth.js` | `validatePassword`, `hashPassword`, `comparePassword`, `signToken`, `verifyToken`, `requireAuth`, `requireRole`, `generateResetToken` |
| `lib/money.js` | `add`, `sub`, `mul`, `pct`, `round2`, `gt`, `gte`, `lt`, `lte`, `eq` (all use decimal.js) |
| `lib/errors.js` | `HttpError`, `errorHandler` middleware |
| `lib/pagination.js` | `parsePagination`, `paginatedResponse` |
| `lib/prisma.js` | singleton `PrismaClient` |

#### Prisma

- Full schema with all 14 models + enums (Role, Period, SubscriptionStatus, InvoiceStatus, DiscountType, DiscountScope)
- All §3 indexes + `@@unique([subscriptionId, billedPeriod])` on Invoice
- Migration: `init`
- Seed: admin@brightloop.com / Admin@123!, staff@brightloop.com / Staff@123!, alice@example.com / Portal@123!, bob@example.com / Portal@123!, 3 products (CRM with Odoo+560/Generic+0, Cloud Hosting, Support Plan), 3 plans, 2 taxes, 2 payment terms

#### Client

| Path | What it is |
|---|---|
| `src/api.js` | Fetch wrapper with Bearer token, JSON parse, throws with server error message |
| `src/auth/AuthContext.jsx` | `useAuth()` → `{ user, role, token, login, logout }` |
| `src/auth/ProtectedRoute.jsx` | Role-based guard, redirects to `/login` or `/unauthorized` |
| `src/components/Layout.jsx` | Role-aware sidebar; append nav items for S2/S3 |
| `src/components/Table.jsx` | Server-paginated table with optional search |
| `src/components/FormModal.jsx` | Reusable create/edit modal |
| `src/components/StatusBadge.jsx` | Colour pills — covers all S1–S3 statuses |
| `src/utils/validators.js` | `validatePassword(pw)` → string[] errors (mirrors server regex) |
| `src/utils/format.js` | `formatMoney`, `formatDate`, `formatDateTime`, `formatDueRelative` |
| `src/pages/auth/` | Login, Signup (live pw rule errors), ForgotPassword, ResetPassword |
| `src/pages/admin/` | Users, Customers, Products (+ variant modal), Plans, Taxes |

---

### Contracts Stage 2 must use (do not rename)

#### Auth middleware
```js
const { requireAuth, requireRole } = require('../lib/auth');
// Usage: router.post('/', requireAuth, requireRole('ADMIN'), handler)
```

#### Money helpers (`lib/money.js`)
```js
const { add, sub, mul, pct, round2 } = require('../lib/money');
// All return decimal strings rounded to 2dp — never use + / * on raw prices
```

#### Pagination
```js
const { parsePagination, paginatedResponse } = require('../lib/pagination');
// parsePagination(req.query) → { page, pageSize, skip }
// paginatedResponse(data, total, page, pageSize) → { data, total, page, pageSize }
```

#### Error
```js
const { HttpError } = require('../lib/errors');
throw new HttpError(409, 'Conflict message');
```

#### Prisma
```js
const prisma = require('../lib/prisma'); // singleton — never new PrismaClient()
```

#### app.js — append only
```js
// Append require() lines after: // Stage 2 will append its require() lines below this comment
// Append app.use() lines after: // Stage 2/3 will append their app.use() lines below this comment
```

#### App.jsx — append only
```jsx
// Append import lines after: // S2/S3 imports will be appended below this comment
// Append <Route> elements after: // S2/S3 routes will be appended below this comment
```

#### Layout.jsx — append only
```js
// Append to ADMIN_NAV / INTERNAL_NAV arrays after their respective comments
```

---

### Cut Items (dropped at T-20 min)

| Item | Reason | Notes for Stage 2/3 |
|---|---|---|
| **Edit/delete UI on all admin pages** | Time. | APIs (`PUT /products/:id`, `DELETE /taxes/:id`, etc.) are fully implemented server-side — wire UI if time allows in S2/S3. |
| **PaymentTerms page** (`/admin/payment-terms`) | Time. | Seed has Net 15 + Net 30. API at `/api/payment-terms` is live. File `PaymentTerms.jsx` exists but is unrouted. |
| **Product detail page** | Time. | `GET /api/products/:id` returns full data with variants. |
| **Customer detail / edit** | Time. | `GET /api/customers/:id` returns customer + last 5 subscriptions. |

---

### Test Results

All Stage 1 test-gate checks are in:
- `tests/auth.test.js` — password rules (4 rejections + 1 accept), duplicate email case-insensitive 409, reset token works once then 400
- `tests/roles.test.js` — INTERNAL → 403 on staff create, PORTAL → 403 on products POST, unauthed → 401
- `tests/products.test.js` — Odoo variant price = 1760.00, Generic = 1200.00, duplicate attribute 409, prices as decimal strings

> Run: `npm test` from repo root (uses `DATABASE_URL_TEST`)

---

### Known Issues / Gotchas

- Node.js must be v20+. Install with `winget install OpenJS.NodeJS.LTS` if missing.
- Docker must be running before `npm run setup` (Postgres 16 on port 5432).
- `setup-and-commit.bat` in the repo root handles full setup + git init + all commits.
- `billedPeriod` on Invoice is nullable — Postgres NULLs don't conflict, so cancelling an invoice sets it to `null` and frees the period for re-billing. **Do not add a non-null default.**


---

## Stage 2 — Billing Core (Person B)

---

### Built

#### Server — routes live at `/api/*`

| Route file | Endpoints |
|---|---|
| `templates.routes.js` | `GET/POST /api/templates`, `GET/PUT/DELETE /api/templates/:id` (ADMIN/INTERNAL) |
| `subscriptions.routes.js` | `GET/POST /api/subscriptions`, `GET /api/subscriptions/:id`, `POST /api/subscriptions/:id/transition`, `POST /api/subscriptions/:id/renew` |
| `discounts.routes.js` | `GET /api/discounts` (ADMIN/INTERNAL), `POST/PUT/DELETE /api/discounts` (ADMIN) |
| `invoices.routes.js` | `GET /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/confirm`, `POST /api/invoices/:id/cancel`, `POST /api/invoices/:id/send` |
| `billing.routes.js` | `POST /api/billing/run` { date } (ADMIN/INTERNAL) |

#### Server — lib

| File | Exports |
|---|---|
| `lib/numbering.js` | `generateSubscriptionNumber(tx)`, `generateInvoiceNumber(tx)` — sequential `SUB-XXXX` and `INV-XXXX` inside transactions |
| `lib/states.js` | `transition(entity, toStatus, plan)`, `transitionSubscription`, `transitionInvoice`, `SUBSCRIPTION_TRANSITIONS`, `INVOICE_TRANSITIONS` — throws `HttpError(409)` on invalid moves |
| `lib/pricing.js` | `lineAmount(qty, unitPrice)`, `isDiscountApplicable(discount, subscription, date)`, `calculateDiscountAmount(discount, baseAmount)`, `applyTax(amount, percent)` |
| `lib/billing.js` | `periodEnd(start, period)` (handles daily/weekly/monthly/yearly, month-end clamping, leap years), `generateInvoice(sub, periodStart, tx)`, `runBilling(targetDate)` |

#### Client

| Path | Route | What it is |
|---|---|---|
| `src/pages/sales/Templates.jsx` | `/sales/templates` | Create & list quotation templates with pre-configured products & plans |
| `src/pages/sales/Subscriptions.jsx` | `/sales/subscriptions` | Subscription list with status filters, customer lookup, new sub modal (manual or template prefill) |
| `src/pages/sales/SubscriptionDetail.jsx` | `/sales/subscriptions/:id` | Status stepper & valid action buttons, line items table, associated invoices |
| `src/pages/sales/Discounts.jsx` | `/sales/discounts` | Tiered promo rules (Fixed/Percent, Product/Subscription scope, usage limits) |
| `src/pages/billing/Invoices.jsx` | `/billing/invoices` | Invoices table with status filtering, balance due, links to detail & print |
| `src/pages/billing/InvoiceDetail.jsx` | `/billing/invoices/:id` | Confirm/Cancel actions, Send email log, breakdown of lines and totals |
| `src/pages/billing/InvoicePrint.jsx` | `/billing/invoices/:id/print` | Clean browser print view with `window.print()` trigger |
| `src/pages/billing/RunBilling.jsx` | `/billing/run` | Date picker trigger for `runBilling`, result summary & generated invoice list |

---

### Contracts Stage 3 relies on (do not change)

#### States & Invoices
- `transition(invoice, 'PAID')` — Stage 3 payments route should transition invoice from `CONFIRMED` to `PAID` when `amountPaid = total`.
- `transition(invoice, 'CANCELLED')` — Always ensures `billedPeriod = null`.
- Invoice fields: `total`, `amountPaid`, `dueDate`, `status`. Outstanding is calculated as `total - amountPaid`. Overdue is `status === 'CONFIRMED' && amountPaid < total && dueDate < today`.

#### Billing Engine
- `generateInvoice(sub, periodStart, tx)` — Idempotent invoice generator with discount increment and double-billing protection.
- `runBilling(date)` — Automated billing catch-up loop.

---

### Cut Items

- None cut from Stage 2 core deliverables. Quotation templates UI and renew button are fully implemented.

---

### Test Results

All Stage 1 + Stage 2 test-gate checks are green:
- `tests/auth.test.js` (password rules, duplicate email 409, reset token)
- `tests/roles.test.js` (role guards)
- `tests/products.test.js` (Odoo variant price +560, decimal strings)
- `tests/states.test.js` (invalid transitions -> 409, pause blocked when plan not pausable)
- `tests/billing.test.js` (idempotency, catch-up 3 months, skip paused/closed, leap year period math)
- `tests/discounts.test.js` (usage limit 1 with 2 subscriptions billed, expired discount)
- `tests/totals.test.js` (subtotal, discount, tax, total match hand-calculated values to the cent)

> **Pass count:** 7 test suites passed, 45 tests passed.


---

## Stage 3 — Payments, Portal, Dashboard (Person C)

---

### Built

#### Server — routes live at `/api/*`

| Route file | Endpoints | Roles |
|---|---|---|
| `payments.routes.js` | `GET /api/payments?invoiceId=`, `POST /api/payments` { invoiceId, amount, method, date, note } | ADMIN/INTERNAL |
| `portal.routes.js` | `GET /api/portal/subscriptions`, `/subscriptions/:id`, `/invoices`, `/invoices/:id`, `/payments` | PORTAL |
| `reports.routes.js` | `GET /api/reports/dashboard?from=&to=&planId=&status=`, `GET /api/reports/overdue` | ADMIN/INTERNAL |

#### Server — lib

| File | Exports |
|---|---|
| `lib/reports.js` | `dashboard(filters, today)`, `startOfDay`, `outstandingWhere`, `overdueWhere`, `daysOverdue` — aggregate/groupBy/count only |

#### Rules as implemented
- **Payments**: amount > 0, ≤ 2 decimals, ≤ outstanding (400); invoice must be CONFIRMED (409 for DRAFT/PAID/CANCELLED). Runs in a transaction with `SELECT … FOR UPDATE` on the invoice row. When `amountPaid = total`, status goes to PAID via `transition(invoice, 'PAID')`.
- **Outstanding** = CONFIRMED invoices (partial payments keep CONFIRMED). **Overdue** = outstanding and `dueDate < start of today (UTC)` — due today is not overdue.
- **Portal**: every query filtered by `req.user.customerId` from the JWT; another customer's ID → 404. DRAFT invoices hidden from customers.
- **Dashboard**: `from`/`to` filter payment date (revenue) and invoice date (invoice summary); `planId` filters everything; `status` = invoice status for the summary table. MRR = active subscription line amounts (pre-tax, pre-discount) normalised to a month (weekly ×52/12, yearly ÷12, daily ×365/12).

#### Client

| Path | Route | What it is |
|---|---|---|
| `components/KpiCard.jsx` | — | Dashboard stat tile |
| `pages/finance/Dashboard.jsx` | `/finance/dashboard` | KPI cards + filters + invoices/subscriptions by status |
| `pages/finance/Overdue.jsx` | `/finance/overdue` | Overdue invoices with days overdue |
| `pages/finance/Payments.jsx` | `/finance/payments` | All payments; also exports `PaymentsPanel` used on invoice detail |
| `pages/portal/MySubscriptions.jsx` | `/portal/subscriptions` | Customer's subscriptions (login lands here) |
| `pages/portal/MyInvoices.jsx` | `/portal/invoices` | Customer's invoices + link to print view |
| `pages/portal/MyPayments.jsx` | `/portal/payments` | Customer's payments |

### Changes to earlier-stage files (all small, recorded here per §2.1)
- `client/src/api.js` — **bug fix**: Stage 2 pages call `api.get('/api/…')` while `api.js` already prefixes `/api`, so every Stage 2 page requested `/api/api/…` and failed. `apiFetch` now accepts both forms.
- `client/src/pages/billing/InvoicePrint.jsx` — PORTAL users load via `/api/portal/invoices/:id` (the staff endpoint is ADMIN/INTERNAL only, so the portal print view always failed).
- `client/src/pages/billing/InvoiceDetail.jsx` — renders `<PaymentsPanel>` (record payment + history).
- `package.json` / `server/package.json` — `npm run setup` now copies root `.env` → `server/.env` (Prisma CLI and `server/src/index.js` read from `server/`, so with only the root `.env` neither found `DATABASE_URL` on macOS/Linux) and migrates the test DB (`db:migrate:test`, creates `brightloop_test` if missing). `npm run dev` re-syncs `.env`.
- `server/src/tests/helpers.js` — added `createSubscription`, `createInvoice` fixtures.
- `server/prisma/seed.js` — appended `SEED_SIZE=large` block (`seedLarge()`).
- `app.js`, `App.jsx`, `Layout.jsx` — append-only mount/route/nav lines.

### Known issue — NOT fixed (Stage 2 code)
- **Subscription-scope discounts are applied after tax.** In `lib/billing.js` `generateInvoice`, line tax is computed on the line net *before* the subscription-level discount, which is then subtracted from the total. Breaks the "qty × unitPrice → discount → tax" rule. Seen in the demo: INV-0001 = 8800 − 880 + 1584 (18% of 8800) = 9504.00; should be 8800 − 880 + 1425.60 (18% of 7920) = 9345.60. Product-scope discounts are correct (`totals.test.js` only covers that case).

### Cut items
- Charts on the dashboard (cut-first) — KPI cards + summary tables only.
- Everything else in the Stage 3 list was built.

### Test results
- `npm test`: **10 suites, 60 tests passed** (45 from Stages 1–2 + 15 new), perf suite skipped by default.
- New: `payments.test.js` (overpayment, partial → full → PAID, DRAFT/CANCELLED rejected, ≤ 0 rejected, PORTAL 403), `portal.test.js` (cross-customer invoice/subscription → 404, lists ignore query customerId, DRAFT hidden, staff 403), `reports.test.js` (due today not overdue / yesterday is, KPIs = hand-calculated fixture, plan/date/status filters, PORTAL 403).
- `PERF=1 npm test -- perf` on `SEED_SIZE=large` (5,000 subs / 10,000 invoices): 7/7 under 2 s — slowest 61 ms (`/api/subscriptions?pageSize=100`), dashboard 24 ms.
- Manual: billing run → confirm → partial + full payment → PAID; dashboard KPIs updated; Alice's portal shows only her data; Bob's invoice print → not found.
