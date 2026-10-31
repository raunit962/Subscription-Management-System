'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

const router = Router();
router.use(requireAuth);

// ─── GET /api/templates ────────────────────────────────────────────────────────
// ADMIN + INTERNAL read
router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { search } = req.query;

    const where = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.quoteTemplate.findMany({
        where,
        skip,
        take: pageSize,
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quoteTemplate.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/templates/:id ────────────────────────────────────────────────────
router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const template = await prisma.quoteTemplate.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!template) throw new HttpError(404, 'Quotation template not found.');
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/templates ───────────────────────────────────────────────────────
router.post('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { name, planId, validityDays, lines } = req.body;
    if (!name) throw new HttpError(400, 'name is required.');
    if (!planId) throw new HttpError(400, 'planId is required.');

    const plan = await prisma.plan.findUnique({ where: { id: parseInt(planId, 10) } });
    if (!plan) throw new HttpError(404, 'Plan not found.');

    const template = await prisma.quoteTemplate.create({
      data: {
        name,
        planId: plan.id,
        validityDays: validityDays ? parseInt(validityDays, 10) : 30,
        lines: lines || [],
      },
      include: { plan: true },
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/templates/:id ────────────────────────────────────────────────────
router.put('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, planId, validityDays, lines } = req.body;

    const existing = await prisma.quoteTemplate.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Quotation template not found.');

    const data = {};
    if (name !== undefined) data.name = name;
    if (planId !== undefined) data.planId = parseInt(planId, 10);
    if (validityDays !== undefined) data.validityDays = parseInt(validityDays, 10);
    if (lines !== undefined) data.lines = lines;

    const updated = await prisma.quoteTemplate.update({
      where: { id },
      data,
      include: { plan: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/templates/:id ─────────────────────────────────────────────────
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.quoteTemplate.delete({ where: { id } });
    res.json({ message: 'Template deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
