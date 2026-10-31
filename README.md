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

## 🚀 Quick Start (Local Development)

### 1. Start the Database & Dev Servers (Windows 1-Click)
Double-click `start-dev.bat` or run in terminal:
```cmd
.\start-dev.bat
```
*(This automatically starts PostgreSQL on port 5433, starts the backend on port 4001, and launches Vite on port 5173).*

### 2. Manual Setup
```bash
# Start local postgres or Docker
.\start-db.bat

# Install dependencies, run Prisma migrations, and seed demo data
npm run setup

# Run dev servers
npm run dev
```

---

## 👥 Demo Logins

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@brightloop.com` | `Admin@123!` |
| **Internal / Staff** | `staff@brightloop.com` | `Staff@123!` |
| **Portal / Customer** | `alice@example.com` | `Portal@123!` |

---

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
