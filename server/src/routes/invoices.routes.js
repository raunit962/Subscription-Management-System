'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { transition } = require('../lib/states');
const { round2 } = require('../lib/money');

const router = Router();
router.use(requireAuth);

function serializeInvoice(inv) {
  if (!inv) return inv;
  return {
    ...inv,
    subtotal: round2(inv.subtotal),
    discountTotal: round2(inv.discountTotal),
    taxTotal: round2(inv.taxTotal),
    total: round2(inv.total),
    amountPaid: round2(inv.amountPaid),
    lines: Array.isArray(inv.lines)
      ? inv.lines.map((l) => ({
          ...l,
          unitPrice: round2(l.unitPrice),
          discount: round2(l.discount),
          tax: round2(l.tax),
          amount: round2(l.amount),
        }))
      : inv.lines,
  };
}

// ─── GET /api/invoices ─────────────────────────────────────────────────────────
router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { status, customerId, subscriptionId, search } = req.query;

    const where = {};
    if (status) where.status = status.toUpperCase();
    if (customerId) where.customerId = parseInt(customerId, 10);
    if (subscriptionId) where.subscriptionId = parseInt(subscriptionId, 10);
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          customer: true,
          subscription: true,
          lines: true,
          _count: { select: { lines: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json(paginatedResponse(data.map(serializeInvoice), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/invoices/:id ─────────────────────────────────────────────────────
router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        subscription: {
          include: { plan: true },
        },
        lines: true,
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!invoice) throw new HttpError(404, 'Invoice not found.');
    res.json(serializeInvoice(invoice));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/invoices/:id/confirm ───────────────────────────────────────────
router.post('/:id/confirm', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new HttpError(404, 'Invoice not found.');

    const nextStatus = transition(invoice, 'CONFIRMED');

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: nextStatus },
      include: { customer: true, lines: true },
    });

    res.json(serializeInvoice(updated));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/invoices/:id/cancel ────────────────────────────────────────────
// Setting billedPeriod = null frees the period so it can be re-billed
router.post('/:id/cancel', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new HttpError(404, 'Invoice not found.');

    const nextStatus = transition(invoice, 'CANCELLED');

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: nextStatus,
        billedPeriod: null, // Frees the (subscriptionId, billedPeriod) unique constraint
      },
      include: { customer: true, lines: true },
    });

    res.json(serializeInvoice(updated));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/invoices/:id/send ──────────────────────────────────────────────
router.post('/:id/send', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!invoice) throw new HttpError(404, 'Invoice not found.');

    const recipient = invoice.customer?.email || 'customer';
    console.log(`\n📧  INVOICE EMAIL: Invoice ${invoice.number} sent to <${recipient}>\n`);

    res.json({ message: `Invoice ${invoice.number} sent to ${recipient}.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
