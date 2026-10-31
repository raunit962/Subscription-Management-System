# Brightloop Subscription Management System

Subscriptions, recurring billing, payments, a customer portal and a finance dashboard.
React (Vite) · Express · Prisma · PostgreSQL.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose

## Setup

```bash
docker compose up -d   # Postgres 16 on :5432
npm run setup          # copies .env.example → .env (if missing), installs, migrates dev + test DBs, seeds
npm run dev            # client http://localhost:5173 · server http://localhost:4000
npm test               # server tests against brightloop_test
```

`.env` lives in the repo root. `npm run setup` / `npm run dev` copy it to `server/.env` so Prisma and the server pick it up — edit the root file, not the copy.

## Demo logins

| Role     | Email                  | Password    |
|----------|------------------------|-------------|
| Admin    | admin@brightloop.com   | Admin@123!  |
| Internal | staff@brightloop.com   | Staff@123!  |
| Portal   | alice@example.com      | Portal@123! |
| Portal   | bob@example.com        | Portal@123! |

## Demo script (~5 min)

1. **Sign up** a new customer at `/signup` — try `password` first to show the rule error.
2. **Admin**: create a product with Brand = Odoo (+560), a monthly plan, and a 10% discount with min qty 5.
3. **Internal**: Subscriptions → New → use the *Enterprise CRM Package* template, qty 5 → move it through to Active.
4. **Run Billing** for today → the invoice shows discount + tax. Run again → *0 generated*, no duplicate.
5. Open the invoice → **Confirm** → **Record payment** for part of it (stays CONFIRMED), then the rest → **PAID**.
6. Sign in as **alice@example.com** → My Subscriptions / My Invoices / My Payments; *View / print* opens the print view.
7. **Dashboard** (`/finance/dashboard`): KPIs and the invoice summary change with the plan / date / status filters; **Overdue** lists past-due invoices with days overdue.

## Performance check (5,000 subscriptions)

```bash
SEED_SIZE=large npm run seed     # +500 customers, 5,000 subscriptions, 10,000 invoices, ~5,750 payments
PERF=1 npm test -- perf          # subscriptions list, invoices list, dashboard, overdue — each must be < 2s
```

Measured on an M-series Mac: every endpoint 5–60 ms.
Re-run `npx -w server prisma migrate reset --force` to go back to the small demo seed.

## Scripts

| Command          | Description                                         |
|------------------|-----------------------------------------------------|
| `npm run setup`  | Sync .env, install, migrate dev + test DB, seed     |
| `npm run dev`    | Start client & server                               |
| `npm test`       | Run server tests (perf suite skipped unless PERF=1) |
| `npm run seed`   | Re-seed (`SEED_SIZE=large` for the 5k data set)     |
