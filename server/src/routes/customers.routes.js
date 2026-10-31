'use strict';

const { Router } = require('express');
const prisma      = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

const router = Router();

// All customer routes require auth
router.use(requireAuth);

// ─── POST /api/customers — ADMIN/INTERNAL: create a customer ─────────────────

router.post('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) throw new HttpError(400, 'name and email are required.');

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new HttpError(409, 'A customer with this email already exists.');

    const customer = await prisma.customer.create({
      data: { name, email: normalizedEmail, phone: phone || null },
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/customers — ADMIN/INTERNAL: list customers (paginated) ─────────

router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { search } = req.query;

    const where = search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take:    pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/customers/:id — ADMIN/INTERNAL ──────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id, 10);
    const customer = await prisma.customer.findUnique({
      where:   { id },
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!customer) throw new HttpError(404, 'Customer not found.');
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

