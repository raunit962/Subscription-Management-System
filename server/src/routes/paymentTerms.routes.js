'use strict';

const { Router } = require('express');
const prisma     = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

const router = Router();
router.use(requireAuth);

// ─── GET /api/payment-terms ───────────────────────────────────────────────────
// ADMIN + INTERNAL read.

router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [data, total] = await Promise.all([
      prisma.paymentTerm.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      prisma.paymentTerm.count(),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/payment-terms/:id ───────────────────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id, 10);
    const term = await prisma.paymentTerm.findUnique({ where: { id } });
    if (!term) throw new HttpError(404, 'Payment term not found.');
    res.json(term);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/payment-terms ──────────────────────────────────────────────────
// ADMIN only.

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, dueDays } = req.body;
    if (!name)                         throw new HttpError(400, 'name is required.');
    if (dueDays === undefined)         throw new HttpError(400, 'dueDays is required.');
    if (!Number.isInteger(Number(dueDays)) || Number(dueDays) < 0) {
      throw new HttpError(400, 'dueDays must be a non-negative integer.');
    }

    const term = await prisma.paymentTerm.create({
      data: { name, dueDays: parseInt(dueDays, 10) },
    });
    res.status(201).json(term);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/payment-terms/:id ───────────────────────────────────────────────
// ADMIN only.

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const existing = await prisma.paymentTerm.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Payment term not found.');

    const { name, dueDays } = req.body;
    const data = {};
    if (name    !== undefined) data.name    = name;
    if (dueDays !== undefined) {
      if (!Number.isInteger(Number(dueDays)) || Number(dueDays) < 0) {
        throw new HttpError(400, 'dueDays must be a non-negative integer.');
      }
      data.dueDays = parseInt(dueDays, 10);
    }

    const term = await prisma.paymentTerm.update({ where: { id }, data });
    res.json(term);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/payment-terms/:id ───────────────────────────────────────────
// ADMIN only.

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const existing = await prisma.paymentTerm.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Payment term not found.');

    await prisma.paymentTerm.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

