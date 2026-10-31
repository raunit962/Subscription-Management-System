'use strict';

const { Router } = require('express');
const { requireAuth, requireRole } = require('../lib/auth');
const { runBilling } = require('../lib/billing');

const router = Router();
router.use(requireAuth);

// ─── POST /api/billing/run ─────────────────────────────────────────────────────
// ADMIN + INTERNAL can trigger a billing run
router.post('/run', requireRole('ADMIN', 'INTERNAL'), async (req, res, next) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();

    const result = await runBilling(targetDate);

    res.json({
      message: 'Billing run completed.',
      date: targetDate.toISOString(),
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      invoices: result.invoices,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
