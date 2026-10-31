'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { round2 } = require('../lib/money');

const router = Router();
router.use(requireAuth);

// ─── GET /api/discounts ────────────────────────────────────────────────────────
// ADMIN + INTERNAL read
router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { scope, search } = req.query;

    const where = {};
    if (scope) where.scope = scope.toUpperCase();
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip,
        take: pageSize,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.discount.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/discounts/:id ────────────────────────────────────────────────────
router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const discount = await prisma.discount.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!discount) throw new HttpError(404, 'Discount not found.');
    res.json(discount);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/discounts ───────────────────────────────────────────────────────
// ADMIN only
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const {
      name,
      type,
      value,
      minQty,
      minPurchase,
      startDate,
      endDate,
      usageLimit,
      scope,
      productId,
    } = req.body;

    if (!name) throw new HttpError(400, 'name is required.');
    if (!type) throw new HttpError(400, 'type is required (FIXED or PERCENT).');
    if (value === undefined) throw new HttpError(400, 'value is required.');

    const normType = type.toUpperCase();
    if (!['FIXED', 'PERCENT'].includes(normType)) {
      throw new HttpError(400, 'type must be FIXED or PERCENT.');
    }

    const normScope = (scope || 'SUBSCRIPTION').toUpperCase();
    if (!['PRODUCT', 'SUBSCRIPTION'].includes(normScope)) {
      throw new HttpError(400, 'scope must be PRODUCT or SUBSCRIPTION.');
    }

    let resolvedProductId = null;
    if (normScope === 'PRODUCT') {
      if (!productId) throw new HttpError(400, 'productId is required when scope is PRODUCT.');
      const prod = await prisma.product.findUnique({ where: { id: parseInt(productId, 10) } });
      if (!prod) throw new HttpError(404, 'Product not found.');
      resolvedProductId = prod.id;
    }

    const discount = await prisma.discount.create({
      data: {
        name,
        type: normType,
        value: round2(value),
        minQty: minQty ? parseInt(minQty, 10) : null,
        minPurchase: minPurchase ? round2(minPurchase) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        scope: normScope,
        productId: resolvedProductId,
      },
      include: { product: true },
    });

    res.status(201).json(discount);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/discounts/:id ────────────────────────────────────────────────────
router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Discount not found.');

    const {
      name,
      type,
      value,
      minQty,
      minPurchase,
      startDate,
      endDate,
      usageLimit,
      scope,
      productId,
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type.toUpperCase();
    if (value !== undefined) data.value = round2(value);
    if (minQty !== undefined) data.minQty = minQty ? parseInt(minQty, 10) : null;
    if (minPurchase !== undefined) data.minPurchase = minPurchase ? round2(minPurchase) : null;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (usageLimit !== undefined) data.usageLimit = usageLimit ? parseInt(usageLimit, 10) : null;
    if (scope !== undefined) data.scope = scope.toUpperCase();
    if (productId !== undefined) data.productId = productId ? parseInt(productId, 10) : null;

    const updated = await prisma.discount.update({
      where: { id },
      data,
      include: { product: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/discounts/:id ─────────────────────────────────────────────────
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.discount.delete({ where: { id } });
    res.json({ message: 'Discount deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
