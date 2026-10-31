# Claude Prompts — Brightloop 4-Hour Build

Copy-paste prompts for each stage owner. Use them **in order**, one at a time, in Claude Code opened at the repo root. Wait for each prompt to finish and check the result before sending the next.

## Before anyone starts
1. Rename `claude.md` → **`CLAUDE.md`** (capital letters). Claude Code auto-loads `CLAUDE.md` on every prompt; on Linux/macOS a lowercase name is not picked up.
2. `plan.md`, `CLAUDE.md` and this file sit in the repo root.
3. Each person: Node 20, Docker running, Git configured with push access to the repo.

## Rules for everyone
- One prompt at a time. Don't paste the whole stage at once.
- After each prompt, glance at the diff. If Claude touched a file outside your stage's list in `plan.md` §2.1, say: *"Revert changes to <file>, it belongs to an earlier stage."*
- If something fails twice, paste the error and say: *"Fix with the simplest change. Don't refactor."*
- At **T-20 min** use your stage's **Cut prompt**, then go straight to the **Test prompt**.

---

## Person A — Stage 1: Foundation (0:00 – 1:15)

### A0 · Kickoff
```
Read plan.md and CLAUDE.md fully. You are building Stage 1 (Foundation) only, as Person A.
Summarise in 5 bullet points what Stage 1 must deliver and list the files from plan.md §2.1 tagged [S1].
Don't write code yet.
```

### A1 · Skeleton (target 10 min)
```
Create the repo skeleton exactly as plan.md §2.1, Stage 1 parts:
- root package.json with npm workspaces (client, server) and scripts: setup, dev, test, seed
- docker-compose.yml with postgres:16 exposing a dev DB and a test DB
- .gitignore, .env.example (DATABASE_URL, DATABASE_URL_TEST, JWT_SECRET, PORT=4000, CLIENT_URL)
- server: Express in JavaScript (CommonJS), src/index.js, src/app.js, lib/prisma.js, lib/errors.js, lib/pagination.js, jest config
- client: Vite + React (JavaScript), React Router, Tailwind, vite proxy /api → :4000
- create every folder in §2.1 with a .gitkeep if empty, and docs/HANDOFF.md with headings only
`npm run setup` must install, migrate and seed. `npm run dev` must start both apps.
Then commit: "chore: project skeleton".
```

### A2 · Database schema (target 10 min)
```
Write server/prisma/schema.prisma with ALL models from plan.md §3 (including Stage 2 and 3 models), all enums, Decimal(12,2) for money, the indexes listed in §3, and the invoice unique constraint on (subscriptionId, billedPeriod) with billedPeriod nullable.
Create the migration. Then write seed.js with: 1 admin, 1 internal, 2 portal users each linked to a Customer, 3 products (one with attribute Brand: Odoo +560 and Generic +0), 3 plans (weekly, monthly, yearly with different flag combinations), 2 taxes, 2 payment terms. Print the demo logins at the end of seeding.
Run migrate + seed to confirm it works. Commit: "feat(db): schema and seed".
```

### A3 · Auth & roles (target 15 min)
```
Build auth per CLAUDE.md rules:
- lib/auth.js: validatePassword (length > 8, ≥1 upper, ≥1 lower, ≥1 special), hash/compare with bcrypt, signToken, requireAuth, requireRole(...roles)
- routes/auth.routes.js: POST signup (creates PORTAL user + Customer, email lowercased, 409 on duplicate), POST login, GET me, POST forgot (creates single-use token valid 30 min and console.logs the reset link), POST reset
- routes/users.routes.js: ADMIN-only create INTERNAL user, list users (paginated)
- routes/customers.routes.js: ADMIN/INTERNAL list + create
Mount routes in app.js. Commit: "feat(auth): auth, roles, users".
```

### A4 · Master data APIs (target 10 min)
```
Build CRUD routes (list paginated, get, create, update; delete optional) for products (with nested attribute values and a computed variant price = salesPrice + extraPrice), plans, taxes, payment terms.
Writes are ADMIN only; INTERNAL may read; PORTAL gets 403. Use lib/money.js (decimal.js) for price math — create it now with add, mul, pct, round2.
Commit: "feat: products, variants, plans, taxes, payment terms".
```

