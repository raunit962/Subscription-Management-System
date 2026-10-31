'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱  Seeding Brightloop database...\n');

  // ── Passwords ──────────────────────────────────────────────────────────────
  const [adminHash, staffHash, portalHash] = await Promise.all([
    bcrypt.hash('Admin@123!', 10),
    bcrypt.hash('Staff@123!', 10),
    bcrypt.hash('Portal@123!', 10),
  ]);

  // ── Admin ──────────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: 'admin@brightloop.com' },
    update: {},
    create: {
      email:        'admin@brightloop.com',
      passwordHash: adminHash,
      name:         'Admin User',
      role:         'ADMIN',
    },
  });

  // ── Internal staff ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: 'staff@brightloop.com' },
    update: {},
    create: {
      email:        'staff@brightloop.com',
      passwordHash: staffHash,
      name:         'Staff User',
      role:         'INTERNAL',
    },
  });

  // ── Portal customer: Alice ─────────────────────────────────────────────────
  const alice = await prisma.customer.upsert({
    where:  { email: 'alice@example.com' },
    update: {},
    create: { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-555-0101' },
  });
  await prisma.user.upsert({
    where:  { email: 'alice@example.com' },
    update: {},
    create: {
      email:        'alice@example.com',
      passwordHash: portalHash,
      name:         'Alice Johnson',
      role:         'PORTAL',
      customerId:   alice.id,
    },
  });

  // ── Portal customer: Bob ───────────────────────────────────────────────────
  const bob = await prisma.customer.upsert({
    where:  { email: 'bob@example.com' },
    update: {},
    create: { name: 'Bob Smith', email: 'bob@example.com', phone: '+1-555-0102' },
  });
  await prisma.user.upsert({
    where:  { email: 'bob@example.com' },
    update: {},
    create: {
      email:        'bob@example.com',
      passwordHash: portalHash,
      name:         'Bob Smith',
      role:         'PORTAL',
      customerId:   bob.id,
    },
  });

  // ── Products ───────────────────────────────────────────────────────────────
  // Product 1: CRM Software — has Brand variants (Odoo +560, Generic +0)
  const crm = await prisma.product.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      name:       'CRM Software',
      type:       'service',
      salesPrice: 1200.00,
      costPrice:  400.00,
      notes:      'Customer Relationship Management suite',
    },
  });

  await prisma.attributeValue.upsert({
    where: {
      productId_attribute_value: { productId: crm.id, attribute: 'Brand', value: 'Odoo' },
    },
    update: {},
    create: { productId: crm.id, attribute: 'Brand', value: 'Odoo',    extraPrice: 560.00 },
  });
  await prisma.attributeValue.upsert({
    where: {
      productId_attribute_value: { productId: crm.id, attribute: 'Brand', value: 'Generic' },
    },
    update: {},
    create: { productId: crm.id, attribute: 'Brand', value: 'Generic', extraPrice: 0.00 },
  });

  // Product 2: Cloud Hosting
  await prisma.product.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      name:       'Cloud Hosting',
      type:       'service',
      salesPrice: 300.00,
      costPrice:  100.00,
      notes:      'Managed cloud infrastructure',
    },
  });

  // Product 3: Support Plan
  await prisma.product.upsert({
    where:  { id: 3 },
    update: {},
    create: {
      name:       'Support Plan',
      type:       'service',
      salesPrice: 150.00,
      costPrice:  50.00,
      notes:      'Priority technical support',
    },
  });

  // ── Plans ──────────────────────────────────────────────────────────────────
  // Weekly Trial — autoClose, not renewable, not pausable
  await prisma.plan.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      name:      'Weekly Trial',
      price:     19.00,
      period:    'WEEKLY',
      minQty:    1,
      autoClose: true,
      closable:  true,
      pausable:  false,
      renewable: false,
    },
  });

  // Monthly Standard — pausable, renewable
  await prisma.plan.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      name:      'Monthly Standard',
      price:     99.00,
      period:    'MONTHLY',
      minQty:    1,
      autoClose: false,
      closable:  true,
      pausable:  true,
      renewable: true,
    },
  });

  // Yearly Enterprise — not pausable, renewable
  await prisma.plan.upsert({
    where:  { id: 3 },
    update: {},
    create: {
      name:      'Yearly Enterprise',
      price:     999.00,
      period:    'YEARLY',
      minQty:    1,
      autoClose: false,
      closable:  true,
      pausable:  false,
      renewable: true,
    },
  });

  // ── Taxes ──────────────────────────────────────────────────────────────────
  await prisma.tax.upsert({
    where:  { id: 1 },
    update: {},
    create: { name: 'GST 18%',  percent: 18.00 },
  });

  await prisma.tax.upsert({
    where:  { id: 2 },
    update: {},
    create: { name: 'CGST 9%', percent: 9.00 },
  });

  // ── Payment Terms ──────────────────────────────────────────────────────────
  await prisma.paymentTerm.upsert({
    where:  { id: 1 },
    update: {},
    create: { name: 'Net 15', dueDays: 15 },
  });

  await prisma.paymentTerm.upsert({
    where:  { id: 2 },
    update: {},
    create: { name: 'Net 30', dueDays: 30 },
  });

  // ── Stage 2: Templates, Discounts, Active Subscriptions ─────────────────────
  // 1 Quotation Template
  await prisma.quoteTemplate.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Enterprise CRM Package',
      planId: 2, // Monthly Standard
      validityDays: 30,
      lines: [
        { productId: 1, attributeValueId: 1, qty: 5 }, // CRM Software (Odoo)
        { productId: 2, qty: 1 },                      // Cloud Hosting
      ],
    },
  });

  // 1 Discount: 10% on minimum purchase of 500
  await prisma.discount.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Volume Promo 10%',
      type: 'PERCENT',
      value: 10.00,
      minQty: 2,
      minPurchase: 500.00,
      scope: 'SUBSCRIPTION',
      usageLimit: 100,
      usageCount: 0,
    },
  });

  // 3 Active Subscriptions
  // Sub 1: Alice - Monthly Standard
  await prisma.subscription.upsert({
    where: { number: 'SUB-0001' },
    update: {},
    create: {
      number: 'SUB-0001',
      customerId: alice.id,
      planId: 2, // Monthly Standard
      startDate: new Date('2026-09-01T00:00:00Z'),
      status: 'ACTIVE',
      nextInvoiceDate: new Date('2026-10-01T00:00:00Z'),
      paymentTermId: 1,
      lines: {
        create: [
          { productId: 1, attributeValueId: 1, qty: 5, unitPrice: 1760.00, taxId: 1, amount: 8800.00 },
        ],
      },
    },
  });

  // Sub 2: Bob - Monthly Standard
  await prisma.subscription.upsert({
    where: { number: 'SUB-0002' },
    update: {},
    create: {
      number: 'SUB-0002',
      customerId: bob.id,
      planId: 2,
      startDate: new Date('2026-09-15T00:00:00Z'),
      status: 'ACTIVE',
      nextInvoiceDate: new Date('2026-10-15T00:00:00Z'),
      paymentTermId: 2,
      lines: {
        create: [
          { productId: 2, qty: 2, unitPrice: 300.00, taxId: 1, amount: 600.00 },
        ],
      },
    },
  });

  // Sub 3: Alice - Yearly Enterprise
  await prisma.subscription.upsert({
    where: { number: 'SUB-0003' },
    update: {},
    create: {
      number: 'SUB-0003',
      customerId: alice.id,
      planId: 3,
      startDate: new Date('2026-01-01T00:00:00Z'),
      status: 'ACTIVE',
      nextInvoiceDate: new Date('2027-01-01T00:00:00Z'),
      paymentTermId: 1,
      lines: {
        create: [
          { productId: 3, qty: 1, unitPrice: 150.00, amount: 150.00 },
        ],
      },
    },
  });

  // ── Stage 3: SEED_SIZE=large → 5,000 subscriptions + invoices for perf checks ─
  if (process.env.SEED_SIZE === 'large') await seedLarge();

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('✅  Seed complete.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DEMO LOGINS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Role     | Email                  | Password');
  console.log('  ---------|------------------------|----------');
  console.log('  ADMIN    | admin@brightloop.com   | Admin@123!');
  console.log('  INTERNAL | staff@brightloop.com   | Staff@123!');
  console.log('  PORTAL   | alice@example.com      | Portal@123!');
  console.log('  PORTAL   | bob@example.com        | Portal@123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Stage 3 — bulk data via createMany. Numbers continue the SUB-/INV- sequence so
// numbering.js keeps working afterwards. Skips if the large set is already there.
async function seedLarge(subCount = 5000, customerCount = 500) {
  const { mul } = require('../src/lib/money');
  if ((await prisma.subscription.count()) >= subCount) {
    console.log('ℹ️   Large seed already present — skipped.');
    return;
  }
  console.log(`⏳  Large seed: ${customerCount} customers, ${subCount} subscriptions…`);

  const lastSeq = async (model, prefix) => {
    const last = await prisma[model].findFirst({ orderBy: { id: 'desc' }, select: { number: true } });
    return parseInt(last?.number?.replace(prefix, ''), 10) || 0;
  };
  const pad = (n) => String(n).padStart(4, '0');
  const DAY = 86400000;
  const now = Date.now();
  const plans = [
    { id: 1, price: '150.00' },  // weekly
    { id: 2, price: '1760.00' }, // monthly
    { id: 3, price: '300.00' },  // yearly
  ];
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'PAUSED', 'CLOSED', 'CONFIRMED', 'DRAFT'];

  const custStart = (await prisma.customer.count()) + 1;
  await prisma.customer.createMany({
    data: Array.from({ length: customerCount }, (_, i) => ({
      name: `Bulk Customer ${custStart + i}`,
      email: `bulk${custStart + i}@example.com`,
    })),
  });
  const customerIds = (await prisma.customer.findMany({
    where: { email: { startsWith: 'bulk' } }, select: { id: true },
  })).map((c) => c.id);

  const subSeq = await lastSeq('subscription', 'SUB-');
  const subNumbers = [];
  await prisma.subscription.createMany({
    data: Array.from({ length: subCount }, (_, i) => {
      const number = `SUB-${pad(subSeq + i + 1)}`;
      subNumbers.push(number);
      return {
        number,
        customerId: customerIds[i % customerIds.length],
        planId: plans[i % plans.length].id,
        status: statuses[i % statuses.length],
        startDate: new Date(now - 90 * DAY),
        nextInvoiceDate: new Date(now + ((i % 28) + 1) * DAY),
        paymentTermId: 1,
      };
    }),
  });
  const subs = await prisma.subscription.findMany({
    where: { number: { in: subNumbers } }, select: { id: true, customerId: true, planId: true },
  });

  await prisma.subscriptionLine.createMany({
    data: subs.map((s, i) => {
      const price = plans.find((p) => p.id === s.planId).price;
      const qty = (i % 3) + 1;
      return { subscriptionId: s.id, productId: 1, qty, unitPrice: price, amount: mul(price, qty) };
    }),
  });

  // Two invoices per subscription: an older one (mostly paid) and a recent one (mix of states).
  const invSeq = await lastSeq('invoice', 'INV-');
  let n = invSeq;
  const invoices = [];
  subs.forEach((s, i) => {
    const total = plans.find((p) => p.id === s.planId).price;
    [60, 20].forEach((ageDays, k) => {
      const periodStart = new Date(now - ageDays * DAY);
      const status = k === 0
        ? (i % 10 === 0 ? 'CONFIRMED' : 'PAID')            // ~10% of old invoices overdue
        : ['CONFIRMED', 'PAID', 'DRAFT', 'CANCELLED'][i % 4];
      n += 1;
      invoices.push({
        number: `INV-${pad(n)}`,
        subscriptionId: s.id,
        customerId: s.customerId,
        periodStart,
        periodEnd: new Date(periodStart.getTime() + 30 * DAY),
        billedPeriod: status === 'CANCELLED' ? null : periodStart,
        invoiceDate: periodStart,
        dueDate: new Date(periodStart.getTime() + 15 * DAY),
        status,
        subtotal: total,
        total,
        amountPaid: status === 'PAID' ? total : '0.00',
      });
    });
  });
  for (let i = 0; i < invoices.length; i += 2000) {
    await prisma.invoice.createMany({ data: invoices.slice(i, i + 2000) });
  }

  const paid = await prisma.invoice.findMany({
    where: { status: 'PAID', subscriptionId: { in: subs.map((s) => s.id) } },
    select: { id: true, total: true, dueDate: true },
  });
  for (let i = 0; i < paid.length; i += 2000) {
    await prisma.payment.createMany({
      data: paid.slice(i, i + 2000).map((inv) => ({
        invoiceId: inv.id, amount: inv.total, method: 'bank_transfer', date: inv.dueDate,
      })),
    });
  }
  console.log(`✅  Large seed: ${subs.length} subscriptions, ${invoices.length} invoices, ${paid.length} payments.`);
}

main()
  .catch((e) => {
    console.error('❌  Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
