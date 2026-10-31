'use strict';

const { Router } = require('express');
const prisma     = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { add, round2 } = require('../lib/money');

const router = Router();
router.use(requireAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Attach a computed variantPrice = salesPrice + extraPrice to each attribute value.
 * All arithmetic goes through decimal.js — no float math.
 */
function withVariantPrices(product) {
  return {
    ...product,
    salesPrice:      round2(product.salesPrice),
    costPrice:       round2(product.costPrice),
    attributeValues: (product.attributeValues || []).map((av) => ({
      ...av,
      extraPrice:   round2(av.extraPrice),
      variantPrice: add(product.salesPrice, av.extraPrice),
    })),
  };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
// ADMIN + INTERNAL can list. PORTAL → 403 (requireRole applied on writes only;
// reads are open to ADMIN/INTERNAL — PORTAL is caught by a negative check).

router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { search } = req.query;

    const where = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const [raw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take:    pageSize,
        orderBy: { createdAt: 'desc' },
        include: { attributeValues: true },
      }),
      prisma.product.count({ where }),
    ]);

    const data = raw.map(withVariantPrices);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const product = await prisma.product.findUnique({
      where:   { id },
      include: { attributeValues: true },
    });
    if (!product) throw new HttpError(404, 'Product not found.');
    res.json(withVariantPrices(product));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/products ───────────────────────────────────────────────────────
// ADMIN only. Optionally accepts attributeValues array in body to create inline.

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, type, salesPrice, costPrice, notes, attributeValues } = req.body;

    if (!name)                       throw new HttpError(400, 'name is required.');
    if (salesPrice === undefined)    throw new HttpError(400, 'salesPrice is required.');
    if (isNaN(parseFloat(salesPrice))) throw new HttpError(400, 'salesPrice must be a number.');

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name,
          type:       type || 'service',
          salesPrice: round2(salesPrice),
          costPrice:  round2(costPrice ?? 0),
          notes:      notes || null,
        },
      });

      if (Array.isArray(attributeValues) && attributeValues.length > 0) {
        await tx.attributeValue.createMany({
          data: attributeValues.map((av) => ({
            productId:  p.id,
            attribute:  av.attribute,
            value:      av.value,
            extraPrice: round2(av.extraPrice ?? 0),
          })),
          skipDuplicates: true,
        });
      }

      return tx.product.findUnique({
        where:   { id: p.id },
        include: { attributeValues: true },
      });
    });

    res.status(201).json(withVariantPrices(product));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/products/:id ────────────────────────────────────────────────────
// ADMIN only — update top-level product fields.

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, type, salesPrice, costPrice, notes } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Product not found.');

    const data = {};
    if (name       !== undefined) data.name       = name;
    if (type       !== undefined) data.type       = type;
    if (salesPrice !== undefined) data.salesPrice = round2(salesPrice);
    if (costPrice  !== undefined) data.costPrice  = round2(costPrice);
    if (notes      !== undefined) data.notes      = notes;

    const product = await prisma.product.update({
      where:   { id },
      data,
      include: { attributeValues: true },
    });

    res.json(withVariantPrices(product));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/products/:id/attributes ───────────────────────────────────────
// ADMIN only — add a new attribute value (variant) to an existing product.

router.post('/:id/attributes', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { attribute, value, extraPrice } = req.body;

    if (!attribute || !value) throw new HttpError(400, 'attribute and value are required.');

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw new HttpError(404, 'Product not found.');

    const av = await prisma.attributeValue.create({
      data: {
        productId,
        attribute,
        value,
        extraPrice: round2(extraPrice ?? 0),
      },
    });

    res.status(201).json({
      ...av,
      extraPrice:   round2(av.extraPrice),
      variantPrice: add(existing.salesPrice, av.extraPrice),
    });
  } catch (err) {
    // Unique constraint violation → 409
    if (err.code === 'P2002') {
      return next(new HttpError(409, `Attribute value "${req.body.value}" already exists for this product.`));
    }
    next(err);
  }
});

// ─── PUT /api/products/:id/attributes/:avId ───────────────────────────────────
// ADMIN only — update an attribute value.

router.put('/:id/attributes/:avId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const avId      = parseInt(req.params.avId, 10);
    const { attribute, value, extraPrice } = req.body;

    const existing = await prisma.attributeValue.findFirst({ where: { id: avId, productId } });
    if (!existing) throw new HttpError(404, 'Attribute value not found.');

    const product = await prisma.product.findUnique({ where: { id: productId } });

    const data = {};
    if (attribute  !== undefined) data.attribute  = attribute;
    if (value      !== undefined) data.value      = value;
    if (extraPrice !== undefined) data.extraPrice = round2(extraPrice);

    const av = await prisma.attributeValue.update({ where: { id: avId }, data });

    res.json({
      ...av,
      extraPrice:   round2(av.extraPrice),
      variantPrice: add(product.salesPrice, av.extraPrice),
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return next(new HttpError(409, 'Duplicate attribute value for this product.'));
    }
    next(err);
  }
});

// ─── DELETE /api/products/:id/attributes/:avId ───────────────────────────────
// ADMIN only

router.delete('/:id/attributes/:avId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const avId      = parseInt(req.params.avId, 10);

    const existing = await prisma.attributeValue.findFirst({ where: { id: avId, productId } });
    if (!existing) throw new HttpError(404, 'Attribute value not found.');

    await prisma.attributeValue.delete({ where: { id: avId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

