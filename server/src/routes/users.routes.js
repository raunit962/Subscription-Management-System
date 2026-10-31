'use strict';

const { Router } = require('express');
const prisma      = require('../lib/prisma');
const { requireAuth, requireRole, validatePassword, hashPassword } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');

const router = Router();

// All users routes require auth
router.use(requireAuth);

// ─── POST /api/users — ADMIN only: create INTERNAL or ADMIN staff account ───

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      throw new HttpError(400, 'name, email and password are required.');
    }

    // Only INTERNAL staff accounts can be created this way (PORTAL signs up themselves)
    const allowedRoles = ['INTERNAL', 'ADMIN'];
    const assignedRole = role && allowedRoles.includes(role) ? role : 'INTERNAL';

    const normalizedEmail = email.trim().toLowerCase();

    validatePassword(password);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email:      normalizedEmail,
        passwordHash,
        name,
        role:       assignedRole,
        customerId: null,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users — ADMIN only: list all staff users (paginated) ──────────

router.get('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take:    pageSize,
        orderBy: { createdAt: 'desc' },
        select:  { id: true, email: true, name: true, role: true, customerId: true, createdAt: true },
      }),
      prisma.user.count(),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/:id — ADMIN only: get single user ───────────────────────

router.get('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id, 10);
    const user = await prisma.user.findUnique({
      where:  { id },
      select: { id: true, email: true, name: true, role: true, customerId: true, createdAt: true },
    });
    if (!user) throw new HttpError(404, 'User not found.');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

