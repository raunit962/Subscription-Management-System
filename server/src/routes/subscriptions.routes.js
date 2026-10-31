'use strict';

const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../lib/auth');
const { HttpError } = require('../lib/errors');
const { parsePagination, paginatedResponse } = require('../lib/pagination');
const { add, mul, round2 } = require('../lib/money');
const { generateSubscriptionNumber } = require('../lib/numbering');
const { transition } = require('../lib/states');
const { periodEnd } = require('../lib/billing');

const router = Router();
router.use(requireAuth);

// ─── GET /api/subscriptions ────────────────────────────────────────────────────
router.get('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const { status, customerId, planId, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = parseInt(customerId, 10);
    if (planId) where.planId = parseInt(planId, 10);
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          customer: true,
          plan: true,
          paymentTerm: true,
          _count: { select: { lines: true, invoices: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/subscriptions/:id ────────────────────────────────────────────────
router.get('/:id', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
        plan: true,
        paymentTerm: true,
        lines: {
          include: {
            product: true,
            attributeValue: true,
            tax: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sub) throw new HttpError(404, 'Subscription not found.');
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/subscriptions ───────────────────────────────────────────────────
// Create subscription (manual or from templateId)
router.post('/', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    let {
      customerId,
      planId,
      templateId,
      startDate,
      expiryDate,
      paymentTermId,
      lines,
    } = req.body;

    if (!customerId) throw new HttpError(400, 'customerId is required.');

    // If templateId provided, prefill plan and lines if not supplied
    if (templateId) {
      const template = await prisma.quoteTemplate.findUnique({
        where: { id: parseInt(templateId, 10) },
      });
      if (!template) throw new HttpError(404, 'Quotation template not found.');
      if (!planId) planId = template.planId;
      if (!lines || lines.length === 0) lines = template.lines;
    }

    if (!planId) throw new HttpError(400, 'planId is required.');
    const plan = await prisma.plan.findUnique({ where: { id: parseInt(planId, 10) } });
    if (!plan) throw new HttpError(404, 'Plan not found.');

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId, 10) },
    });
    if (!customer) throw new HttpError(404, 'Customer not found.');

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new HttpError(400, 'Subscription must contain at least one line.');
    }

    const subStartDate = startDate ? new Date(startDate) : new Date();

    // Prepare line items
    const preparedLines = [];
    for (const line of lines) {
      const qty = parseInt(line.qty || 1, 10);
      if (qty < plan.minQty) {
        throw new HttpError(400, `Line quantity (${qty}) must be at least plan minimum quantity (${plan.minQty}).`);
      }

      const product = await prisma.product.findUnique({
        where: { id: parseInt(line.productId, 10) },
      });
      if (!product) throw new HttpError(404, `Product ID ${line.productId} not found.`);

      let extraPrice = '0.00';
      let attributeValueId = null;
      if (line.attributeValueId) {
        const attrVal = await prisma.attributeValue.findUnique({
          where: { id: parseInt(line.attributeValueId, 10) },
        });
        if (attrVal) {
          extraPrice = round2(attrVal.extraPrice);
          attributeValueId = attrVal.id;
        }
      }

      // unit price = product price + variant extra
      const unitPrice = round2(add(product.salesPrice, extraPrice));
      const amount = round2(mul(qty, unitPrice));

      preparedLines.push({
        productId: product.id,
        attributeValueId,
        qty,
        unitPrice,
        taxId: line.taxId ? parseInt(line.taxId, 10) : null,
        amount,
      });
    }

    const createdSubscription = await prisma.$transaction(async (tx) => {
      const number = await generateSubscriptionNumber(tx);

      return await tx.subscription.create({
        data: {
          number,
          customerId: customer.id,
          planId: plan.id,
          startDate: subStartDate,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          paymentTermId: paymentTermId ? parseInt(paymentTermId, 10) : null,
          status: 'DRAFT',
          lines: {
            create: preparedLines,
          },
        },
        include: {
          lines: true,
          plan: true,
          customer: true,
        },
      });
    });

    res.status(201).json(createdSubscription);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/subscriptions/:id/transition ────────────────────────────────────
// Moves subscription status
router.post('/:id/transition', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { to } = req.body;
    if (!to) throw new HttpError(400, 'Target status "to" is required.');

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!sub) throw new HttpError(404, 'Subscription not found.');

    const nextStatus = transition(sub, to.toUpperCase(), sub.plan);

    const updateData = { status: nextStatus };
    // On activation, set nextInvoiceDate to startDate if not already set
    if (nextStatus === 'ACTIVE' && !sub.nextInvoiceDate) {
      updateData.nextInvoiceDate = sub.startDate;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        plan: true,
        lines: true,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/subscriptions/:id/renew ─────────────────────────────────────────
// Extend expiryDate by one period if plan.renewable
router.post('/:id/renew', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!sub) throw new HttpError(404, 'Subscription not found.');

    if (!sub.plan.renewable) {
      throw new HttpError(409, 'Plan does not allow renewal.');
    }

    const baseDate = sub.expiryDate || sub.startDate;
    const newExpiry = periodEnd(baseDate, sub.plan.period);

    const updated = await prisma.subscription.update({
      where: { id },
      data: { expiryDate: newExpiry },
      include: { plan: true, customer: true, lines: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
