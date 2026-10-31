'use strict';

const { add, sub, mul, pct, round2, lt } = require('./money');

/**
 * Computes base line amount = qty * unitPrice
 * @param {number|string} qty
 * @param {number|string} unitPrice
 * @returns {string}
 */
function lineAmount(qty, unitPrice) {
  return mul(qty, unitPrice);
}

/**
 * Checks whether a discount is applicable to a given subscription at a given date.
 * @param {object} discount
 * @param {object} subscription
 * @param {Date|string} [date=new Date()]
 * @returns {boolean}
 */
function isDiscountApplicable(discount, subscription, date = new Date()) {
  if (!discount) return false;

  const checkDate = new Date(date);

  // Date window checks
  if (discount.startDate && checkDate < new Date(discount.startDate)) {
    return false;
  }
  if (discount.endDate && checkDate > new Date(discount.endDate)) {
    return false;
  }

  // Usage limit check
  if (
    discount.usageLimit !== null &&
    discount.usageLimit !== undefined &&
    discount.usageCount >= discount.usageLimit
  ) {
    return false;
  }

  const lines = subscription.lines || [];

  // Scope check & criteria
  if (discount.scope === 'PRODUCT') {
    if (!discount.productId) return false;
    const matchingLines = lines.filter((l) => l.productId === discount.productId);
    if (matchingLines.length === 0) return false;

    // Check minQty on the product lines
    if (discount.minQty !== null && discount.minQty !== undefined) {
      const totalProductQty = matchingLines.reduce((sum, l) => sum + (l.qty || 0), 0);
      if (totalProductQty < discount.minQty) {
        return false;
      }
    }

    // Check minPurchase on the product lines
    if (discount.minPurchase !== null && discount.minPurchase !== undefined) {
      const productSubtotal = matchingLines.reduce((sum, l) => {
        const lineAmt = l.amount ? String(l.amount) : mul(l.qty, l.unitPrice);
        return add(sum, lineAmt);
      }, '0.00');
      if (lt(productSubtotal, discount.minPurchase)) {
        return false;
      }
    }
  } else {
    // SUBSCRIPTION scope
    if (discount.minQty !== null && discount.minQty !== undefined) {
      const totalQty = lines.reduce((sum, l) => sum + (l.qty || 0), 0);
      if (totalQty < discount.minQty) {
        return false;
      }
    }

    if (discount.minPurchase !== null && discount.minPurchase !== undefined) {
      const subtotal = lines.reduce((sum, l) => {
        const lineAmt = l.amount ? String(l.amount) : mul(l.qty, l.unitPrice);
        return add(sum, lineAmt);
      }, '0.00');
      if (lt(subtotal, discount.minPurchase)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculates discount amount based on type FIXED or PERCENT
 * @param {object} discount
 * @param {string|number} baseAmount
 * @returns {string}
 */
function calculateDiscountAmount(discount, baseAmount) {
  if (!discount) return '0.00';
  if (discount.type === 'PERCENT') {
    return pct(baseAmount, discount.value);
  }
  // FIXED discount: cannot exceed base amount
  const fixedVal = round2(discount.value);
  if (lt(baseAmount, fixedVal)) {
    return round2(baseAmount);
  }
  return fixedVal;
}

/**
 * Calculates tax on an amount after discount
 * @param {string|number} amountAfterDiscount
 * @param {string|number} taxPercent
 * @returns {string}
 */
function applyTax(amountAfterDiscount, taxPercent) {
  if (!taxPercent) return '0.00';
  return pct(amountAfterDiscount, taxPercent);
}

module.exports = {
  lineAmount,
  isDiscountApplicable,
  calculateDiscountAmount,
  applyTax,
};
