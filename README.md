# ⚡ Brightloop — Modern Subscription & Billing Management System

**Brightloop** is an end-to-end B2B subscription management and recurring billing platform built for speed, accuracy, and enterprise reliability. Designed to handle the full subscription lifecycle—from quotation and product variant configuration to automated invoice generation, payment reconciliation, and real-time financial reporting.

---

## 🌟 What Makes Brightloop Unique?

Unlike basic CRUD subscription apps, Brightloop implements strict enterprise financial rules, automated billing engines, and full customer self-service:

### 1. 🔄 Smart Recurring Billing Engine (With Zero Double-Billing)
* **Catch-Up & Idempotent Billing:** Automatically detects missed billing cycles (e.g. if a system was offline) and generates catch-up invoices without ever generating duplicate charges, backed by database-level unique constraints (`subscriptionId + billedPeriod`).
* **Calendar-Aware Periods:** Accurately calculates daily, weekly, monthly, and yearly cycles, seamlessly handling leap years and month-end dates (e.g., Jan 31st rolling into Feb 28th/29th).
* **Configurable Plan Policies:** Plans control whether subscriptions can be paused, closed early, auto-terminated on expiry, or renewed.

### 2. 📦 Product Catalog with Dynamic Variants
* Supports base products with dynamic attribute values and price modifiers (e.g., Brand: *Odoo* dynamically adds `+$560` to base pricing).
* Enforces plan-specific minimum order quantities and per-line tax calculations.

### 3. 🎯 Rule-Based Discounts & Quotations
* **Multi-Scope Discounts:** Apply percentage or fixed-amount discounts at either the product or whole-subscription level.
* **Usage & Eligibility Safeguards:** Restricts discounts based on date validity windows, minimum purchase amounts, minimum order quantities, and maximum lifetime usage counts.
* **Quotation Templates:** Pre-fill subscriptions and calculate quotation expiration dates for rapid sales turnaround.

### 4. 💳 Bulletproof Financials & Invoicing
* **Precision Decimal Math:** Uses exact decimal math for all monetary transactions—guaranteeing zero floating-point rounding discrepancies.
* **Partial & Full Payments:** Tracks outstanding balances in real time, automatically transitioning invoices to `PAID` once fully settled.
* **Overdue Tracking:** Flags overdue accounts based on custom payment terms and due dates.
* **Print-Ready Invoices:** Built-in clean, print-friendly browser invoice views.

### 5. 👥 Role-Based Access & Self-Service Customer Portal
* **Three Dedicated Roles:**
  * **Admin:** Full system control, staff management, tax & discount authoring.
  * **Internal Team:** Subscription management, manual billing runs, and payment logging.
  * **Portal (Customers):** A self-service portal where customers can securely view only their own subscriptions, invoices, and payment receipts.
* **Strict Tenant Isolation:** Data queries are strictly scoped to the authenticated customer ID.

### 6. 📊 Real-Time Financial Dashboard
* Instant overview of key SaaS metrics: **Active Subscriptions**, **Collected Revenue**, **Monthly Recurring Revenue (MRR)**, and **Overdue Amounts**.
* Optimized database aggregations designed to render queries across thousands of records in under 2 seconds.

---

## 🛠️ Tech Stack
* **Frontend:** React, Vite, React Router, Tailwind CSS
* **Backend:** Node.js, Express
* **Database & ORM:** PostgreSQL, Prisma ORM
* **Security & Precision:** JWT Auth, Bcrypt, Decimal.js

---

## 🚀 Quick Start

