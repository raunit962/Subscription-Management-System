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

main()
  .catch((e) => {
    console.error('❌  Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
