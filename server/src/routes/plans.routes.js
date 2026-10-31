'use strict';

const { Router } = require('express');
const prisma     = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { round2 } = require('../lib/money');

const router = Router();
router.use(requireAuth);

// ─── GET /api/plans ───────────────────────────────────────────────────────────
// ADMIN + INTERNAL read. PORTAL → 403.

router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { period, search } = req.query;

    const where = {};
    if (period) where.period = period.toUpperCase();
    if (search) where.name   = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.plan.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      prisma.plan.count({ where }),
    ]);

    res.json(paginatedResponse(data.map(serializePlan), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/plans/:id ────────────────────────────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id, 10);
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new HttpError(404, 'Plan not found.');
    res.json(serializePlan(plan));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/plans ──────────────────────────────────────────────────────────
// ADMIN only.

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const {
      name, price, period, minQty,
      startDate, endDate,
      autoClose, closable, pausable, renewable,
    } = req.body;

    if (!name)                       throw new HttpError(400, 'name is required.');
    if (price === undefined)         throw new HttpError(400, 'price is required.');
    if (isNaN(parseFloat(price)))    throw new HttpError(400, 'price must be a number.');

    const VALID_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    const normalPeriod  = (period || 'MONTHLY').toUpperCase();
    if (!VALID_PERIODS.includes(normalPeriod)) {
      throw new HttpError(400, `period must be one of: ${VALID_PERIODS.join(', ')}.`);
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        price:     round2(price),
        period:    normalPeriod,
        minQty:    minQty ? parseInt(minQty, 10) : 1,
        startDate: startDate ? new Date(startDate) : null,
        endDate:   endDate   ? new Date(endDate)   : null,
        autoClose: !!autoClose,
        closable:  closable  === undefined ? true : !!closable,
        pausable:  !!pausable,
        renewable: renewable === undefined ? true : !!renewable,
      },
    });

    res.status(201).json(serializePlan(plan));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/plans/:id ───────────────────────────────────────────────────────
// ADMIN only.

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Plan not found.');

    const {
      name, price, period, minQty,
      startDate, endDate,
      autoClose, closable, pausable, renewable,
    } = req.body;

    const data = {};
    if (name      !== undefined) data.name      = name;
    if (price     !== undefined) data.price     = round2(price);
    if (period    !== undefined) data.period    = period.toUpperCase();
    if (minQty    !== undefined) data.minQty    = parseInt(minQty, 10);
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate   !== undefined) data.endDate   = endDate   ? new Date(endDate)   : null;
    if (autoClose !== undefined) data.autoClose = !!autoClose;
    if (closable  !== undefined) data.closable  = !!closable;
    if (pausable  !== undefined) data.pausable  = !!pausable;
    if (renewable !== undefined) data.renewable = !!renewable;

    const plan = await prisma.plan.update({ where: { id }, data });
    res.json(serializePlan(plan));
  } catch (err) {
    next(err);
  }
});

function serializePlan(plan) {
  return { ...plan, price: round2(plan.price) };
}

module.exports = router;

