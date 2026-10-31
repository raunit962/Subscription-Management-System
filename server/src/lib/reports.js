'use strict';

const Decimal = require('decimal.js');
const prisma = require('./prisma');
const { sub, round2 } = require('./money');

// Monthly-equivalent multiplier per plan period, for MRR
const MONTHLY_FACTOR = {
  DAILY:   new Decimal(365).dividedBy(12),
  WEEKLY:  new Decimal(52).dividedBy(12),
  MONTHLY: new Decimal(1),
  YEARLY:  new Decimal(1).dividedBy(12),
};

/** Midnight UTC of the given day. An invoice is overdue only if dueDate is before this. */
function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Outstanding = CONFIRMED (not yet fully paid). Overdue = outstanding and due before today. */
function outstandingWhere(extra = {}) {
  return { status: 'CONFIRMED', ...extra };
}

function overdueWhere(today = new Date(), extra = {}) {
  return outstandingWhere({ dueDate: { lt: startOfDay(today) }, ...extra });
}

/** Whole days between dueDate and today (UTC days). */
function daysOverdue(dueDate, today = new Date()) {
  const ms = startOfDay(today) - startOfDay(dueDate);
  return Math.max(0, Math.round(ms / 86400000));
}

/**
 * Dashboard KPIs — aggregate queries only, never loads full tables.
 * filters: { from?, to?, planId?, status? }
 *   from/to  → payment.date (revenue) and invoice.invoiceDate (invoice summary)
 *   planId   → everything, via the subscription's plan
 *   status   → invoice status for the invoice summary table
 */
async function dashboard({ from, to, planId, status } = {}, today = new Date()) {
  const planFilter = planId ? { planId } : {};
  const invoicePlan = planId ? { subscription: { planId } } : {};

  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  const hasRange = Object.keys(range).length > 0;

  const invoiceSummaryWhere = { ...invoicePlan };
  if (hasRange) invoiceSummaryWhere.invoiceDate = range;
  if (status) invoiceSummaryWhere.status = status;

  const paymentWhere = {};
  if (hasRange) paymentWhere.date = range;
  if (planId) paymentWhere.invoice = invoicePlan;

  const [
    activeSubscriptions,
    subscriptionsByStatus,
    revenue,
    outstanding,
    overdue,
    invoicesByStatus,
    ...mrrParts
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE', ...planFilter } }),
    prisma.subscription.groupBy({ by: ['status'], where: planFilter, _count: { _all: true } }),
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
    prisma.invoice.aggregate({
      where: outstandingWhere(invoicePlan),
      _count: { _all: true },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: overdueWhere(today, invoicePlan),
      _count: { _all: true },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: invoiceSummaryWhere,
      _count: { _all: true },
      _sum: { total: true, amountPaid: true },
    }),
    ...Object.keys(MONTHLY_FACTOR).map((period) =>
      prisma.subscriptionLine.aggregate({
        where: { subscription: { status: 'ACTIVE', ...planFilter, plan: { period } } },
        _sum: { amount: true },
      })
    ),
  ]);

  // MRR = sum of active line amounts (pre-tax, pre-discount) normalised to one month
  const mrr = Object.keys(MONTHLY_FACTOR).reduce(
    (acc, period, i) => acc.plus(new Decimal(mrrParts[i]._sum.amount ?? 0).times(MONTHLY_FACTOR[period])),
    new Decimal(0)
  );

  return {
    activeSubscriptions,
    revenueCollected: round2(revenue._sum.amount),
    outstanding: {
      count: outstanding._count._all,
      amount: sub(outstanding._sum.total, outstanding._sum.amountPaid),
    },
    overdue: {
      count: overdue._count._all,
      amount: sub(overdue._sum.total, overdue._sum.amountPaid),
    },
    mrr: mrr.toFixed(2),
    subscriptionsByStatus: subscriptionsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    invoicesByStatus: invoicesByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
      total: round2(r._sum.total),
      paid: round2(r._sum.amountPaid),
      outstanding: sub(r._sum.total, r._sum.amountPaid),
    })),
  };
}

module.exports = { startOfDay, outstandingWhere, overdueWhere, daysOverdue, dashboard };
