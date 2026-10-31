'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { round2, sub } = require('../lib/money');
const { transition } = require('../lib/states');
const { periodEnd } = require('../lib/billing');

const router = Router();
router.use(requireAuth, requireRole('PORTAL'));

// Every query is scoped by the customerId in the token — never by an ID from the URL or body.
router.use((req, _res, next) => {
  if (!req.user.customerId) return next(new HttpError(403, 'No customer linked to this account.'));
  req.customerId = req.user.customerId;
  next();
});

// What the portal needs to know about a plan to show the allowed actions
const PLAN_FIELDS = { name: true, period: true, pausable: true, closable: true, renewable: true };

// Draft invoices are internal work-in-progress; customers only see issued ones.
const VISIBLE_INVOICE = { status: { not: 'DRAFT' } };

function serializeInvoice(inv) {
  return {
    ...inv,
    subtotal: round2(inv.subtotal),
    discountTotal: round2(inv.discountTotal),
    taxTotal: round2(inv.taxTotal),
    total: round2(inv.total),
    amountPaid: round2(inv.amountPaid),
    outstanding: sub(inv.total, inv.amountPaid),
    lines: inv.lines?.map((l) => ({
      ...l,
      unitPrice: round2(l.unitPrice),
      discount: round2(l.discount),
      tax: round2(l.tax),
      amount: round2(l.amount),
    })),
    payments: inv.payments?.map((p) => ({ ...p, amount: round2(p.amount) })),
  };
}

function parseId(value) {
  const id = parseInt(value, 10);
  if (!id) throw new HttpError(404, 'Not found.');
  return id;
}

// ─── GET /api/portal/subscriptions ────────────────────────────────────────────
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = { customerId: req.customerId };
    const [data, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        include: { plan: { select: PLAN_FIELDS } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/portal/subscriptions/:id ────────────────────────────────────────
router.get('/subscriptions/:id', async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { id: parseId(req.params.id), customerId: req.customerId },
      include: {
        plan: true,
        lines: { include: { product: true, attributeValue: true, tax: true } },
        invoices: { where: VISIBLE_INVOICE, orderBy: { invoiceDate: 'desc' } },
      },
    });
    if (!sub) throw new HttpError(404, 'Subscription not found.');
    res.json({
      ...sub,
      lines: sub.lines.map((l) => ({ ...l, unitPrice: round2(l.unitPrice), amount: round2(l.amount) })),
      invoices: sub.invoices.map(serializeInvoice),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/portal/subscriptions/:id/transition { to } ─────────────────────
// Customers manage their own running subscriptions: pause / resume / close.
// Activation and quotes stay with staff. Plan flags are enforced by lib/states.
const CUSTOMER_MOVES = { ACTIVE: ['PAUSED', 'CLOSED'], PAUSED: ['ACTIVE', 'CLOSED'] };

async function findOwnSubscription(req) {
  const sub = await prisma.subscription.findFirst({
    where: { id: parseId(req.params.id), customerId: req.customerId },
    include: { plan: true },
  });
  if (!sub) throw new HttpError(404, 'Subscription not found.');
  return sub;
}

router.post('/subscriptions/:id/transition', async (req, res, next) => {
  try {
    const to = String(req.body.to || '').toUpperCase();
    const sub = await findOwnSubscription(req);
    if (!(CUSTOMER_MOVES[sub.status] || []).includes(to)) {
      throw new HttpError(409, `You can't move a ${sub.status} subscription to ${to || 'that status'}.`);
    }
    const status = transition(sub, to, sub.plan);
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status },
      include: { plan: { select: PLAN_FIELDS } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/portal/subscriptions/:id/renew ─────────────────────────────────
// Extends expiry by one period, only when the plan is renewable.
router.post('/subscriptions/:id/renew', async (req, res, next) => {
  try {
    const sub = await findOwnSubscription(req);
    if (!['ACTIVE', 'PAUSED'].includes(sub.status)) {
      throw new HttpError(409, `A ${sub.status} subscription can't be renewed.`);
    }
    if (!sub.plan.renewable) throw new HttpError(409, 'Plan does not allow renewal.');
    if (!sub.expiryDate) throw new HttpError(409, 'Subscription has no expiry date to extend.');
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { expiryDate: periodEnd(sub.expiryDate, sub.plan.period) },
      include: { plan: { select: PLAN_FIELDS } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/portal/invoices ─────────────────────────────────────────────────
router.get('/invoices', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = { customerId: req.customerId, ...VISIBLE_INVOICE };
    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        include: { subscription: { select: { number: true } } },
        orderBy: { invoiceDate: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);
    res.json(paginatedResponse(data.map(serializeInvoice), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/portal/invoices/:id ─────────────────────────────────────────────
// Same shape as GET /api/invoices/:id so the shared print view can use it.
router.get('/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: parseId(req.params.id), customerId: req.customerId, ...VISIBLE_INVOICE },
      include: {
        customer: true,
        subscription: { include: { plan: true } },
        lines: true,
        payments: { orderBy: { date: 'desc' } },
      },
    });
    if (!invoice) throw new HttpError(404, 'Invoice not found.');
    res.json(serializeInvoice(invoice));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/portal/payments ─────────────────────────────────────────────────
router.get('/payments', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = { invoice: { customerId: req.customerId } };
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        include: { invoice: { select: { id: true, number: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);
    res.json(paginatedResponse(data.map((p) => ({ ...p, amount: round2(p.amount) })), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
