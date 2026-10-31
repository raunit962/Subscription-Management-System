'use strict';

const prisma = require('./prisma');
const {
  add: moneyAdd,
  sub: moneySub,
  mul: moneyMul,
  pct: moneyPct,
  round2: moneyRound2,
  lt: moneyLt,
} = require('./money');
const { generateInvoiceNumber } = require('./numbering');
const { isDiscountApplicable, calculateDiscountAmount, applyTax } = require('./pricing');

/**
 * Calculates end of a billing period given start date and period frequency.
 * Handles month-end clamping (e.g. 31 Jan -> 28 Feb or 29 Feb in leap years).
 * @param {Date|string} start
 * @param {string} period DAILY | WEEKLY | MONTHLY | YEARLY
 * @returns {Date}
 */
function periodEnd(start, period) {
  const d = new Date(start);
  const normalizedPeriod = (period || 'MONTHLY').toUpperCase();

  switch (normalizedPeriod) {
    case 'DAILY': {
      const res = new Date(d);
      res.setUTCDate(res.getUTCDate() + 1);
      return res;
    }
    case 'WEEKLY': {
      const res = new Date(d);
      res.setUTCDate(res.getUTCDate() + 7);
      return res;
    }
    case 'MONTHLY': {
      const day = d.getUTCDate();
      const res = new Date(d);
      res.setUTCDate(1);
      res.setUTCMonth(res.getUTCMonth() + 1);
      const year = res.getUTCFullYear();
      const month = res.getUTCMonth();
      const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      res.setUTCDate(Math.min(day, daysInTargetMonth));
      return res;
    }
    case 'YEARLY': {
      const day = d.getUTCDate();
      const targetYear = d.getUTCFullYear() + 1;
      const res = new Date(d);
      res.setUTCFullYear(targetYear);
      const month = res.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
      res.setUTCDate(Math.min(day, daysInMonth));
      return res;
    }
    default: {
      const res = new Date(d);
      res.setUTCDate(res.getUTCDate() + 30);
      return res;
    }
  }
}

/**
 * Generates an Invoice for a subscription for a given period start.
 * Executed inside a Prisma transaction.
 * @param {object} subscription Subscription (with relations or loaded by id)
 * @param {Date|string} periodStart
 * @param {import('@prisma/client').Prisma.TransactionClient} [txClient]
 * @returns {Promise<object>} Created Invoice
 */
