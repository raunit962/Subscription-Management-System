'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { transition } = require('../lib/states');
const { add, sub, round2, gt, lte, eq } = require('../lib/money');

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'INTERNAL'));

const METHODS = ['cash', 'bank_transfer', 'card'];

function serializePayment(p) {
  return { ...p, amount: round2(p.amount) };
}

// ─── GET /api/payments ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.invoiceId) where.invoiceId = parseInt(req.query.invoiceId, 10);

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        include: { invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json(paginatedResponse(data.map(serializePayment), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/payments ────────────────────────────────────────────────────────
// Body: { invoiceId, amount, method?, date?, note? }
// Rejects amount <= 0, amount > outstanding, and invoices not CONFIRMED.
// Sets PAID when amountPaid reaches total.
router.post('/', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.body.invoiceId, 10);
    const { amount, method = 'cash', date, note } = req.body;

    if (!invoiceId) throw new HttpError(400, 'invoiceId is required.');
    if (amount === undefined || amount === null || amount === '' || isNaN(Number(amount))) {
      throw new HttpError(400, 'amount must be a number.');
    }
    if (lte(amount, 0)) throw new HttpError(400, 'amount must be greater than 0.');
    if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) {
      throw new HttpError(400, 'amount may have at most 2 decimal places.');
    }
    if (!METHODS.includes(method)) {
      throw new HttpError(400, `method must be one of: ${METHODS.join(', ')}.`);
    }
    const paidOn = date ? new Date(date) : new Date();
    if (isNaN(paidOn.getTime())) throw new HttpError(400, 'date is invalid.');

    const result = await prisma.$transaction(async (tx) => {
      // Lock the invoice row so concurrent payments can't both pass the outstanding check
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new HttpError(404, 'Invoice not found.');

      if (invoice.status !== 'CONFIRMED') {
        throw new HttpError(409, `Cannot record a payment on a ${invoice.status} invoice.`);
      }

      const outstanding = sub(invoice.total, invoice.amountPaid);
      if (gt(amount, outstanding)) {
        throw new HttpError(400, `amount exceeds outstanding balance of ${outstanding}.`);
      }

      const payment = await tx.payment.create({
        data: { invoiceId, amount: round2(amount), method, date: paidOn, note: note || null },
      });

      const amountPaid = add(invoice.amountPaid, amount);
      const status = eq(amountPaid, invoice.total) ? transition(invoice, 'PAID') : invoice.status;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid, status },
      });

      return { payment, invoice: updated };
    });

    res.status(201).json({
      payment: serializePayment(result.payment),
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        status: result.invoice.status,
        total: round2(result.invoice.total),
        amountPaid: round2(result.invoice.amountPaid),
        outstanding: sub(result.invoice.total, result.invoice.amountPaid),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
