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
