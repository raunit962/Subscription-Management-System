'use strict';

/**
 * Generates sequential subscription numbers like 'SUB-0001'
 * inside a Prisma transaction.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<string>}
 */
async function generateSubscriptionNumber(tx) {
  const last = await tx.subscription.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, number: true },
  });

  let nextSeq = 1;
  if (last && last.number && last.number.startsWith('SUB-')) {
    const parsed = parseInt(last.number.replace('SUB-', ''), 10);
    if (!Number.isNaN(parsed)) {
      nextSeq = parsed + 1;
    } else {
      nextSeq = (last.id || 0) + 1;
    }
  } else if (last) {
    nextSeq = (last.id || 0) + 1;
  }

  return `SUB-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Generates sequential invoice numbers like 'INV-0001'
 * inside a Prisma transaction.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<string>}
 */
async function generateInvoiceNumber(tx) {
  const last = await tx.invoice.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, number: true },
  });

  let nextSeq = 1;
  if (last && last.number && last.number.startsWith('INV-')) {
    const parsed = parseInt(last.number.replace('INV-', ''), 10);
    if (!Number.isNaN(parsed)) {
      nextSeq = parsed + 1;
    } else {
      nextSeq = (last.id || 0) + 1;
    }
  } else if (last) {
    nextSeq = (last.id || 0) + 1;
  }

  return `INV-${String(nextSeq).padStart(4, '0')}`;
}

module.exports = {
  generateSubscriptionNumber,
  generateInvoiceNumber,
};