async function generateInvoice(subscription, periodStart, txClient = null) {
  const execute = async (tx) => {
    // 1. Fetch full subscription details
    const fullSub = await tx.subscription.findUnique({
      where: { id: subscription.id },
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
      },
    });

    if (!fullSub) {
      throw new Error(`Subscription ${subscription.id} not found.`);
    }

    const pStart = new Date(periodStart);
    const pEnd = periodEnd(pStart, fullSub.plan.period);

    // 2. Query available discounts
    const availableDiscounts = await tx.discount.findMany({
      orderBy: { id: 'asc' },
    });

    // Find applicable discounts
    const applicableDiscounts = availableDiscounts.filter((d) =>
      isDiscountApplicable(d, fullSub, pStart)
    );

    // Pick applicable product-specific discounts and at most one subscription-level discount
    const productDiscounts = applicableDiscounts.filter((d) => d.scope === 'PRODUCT');
    const subscriptionDiscount = applicableDiscounts.find((d) => d.scope === 'SUBSCRIPTION');

    let subtotal = '0.00';
    let lineDiscountTotal = '0.00';
    let taxTotal = '0.00';
    const invoiceLinesData = [];
    const usedDiscountIds = new Set();

    // 3. Process lines
    for (const line of fullSub.lines) {
      const lineGross = moneyMul(line.qty, line.unitPrice);
      subtotal = moneyAdd(subtotal, lineGross);

      // Check product discount
      let lineDiscount = '0.00';
      const prodDisc = productDiscounts.find((d) => d.productId === line.productId);
      if (prodDisc) {
        lineDiscount = calculateDiscountAmount(prodDisc, lineGross);
        usedDiscountIds.add(prodDisc.id);
      }
      lineDiscountTotal = moneyAdd(lineDiscountTotal, lineDiscount);

      // Net amount before tax
      const lineNet = moneySub(lineGross, lineDiscount);

      // Tax
      let lineTax = '0.00';
      if (line.tax && line.tax.percent) {
        lineTax = applyTax(lineNet, line.tax.percent);
      }
      taxTotal = moneyAdd(taxTotal, lineTax);

      // Build description
      let description = line.product.name;
      if (line.attributeValue) {
        description += ` (${line.attributeValue.attribute}: ${line.attributeValue.value})`;
      }

      invoiceLinesData.push({
        description,
        qty: line.qty,
        unitPrice: moneyRound2(line.unitPrice),
        discount: lineDiscount,
        tax: lineTax,
        amount: lineNet,
      });
    }

    // 4. Subscription-level discount (if applicable)
    let subLevelDiscount = '0.00';
    if (subscriptionDiscount) {
      subLevelDiscount = calculateDiscountAmount(subscriptionDiscount, subtotal);
      usedDiscountIds.add(subscriptionDiscount.id);
    }

    const discountTotal = moneyAdd(lineDiscountTotal, subLevelDiscount);
    // Total = subtotal - discountTotal + taxTotal
    const total = moneySub(moneyAdd(subtotal, taxTotal), discountTotal);

    // 5. Payment due date
    const dueDays = fullSub.paymentTerm ? fullSub.paymentTerm.dueDays : 15;
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + dueDays);

    // 6. Generate sequential invoice number
    const number = await generateInvoiceNumber(tx);

    // 7. Create invoice in DB
    const invoice = await tx.invoice.create({
      data: {
        number,
        subscriptionId: fullSub.id,
        customerId: fullSub.customerId,
        periodStart: pStart,
        periodEnd: pEnd,
        billedPeriod: pStart, // Set to pStart; unique guard
        invoiceDate,
        dueDate,
        status: 'DRAFT',
        subtotal: moneyRound2(subtotal),
        discountTotal: moneyRound2(discountTotal),
        taxTotal: moneyRound2(taxTotal),
        total: moneyRound2(total),
        amountPaid: '0.00',
        lines: {
          create: invoiceLinesData,
        },
      },
      include: {
        lines: true,
        customer: true,
        subscription: true,
      },
    });

    // 8. Increment usage count on applied discounts in the same transaction
    for (const discId of usedDiscountIds) {
      await tx.discount.update({
        where: { id: discId },
        data: { usageCount: { increment: 1 } },
      });
    }

    // 9. Advance subscription nextInvoiceDate
    await tx.subscription.update({
      where: { id: fullSub.id },
      data: { nextInvoiceDate: pEnd },
    });

    return invoice;
  };

  if (txClient) {
    return await execute(txClient);
  }
  return await prisma.$transaction(execute);
}

/**
 * Runs billing for all active subscriptions up to the given date.
 * Idempotent, handles catch-up billing, catches P2002 to avoid double billing.
 * @param {Date|string} [targetDate=new Date()]
 * @returns {Promise<{ createdCount: number, skippedCount: number, invoices: object[] }>}
 */
async function runBilling(targetDate = new Date()) {
  const date = new Date(targetDate);
  let createdCount = 0;
  let skippedCount = 0;
  const createdInvoices = [];

  // Query ACTIVE subscriptions
  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: {
      plan: true,
      customer: true,
      paymentTerm: true,
      lines: {
        include: { product: true, attributeValue: true, tax: true },
      },
    },
  });

  for (const currentSub of activeSubs) {
    // Check autoClose rule
    if (currentSub.plan && currentSub.plan.autoClose && currentSub.expiryDate && new Date(currentSub.expiryDate) <= date) {
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: { status: 'CLOSED' },
      });
      continue; // closed subscriptions not billed
    }

    // Subscriptions without nextInvoiceDate or past targetDate are skipped
    if (!currentSub.nextInvoiceDate) continue;

    let currentNext = new Date(currentSub.nextInvoiceDate);

    // Loop while nextInvoiceDate <= date (catches up missed periods)
    while (currentNext <= date) {
      const periodStartToBill = new Date(currentNext);
      try {
        const invoice = await generateInvoice(currentSub, periodStartToBill);
        createdInvoices.push(invoice);
        createdCount++;
        currentNext = new Date(invoice.periodEnd);
      } catch (err) {
        // Prisma unique constraint violation code is P2002 (subscriptionId, billedPeriod)
        if (err.code === 'P2002') {
          skippedCount++;
          // Advance period so we don't loop endlessly on duplicate period
          currentNext = periodEnd(periodStartToBill, currentSub.plan.period);
          await prisma.subscription.update({
            where: { id: currentSub.id },
            data: { nextInvoiceDate: currentNext },
          });
        } else {
          throw err;
        }
      }
    }
  }

  return {
    createdCount,
    skippedCount,
    invoices: createdInvoices,
  };
}

module.exports = {
  periodEnd,
  generateInvoice,
  runBilling,
};
