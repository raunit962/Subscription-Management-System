'use strict';

const Decimal = require('decimal.js');

// Configure Decimal.js: no exponential notation, always 2dp on output
Decimal.set({ toExpPos: 9e15, toExpNeg: -9e15 });

/**
 * Add two money values. Returns string rounded to 2 dp.
 * add('1200.00', '560.00') → '1760.00'
 */
function add(a, b) {
  return new Decimal(a ?? 0).plus(new Decimal(b ?? 0)).toFixed(2);
}

/**
 * Subtract b from a. Returns string rounded to 2 dp.
 * sub('1760.00', '560.00') → '1200.00'
 */
function sub(a, b) {
  return new Decimal(a ?? 0).minus(new Decimal(b ?? 0)).toFixed(2);
}

/**
 * Multiply two values. Returns string rounded to 2 dp.
 * mul('5', '99.00') → '495.00'
 */
function mul(a, b) {
  return new Decimal(a ?? 0).times(new Decimal(b ?? 0)).toFixed(2);
}

/**
 * Calculate percentage of amount. Returns string rounded to 2 dp.
 * pct('495.00', '18') → '89.10'  (18% of 495)
 */
function pct(amount, percent) {
  return new Decimal(amount ?? 0)
    .times(new Decimal(percent ?? 0))
    .dividedBy(100)
    .toFixed(2);
}

/**
 * Round a value to 2 decimal places. Returns string.
 */
function round2(val) {
  return new Decimal(val ?? 0).toFixed(2);
}

/**
 * Compare two money values.
 * gt(a, b) → a > b
 * gte(a, b) → a >= b
 * lt(a, b) → a < b
 * lte(a, b) → a <= b
 * eq(a, b)  → a === b
 */
function gt(a, b)  { return new Decimal(a ?? 0).greaterThan(new Decimal(b ?? 0)); }
function gte(a, b) { return new Decimal(a ?? 0).greaterThanOrEqualTo(new Decimal(b ?? 0)); }
function lt(a, b)  { return new Decimal(a ?? 0).lessThan(new Decimal(b ?? 0)); }
function lte(a, b) { return new Decimal(a ?? 0).lessThanOrEqualTo(new Decimal(b ?? 0)); }
function eq(a, b)  { return new Decimal(a ?? 0).equals(new Decimal(b ?? 0)); }

module.exports = { add, sub, mul, pct, round2, gt, gte, lt, lte, eq };