### A5 · Frontend shell (target 15 min)
```
Build the client for Stage 1:
- api.js fetch wrapper (adds Bearer token, parses JSON, throws on error with server message)
- auth/AuthContext.jsx, auth/ProtectedRoute.jsx (role-based)
- components/Layout.jsx (role-aware sidebar), Table.jsx (server pagination + simple filter input), FormModal.jsx, StatusBadge.jsx
- utils/validators.js (same password rule as server), utils/format.js (money, date)
- pages/auth: Login, Signup (live password rule errors), ForgotPassword, ResetPassword
- pages/admin: Users, Products (with variants), Plans, Taxes, PaymentTerms — list + create
Keep styling simple and clean with Tailwind. Commit: "feat(ui): app shell and admin pages".
```

### A-Cut · (use at 0:55 if behind)
```
We're out of time for Stage 1. Drop edit/delete UI and the PaymentTerms page (seed data is enough). Make sure everything that exists works. List what you dropped so I can put it in HANDOFF.md.
```

### A-Test · Test gate (0:58 – 1:08)
```
Write Jest + Supertest tests in server/src/tests (helpers.js resets the test DB per file) for exactly these rules, naming each test after the rule:
- password rule: rejects 8 chars, no uppercase, no lowercase, no special; accepts valid
- signup: duplicate email with different case → 409
- reset: token works once, then fails; expired token fails
- roles: INTERNAL creating staff → 403; PORTAL POST /api/products → 403
- variant price: Brand Odoo adds 560
Run npm test and fix any failures in the code, not by weakening tests. Show me the final pass count.
```
Then manually: `npm run setup && npm run dev`, log in as admin, internal, portal.

### A-Push · Handoff (1:08 – 1:15)
```
Update docs/HANDOFF.md under "Stage 1": what was built (routes + pages), contracts Stage 2 must not change (lib function names, route paths, shared components), what was cut, test pass count, demo logins.
Update the "Current stage" line in CLAUDE.md to: Stage 2 — Billing Core · Owner: <Person B> · Branch: stage-2 · Window: 1:15–2:35.
Commit "docs: stage 1 handoff", push branch stage-1, and give me the command to open a PR to main.
```
→ Person B pulls, runs `npm run setup && npm test`, merges, tags `v0.1`.

---

## Person B — Stage 2: Billing Core (1:15 – 2:35)

### B0 · Kickoff & check
```
Read plan.md, CLAUDE.md and docs/HANDOFF.md. You are Person B building Stage 2 (Billing Core) only.
Run npm run setup and npm test and confirm Stage 1 is green.
Then list the [S2] files from plan.md §2.1 and the Stage 1 contracts you must reuse. Don't write code yet.
```
Create branch: `git checkout -b stage-2`.

### B1 · Numbering & state machine (target 10 min)
```
Create lib/numbering.js (SUB-0001, INV-0001 generated inside a transaction) and lib/states.js:
- subscription: DRAFT→QUOTATION→CONFIRMED→ACTIVE→CLOSED; ACTIVE↔PAUSED only if plan.pausable; early ACTIVE→CLOSED only if plan.closable; renew (extend expiry by one period) only if plan.renewable
- invoice: DRAFT→CONFIRMED→PAID, DRAFT/CONFIRMED→CANCELLED (cancel sets billedPeriod = null)
- export transition(entity, toStatus, plan) that throws HttpError 409 on invalid moves
Commit: "feat(billing): numbering and state machines".
```

### B2 · Subscriptions & templates (target 20 min)
```
Build routes/subscriptions.routes.js and routes/templates.routes.js:
- subscription create (manual or ?templateId= to prefill plan + lines), lines with qty ≥ plan.minQty, unit price = product price + variant extra, optional tax per line, amount computed via lib/pricing.js
- list (paginated, filter by status, customer, plan), detail, POST /:id/transition {to}, renew
- set nextInvoiceDate = startDate on activation
- quotation templates: create/list (plan, lines, validityDays); show quote expiry date = created + validityDays
- ADMIN/INTERNAL only
Client: pages/sales Subscriptions, SubscriptionDetail (lines, status stepper, only valid action buttons), Templates. Add sidebar items and routes (append only).
Commit: "feat: subscriptions and quotation templates".
```

