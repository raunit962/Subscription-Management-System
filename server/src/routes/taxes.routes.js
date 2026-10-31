'use strict';

const { Router } = require('express');
const prisma     = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { round2 } = require('../lib/money');

const router = Router();
router.use(requireAuth);

// ─── GET /api/taxes ───────────────────────────────────────────────────────────
// ADMIN + INTERNAL can read.

router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [data, total] = await Promise.all([
      prisma.tax.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      prisma.tax.count(),
    ]);

    res.json(paginatedResponse(data.map(serializeTax), total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/taxes/:id ────────────────────────────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id, 10);
    const tax = await prisma.tax.findUnique({ where: { id } });
    if (!tax) throw new HttpError(404, 'Tax not found.');
    res.json(serializeTax(tax));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/taxes ──────────────────────────────────────────────────────────
// ADMIN only.

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, percent } = req.body;
    if (!name)                         throw new HttpError(400, 'name is required.');
    if (percent === undefined)         throw new HttpError(400, 'percent is required.');
    if (isNaN(parseFloat(percent)))    throw new HttpError(400, 'percent must be a number.');

    const p = parseFloat(percent);
    if (p < 0 || p > 100) throw new HttpError(400, 'percent must be between 0 and 100.');

    const tax = await prisma.tax.create({
      data: { name, percent: round2(percent) },
    });
    res.status(201).json(serializeTax(tax));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/taxes/:id ───────────────────────────────────────────────────────
// ADMIN only.

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const existing = await prisma.tax.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Tax not found.');

    const { name, percent } = req.body;
    const data = {};
    if (name    !== undefined) data.name    = name;
    if (percent !== undefined) {
      if (isNaN(parseFloat(percent))) throw new HttpError(400, 'percent must be a number.');
      data.percent = round2(percent);
    }

    const tax = await prisma.tax.update({ where: { id }, data });
    res.json(serializeTax(tax));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/taxes/:id ────────────────────────────────────────────────────
// ADMIN only.

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const existing = await prisma.tax.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Tax not found.');

    await prisma.tax.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function serializeTax(tax) {
  return { ...tax, percent: round2(tax.percent) };
}

module.exports = router;

