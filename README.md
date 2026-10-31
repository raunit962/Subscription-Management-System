# Subscription-Management-System
# ⚡ Brightloop — Modern Subscription & Billing Management System

**Brightloop** is an end-to-end B2B subscription management and recurring billing platform built for speed, accuracy, and enterprise reliability. Designed to handle the full subscription lifecycle—from quotation and product variant configuration to automated invoice generation, payment reconciliation, and real-time financial reporting.

---

## 🌟 What Makes Brightloop Unique?

Unlike basic CRUD subscription apps, Brightloop implements strict enterprise financial rules, automated billing engines, and full customer self-service:

### 1. 🔄 Smart Recurring Billing Engine (With Zero Double-Billing)
* **Catch-Up & Idempotent Billing:** Automatically detects missed billing cycles (e.g. if a system was offline) and generates catch-up invoices without ever generating duplicate charges, backed by database-level unique constraints.
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
