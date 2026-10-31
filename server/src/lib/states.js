'use strict';

const { HttpError } = require('./errors');

/**
 * Valid transitions for subscriptions
 */
const SUBSCRIPTION_TRANSITIONS = {
  DRAFT: ['QUOTATION'],
  QUOTATION: ['CONFIRMED'],
  CONFIRMED: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'CLOSED'],
  PAUSED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

/**
 * Valid transitions for invoices
 */
const INVOICE_TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

/**
 * Validates and returns next status for a Subscription
 * @param {object} sub
 * @param {string} toStatus
 * @param {object} [plan]
 * @returns {string}
 */
function transitionSubscription(sub, toStatus, plan = null) {
  const currentStatus = sub.status;
  const effectivePlan = plan || sub.plan;
  const allowed = SUBSCRIPTION_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(toStatus)) {
    throw new HttpError(
      409,
      `Invalid transition: cannot move subscription from ${currentStatus} to ${toStatus}`
    );
  }

  // Plan-specific rules
  if (toStatus === 'PAUSED' || (currentStatus === 'PAUSED' && toStatus === 'ACTIVE')) {
    if (!effectivePlan || !effectivePlan.pausable) {
      throw new HttpError(409, 'Plan does not allow pausing');
    }
  }

  // Stage 3: a quotation can't be confirmed after its validity day has passed
  if (currentStatus === 'QUOTATION' && toStatus === 'CONFIRMED' && sub.quoteValidUntil) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (new Date(sub.quoteValidUntil) < today) {
      throw new HttpError(409, 'Quotation has expired; create a new quotation');
    }
  }

  if (currentStatus === 'ACTIVE' && toStatus === 'CLOSED') {
    const isExpired = sub.expiryDate && new Date(sub.expiryDate) <= new Date();
    if (effectivePlan && effectivePlan.closable === false && !isExpired) {
      throw new HttpError(409, 'Plan does not allow early closing');
    }
  }

  return toStatus;
}

/**
 * Validates and returns next status for an Invoice
 * @param {object} invoice
 * @param {string} toStatus
 * @returns {string}
 */
function transitionInvoice(invoice, toStatus) {
  const currentStatus = invoice.status;
  const allowed = INVOICE_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(toStatus)) {
    throw new HttpError(
      409,
      `Invalid transition: cannot move invoice from ${currentStatus} to ${toStatus}`
    );
  }

  return toStatus;
}

/**
 * Universal transition helper for subscriptions or invoices
 * @param {object} entity
 * @param {string} toStatus
 * @param {object} [plan]
 * @returns {string}
 */
function transition(entity, toStatus, plan = null) {
  if (!entity || !entity.status) {
    throw new HttpError(400, 'Entity with a status is required');
  }

  // Check if entity is an Invoice
  const isInvoice =
    entity.subtotal !== undefined ||
    entity.periodStart !== undefined ||
    (typeof entity.number === 'string' && entity.number.startsWith('INV-'));

  if (isInvoice) {
    return transitionInvoice(entity, toStatus);
  }

  return transitionSubscription(entity, toStatus, plan);
}

module.exports = {
  SUBSCRIPTION_TRANSITIONS,
  INVOICE_TRANSITIONS,
  transition,
  transitionSubscription,
  transitionInvoice,
};
