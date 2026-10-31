'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { round2, sub } = require('../lib/money');
const { dashboard, overdueWhere, daysOverdue } = require('../lib/reports');

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'INTERNAL'));

const INVOICE_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'];

function parseDate(value, name, endOfDay = false) {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new HttpError(400, `${name} is not a valid date.`);
  // A bare YYYY-MM-DD "to" date includes the whole day
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ─── GET /api/reports/dashboard?from=&to=&planId=&status= ─────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const from = parseDate(req.query.from, 'from');
    const to = parseDate(req.query.to, 'to', true);
    const planId = req.query.planId ? parseInt(req.query.planId, 10) : undefined;
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    if (status && !INVOICE_STATUSES.includes(status)) {
      throw new HttpError(400, `status must be one of: ${INVOICE_STATUSES.join(', ')}.`);
    }

    res.json(await dashboard({ from, to, planId, status }));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/overdue ─────────────────────────────────────────────────
router.get('/overdue', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const today = new Date();
    const where = overdueWhere(today);

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          number: true,
          dueDate: true,
          total: true,
          amountPaid: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    const data = rows.map((inv) => ({
      ...inv,
      total: round2(inv.total),
      amountPaid: round2(inv.amountPaid),
      outstanding: sub(inv.total, inv.amountPaid),
      daysOverdue: daysOverdue(inv.dueDate, today),
    }));

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