### B3 · Discounts & pricing (target 10 min)
```
Build lib/pricing.js fully: lineAmount, isDiscountApplicable(discount, subscription, date) — checks date window, usageCount < usageLimit, minQty, minPurchase, scope PRODUCT/SUBSCRIPTION — and applyTax. Order: qty × unitPrice → discount → tax, rounding per CLAUDE.md.
routes/discounts.routes.js: ADMIN-only create/list. Client: pages/sales/Discounts.
Commit: "feat: discounts".
```

### B4 · Billing engine (target 20 min) — most important
```
Build lib/billing.js:
- periodEnd(start, period) handling DAILY/WEEKLY/MONTHLY/YEARLY, month-end (31 Jan → 28/29 Feb) and leap years
- generateInvoice(sub, periodStart) inside prisma.$transaction: invoice + lines from subscription, applicable discounts (increment usageCount in same transaction), taxes, totals, dueDate = invoiceDate + paymentTerm.dueDays, billedPeriod = periodStart, then advance sub.nextInvoiceDate
- runBilling(date): for each ACTIVE subscription loop while nextInvoiceDate ≤ date (catch up missed periods); catch Prisma P2002 and skip (double-billing guard); plans with autoClose past expiry → CLOSED, not billed; skip PAUSED/CLOSED
- routes/billing.routes.js: POST /api/billing/run {date} for ADMIN/INTERNAL, returns created/skipped counts
Commit: "feat: billing run".
```

### B5 · Invoices UI (target 10 min)
```
routes/invoices.routes.js: list (paginated, filter status/customer), detail, confirm, cancel, send (console.log "email sent to <customer>"). Use lib/states.js for every status change.
Client: pages/billing Invoices, InvoiceDetail (action buttons per status), InvoicePrint (print-friendly layout + window.print()), RunBilling (date picker + result counts).
Extend seed.js (append a new block) with 1 template, 3 active subscriptions and 1 discount.
Commit: "feat: invoices UI".
```

### B-Cut · (use at 2:15 if behind)
```
We're out of time for Stage 2. Drop the templates UI (keep the API and seeded template) and the renew button. Make sure subscriptions, billing run and invoices fully work. List what was dropped for HANDOFF.md.
```

### B-Test · Test gate (2:15 – 2:27)
```
Write tests for exactly these rules, named after the rule:
- states: every invalid subscription transition → 409; pause blocked when plan not pausable
- billing: running twice for the same date creates no duplicate invoices
- billing: subscription 3 months behind → exactly 3 invoices
- billing: paused and closed subscriptions are not billed
- discount: usage limit 1 with 2 subscriptions billed → applied once; expired discount not applied
- totals: fixture invoice subtotal, discount, tax, total match hand-calculated values to the cent
- periods: 31 Jan monthly → next 28 Feb (29 in leap year)
Run ALL tests (Stage 1 included). Fix code, not tests. Show the final pass count.
```
Then manually: create subscription from template → activate → Run billing → check invoice → run again (no duplicate) → print view.

### B-Push · Handoff (2:27 – 2:35)
```
Append "Stage 2" to docs/HANDOFF.md: built, contracts Stage 3 relies on (generateInvoice, runBilling, states.transition, invoice fields amountPaid/total/dueDate, route paths), cut items, test pass count.
Update "Current stage" in CLAUDE.md to: Stage 3 — Payments, Portal, Dashboard · Owner: <Person C> · Branch: stage-3 · Window: 2:35–3:45.
Commit "docs: stage 2 handoff", push branch stage-2, give me the PR command.
```
→ Person C pulls, runs `npm run setup && npm test`, merges, tags `v0.2`.

---

