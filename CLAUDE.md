# claude.md — Brightloop Subscription Management (4-hour build)

Read this **and `plan.md`** before writing code. `plan.md` = what to build and when. This file = how to build it. **We have 4 hours total — speed over elegance, correctness over features.**

## Current stage
<!-- Stage owner updates this when starting -->
**Active stage:** Stage 3 — Payments, Portal, Dashboard · Owner: Person C · Branch: stage-3 · Window: 2:35–3:45

Build **only** the active stage's items from `plan.md`. Anything else → note in `docs/HANDOFF.md`, don't build.

## Stack (fixed — no new libraries without a strong reason)
- **Client:** React + Vite (JavaScript), React Router, Tailwind, a small `api.js` fetch wrapper
- **Server:** Node 20 + Express (JavaScript, CommonJS or ESM — Stage 1 decides, others follow), Prisma, PostgreSQL, bcrypt, jsonwebtoken, decimal.js
- **Tests:** Jest + Supertest on the server only. No frontend unit tests, no Playwright.
- No BaaS, no real email, no PDF library, no cron.

## Commands
```bash
docker compose up -d          # Postgres
npm run setup                 # install + prisma migrate + seed
npm run dev                   # client :5173, server :4000
npm test                      # server tests (uses DATABASE_URL_TEST)
SEED_SIZE=large npm run seed  # 5k subscriptions for perf check (Stage 3)
```

## Layout
The full folder tree, with which stage owns each file, is in **`plan.md` §2.1 — follow it exactly.** Short version:
```
server/src/routes/<module>.routes.js   # handlers, flat
server/src/lib/                        # shared logic (auth, money, pricing, billing, states, reports)
server/src/tests/<module>.test.js      # matches route file name
server/prisma/schema.prisma, seed.js
client/src/pages/{auth,admin,sales,billing,finance,portal}/
client/src/components/                 # shared UI only
```
Never create new top-level folders or move/rename files from an earlier stage. `app.js`, `App.jsx`, `Layout.jsx` and `seed.js` are append-only for later stages.

## Rules that must not be broken (these are what judges test)

**Money**
- Prisma `Decimal` + helpers in `lib/money.js`. Never `+`/`*` on JS numbers for prices.
- Line order: `qty × unitPrice` → discount → tax. Round 2 decimals at line and total.

**Auth & roles**
- Password rule: length > 8, ≥1 uppercase, ≥1 lowercase, ≥1 special. Use the one validator in `lib/auth.js` (client copies the same regex).
- Emails lowercased before save and lookup.
- `requireRole('ADMIN')` etc. on every route. Only ADMIN creates staff, discounts, taxes.
- Portal routes filter by `req.user.customerId` — never by an ID from the URL/body.
- Reset link is printed to the server console (that's our "email").

**Billing**
- Status changes only via `lib/states.js` (`transition(sub, toStatus)`); invalid → 409.
- Invoices only via `lib/billing.js` `generateInvoice()`, inside `prisma.$transaction`.
- Never remove the unique constraint on `(subscriptionId, billedPeriod)`. Catch Prisma `P2002` in `runBilling` and skip — that is the double-billing guard.
- On invoice cancel, set `billedPeriod = null` so the period can be re-billed.
- Discount usage incremented in the same transaction as the invoice.
- `PAID` is only set by the payments route when `amountPaid = total`.

**API**
- Routes under `/api`. Errors: `res.status(code).json({ error: "message" })` — 400 validation, 401, 403, 404, 409 conflict/invalid state.
- Lists: `page`, `pageSize` (default 20, max 100) → `{ data, total, page, pageSize }`.
- Reports use `aggregate` / `groupBy` / `count` — never load all rows and loop in JS.
- Add an index for any column you filter or sort on.

**Frontend**
- Reuse Stage 1's `Table`, `FormModal`, `StatusBadge`, `Layout`. Don't build new versions.
- Hide buttons the role/status doesn't allow (server still enforces).
- Basic loading and error text is enough. No design polish until the stage's features and tests are done.

## Tests (keep them few and sharp)
- Write tests only for the business rules listed in your stage's test gate in `plan.md`. Name the test after the rule.
- Always run the previous stages' tests before pushing. **Don't push red.**
- Test DB is reset at the start of each test file.

## Time discipline
- At **T-20 min** in your stage: stop features, drop *(cut-first)* items, test.
- Commit + push your branch every ~20 min.
- Stuck >10 min on one thing → simplest workaround, write it in HANDOFF, move on.

## Handoff & Git
- Before PR: tests green, `docs/HANDOFF.md` updated (built / contracts / cut items / test count), update "Current stage" above for the next owner.
- Next owner merges after `npm run setup && npm test` passes on their machine, then tags.
- Don't change function names or routes listed in HANDOFF by a previous stage.
- Never commit `.env`.
