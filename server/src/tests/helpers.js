'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

// Switch to test DB before anything else loads
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcrypt');

// One client shared across helpers — test files import this, never instantiate their own.
const prisma = new PrismaClient();

/**
 * Wipe ALL data in FK-safe order.
 * Call at the start of each test file's beforeAll so files are isolated.
 */
async function resetDb() {
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.quoteTemplate.deleteMany();
  await prisma.attributeValue.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.paymentTerm.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
}

/**
 * Create a user directly in DB (bypasses API, no password-rule check needed for fixtures).
 * PORTAL users automatically get a linked Customer row.
 * Returns { user, token }.
 */
async function createUser({
  email,
  password = 'Test@1234!',
  role     = 'PORTAL',
  name     = 'Test User',
} = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  const lowerEmail   = email.toLowerCase();
  let   customerId   = null;

  if (role === 'PORTAL') {
    const customer = await prisma.customer.create({
      data: { name, email: lowerEmail, phone: null },
    });
    customerId = customer.id;
  }

  const user = await prisma.user.create({
    data: { email: lowerEmail, passwordHash, name, role, customerId },
  });

  // Use the real signToken so tokens are valid against the running app
  const { signToken } = require('../lib/auth');
  const token = signToken(user);
  return { user, token };
}

/** Convenience fixture helpers for Stage 2+ */
async function createPlan(overrides = {}) {
  return prisma.plan.create({
    data: {
      name: 'Test Plan', price: 99.00, period: 'MONTHLY',
      minQty: 1, autoClose: false, closable: true, pausable: true, renewable: true,
      ...overrides,
    },
  });
}

async function createProduct(overrides = {}) {
  return prisma.product.create({
    data: { name: 'Test Product', salesPrice: 100.00, costPrice: 30.00, ...overrides },
  });
}

/** Stage 3 fixtures: a subscription, and an invoice with exact totals (bypasses billing). */
let fixtureSeq = 0;

async function createSubscription({ customerId, planId, status = 'ACTIVE', lines = [] }) {
  fixtureSeq += 1;
  return prisma.subscription.create({
    data: {
      number: `SUB-T${Date.now()}-${fixtureSeq}`,
      customerId, planId, status,
      startDate: new Date('2026-01-01T00:00:00Z'),
      lines: { create: lines },
    },
  });
}

async function createInvoice({
  subscription, total, status = 'CONFIRMED', amountPaid = 0,
  dueDate = new Date(Date.now() + 30 * 86400000), invoiceDate = new Date(),
}) {
  fixtureSeq += 1;
  return prisma.invoice.create({
    data: {
      number: `INV-T${Date.now()}-${fixtureSeq}`,
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      periodStart: invoiceDate, periodEnd: invoiceDate, billedPeriod: null,
      invoiceDate, dueDate, status,
      subtotal: total, total, amountPaid,
    },
  });
}

// Do NOT call prisma.$disconnect() here — the shared singleton must stay alive
// for the full Jest run. --forceExit handles cleanup.

module.exports = {
  prisma, resetDb, createUser, createPlan, createProduct,
  createSubscription, createInvoice, // Stage 3
};