## Person C — Stage 3: Payments, Portal, Dashboard (2:35 – 3:45)

### C0 · Kickoff & check
```
Read plan.md, CLAUDE.md and docs/HANDOFF.md. You are Person C building Stage 3 only.
Run npm run setup and npm test and confirm Stages 1–2 are green.
List the [S3] files from plan.md §2.1 and the Stage 1–2 contracts you must reuse. Don't write code yet.
```
Create branch: `git checkout -b stage-3`.

### C1 · Payments & overdue (target 20 min)
```
Build routes/payments.routes.js (ADMIN/INTERNAL):
- POST payment {invoiceId, method, amount, date, note}: reject amount ≤ 0, amount > outstanding (total - amountPaid), and invoices in DRAFT or CANCELLED; update amountPaid in a transaction; when amountPaid = total, move invoice to PAID via lib/states.js
- GET list (paginated, filter by method/date range/customer)
Add to invoices: computed outstanding and overdue (CONFIRMED, balance > 0, dueDate < today; due today is NOT overdue) and an overdue list endpoint with days overdue.
Client: payment form on InvoiceDetail, pages/finance Payments and Overdue.
Commit: "feat: payments and overdue".
```

### C2 · Customer portal (target 10 min)
```
Build routes/portal.routes.js for PORTAL role only: my subscriptions, my invoices (incl. print view data), my payments. Every query filters by req.user.customerId — never by an id from params or body; fetching another customer's record returns 404.
Client: pages/portal MySubscriptions, MyInvoices (with print), MyPayments; portal users land on MySubscriptions after login.
Commit: "feat: customer portal".
```

### C3 · Finance dashboard (target 15 min)
```
Build lib/reports.js and routes/reports.routes.js using only Prisma aggregate/groupBy/count (no loading all rows):
KPIs: active subscriptions, revenue collected in date range, outstanding amount, overdue count and amount, MRR (yearly/12, weekly×52/12, daily×365/12).
Filters: date range, plan, subscription status. Plus a summary table of invoices by status with totals.
Client: components/KpiCard.jsx, pages/finance/Dashboard with filters, KPI cards and summary table. Simple bar chart only if quick.
Commit: "feat: finance dashboard".
```

### C4 · Performance & README (target 10 min)
```
Add a SEED_SIZE=large block to seed.js (append only) that uses createMany to insert 5,000 subscriptions with lines, ~20,000 invoices and ~10,000 payments across the seeded customers and plans.
Run it, then time GET subscriptions list, invoices list, overdue list and dashboard. Each must respond in < 2s; if not, add the missing index or reduce the query, and show me the timings.
Write README.md: setup in 3 commands, demo logins, and the demo script from plan.md §7.
Commit: "perf: large seed, timing checks, README".
```

### C-Cut · (use at 3:25 if behind)
```
We're out of time for Stage 3. Drop the chart and the standalone Payments list page (payments stay visible on invoice detail). Make sure payments, overdue, portal and dashboard KPIs work. List what was dropped for HANDOFF.md.
```

### C-Test · Test gate (3:25 – 3:37)
```
Write tests for exactly these rules, named after the rule:
- payments: overpayment rejected; partial then full payment → PAID; payment on DRAFT invoice rejected
- overdue: due today is not overdue; due yesterday is
- portal: customer A requesting customer B's subscription, invoice or payment → 404
- dashboard: KPIs on a fixed fixture equal hand-calculated values
- perf (only when PERF=1): list and dashboard endpoints < 2s on the large seed
Run ALL tests (Stages 1–3). Fix code, not tests. Show the final pass count.
```
Then run the full demo script in plan.md §7 by hand.

### C-Push · Final handoff (3:37 – 3:45)
```
Append "Stage 3" to docs/HANDOFF.md (built, cut items, test pass count, perf timings). Set "Current stage" in CLAUDE.md to: Complete — v1.0.
Commit "docs: stage 3 handoff", push branch stage-3, give me the PR command.
```
→ Person A pulls, runs `npm run setup && npm test`, merges, tags `v1.0`. Final 15 min: whole team runs the demo once more.