Pick your OS: **[Windows](#setup--windows)** or **[macOS / Linux](#setup--macos--linux-docker)**. Both end with the app at http://localhost:5173.

---

## 👥 Demo Logins

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@123!` |
| **Internal / Staff** | `staff@brightloop.com` | `Staff@123!` |
| **Portal / Customer** | `alice@example.com` | `Portal@123!` |
| **Portal / Customer** | `bob@example.com` | `Portal@123!` |

---

## Setup — Windows

You need **Node.js 20+** and **Git**, plus a PostgreSQL server. Choose one:

- **Option A — local PostgreSQL (no Docker).** Install [PostgreSQL 18](https://www.postgresql.org/download/windows/) to the default folder `C:\Program Files\PostgreSQL\18`. The `.bat` scripts run their own database on **port 5433** in the repo's `.pgdata` folder, so they don't clash with any Postgres you already have.
- **Option B — Docker Desktop.** Same as macOS: Postgres in a container on **port 5432**.

Run all commands in **PowerShell** from the repo folder.

### Option A — local PostgreSQL (first time)

```powershell
# 1. Create .env and point it at port 5433
Copy-Item .env.example .env
notepad .env
```

In `.env`, change `5432` to `5433` on both database lines:

```ini
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/brightloop
DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:5433/brightloop_test
```

```powershell
# 2. Start the database (creates .pgdata, brightloop and brightloop_test on first run)
.\start-db.bat

# 3. Install, migrate dev + test databases, seed demo data
npm run setup

# 4. Check everything works (expect 68 passed)
npm test
```

### Option A — every day

```powershell
.\start-dev.bat     # starts the database, then the server and the client in two new windows
```

Or step by step: `.\start-db.bat`, then `npm run dev`. When you're done: `.\stop-db.bat`.

`.\setup-db.bat` re-runs migrations and the seed on the dev database only (use `npm run setup` when you also need the test database).

### Option B — Docker Desktop

```powershell
docker compose up -d   # Postgres 16 on :5432 — .env.example already matches
npm run setup
npm test               # expect 68 passed
npm run dev
```

### Windows notes

- **Two `.env` files must match.** `npm run setup` copies the root `.env` to `server/.env` the first time (it never overwrites it afterwards). The tests and seed read the root file; Prisma and the server read `server/.env`. If you change one, change the other (or delete `server/.env` and run `npm run setup` again).
- **Ports.** The server uses `PORT` from `.env` (4001 if unset); the client proxy reads the same value automatically.
- **Different PostgreSQL version or folder?** Edit the `C:\Program Files\PostgreSQL\18\bin` path in `start-db.bat` and `stop-db.bat`.
- **`npm run setup` can't connect.** Make sure `.\start-db.bat` printed *Database is up and running on port 5433* (Option A) or `docker compose ps` shows the db as healthy (Option B), and that `.env` uses the matching port.
- **Mac/Linux-only syntax.** `VAR=value command` doesn't work in PowerShell; see the Windows commands under *Performance check* below.

---

## Setup — macOS / Linux (Docker)

```bash
docker compose up -d   # Postgres 16 on :5432
npm run setup          # copies .env.example → .env (if missing), installs, migrates dev + test DBs, seeds
npm run dev            # client http://localhost:5173 · server on PORT from .env (4001 if unset)
npm test               # server tests against brightloop_test
```

`.env` lives in the repo root. `npm run setup` / `npm run dev` copy it to `server/.env` **only if that file doesn't exist yet** (Prisma and the server read from `server/`). If you change the root `.env` later, update or delete `server/.env` too. The Vite proxy reads `PORT` from the same files, so client and server always agree.

## Demo script (~5 min)

1. **Sign up** a new customer at `/signup` — try `password` first to show the rule error.
2. **Admin**: create a product with Brand = Odoo (+560), a monthly plan, and a 10% discount with min qty 5.
3. **Internal**: Subscriptions → New → pick the *Enterprise CRM Package* template (pre-fills plan + lines: CRM Odoo ×5, Cloud Hosting) → choose a tax per line, optional expiry + payment terms → Save → Send Quote → Confirm → Activate.
4. **Run Billing** for today → the invoice shows discount + tax. Run again → *0 generated*, no duplicate.
5. Open the invoice → **Confirm** → **Record payment** for part of it (stays CONFIRMED), then the rest → **PAID**.
6. Sign in as **alice@example.com** → My Subscriptions (pause / resume / renew / close where the plan allows) / My Invoices (*View / print*) / My Payments.
7. **Dashboard** (`/finance/dashboard`): KPIs and the invoice summary change with the plan / date / status filters; **Overdue** lists past-due invoices with days overdue.

## Performance check (5,000 subscriptions)

macOS / Linux:

```bash
SEED_SIZE=large npm run seed     # +500 customers, 5,000 subscriptions, 10,000 invoices, ~5,750 payments
PERF=1 npm test -- perf          # subscriptions list, invoices list, dashboard, overdue — each must be < 2s
```

Windows (PowerShell):

```powershell
$env:SEED_SIZE="large"; npm run seed; Remove-Item Env:SEED_SIZE
$env:PERF="1"; npm test -- perf; Remove-Item Env:PERF
```

Measured on an M-series Mac: every endpoint 5–60 ms.
To go back to the small demo seed, run `npx -w server prisma migrate reset --force` from the repo folder (same command on Windows and macOS).

## Scripts

| Command          | Description                                         |
|------------------|-----------------------------------------------------|
| `npm run setup`  | Sync .env, install, migrate dev + test DB, seed     |
| `npm run dev`    | Start client & server                               |
| `npm test`       | Run server tests (perf suite skipped unless PERF=1) |
| `npm run seed`   | Re-seed (`SEED_SIZE=large` for the 5k data set)     |
