'use strict';

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const { errorHandler } = require('./lib/errors');

// ── Route imports (Stage 1) ──────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const usersRoutes        = require('./routes/users.routes');
const customersRoutes    = require('./routes/customers.routes');
const productsRoutes     = require('./routes/products.routes');
const plansRoutes        = require('./routes/plans.routes');
const taxesRoutes        = require('./routes/taxes.routes');
const paymentTermsRoutes = require('./routes/paymentTerms.routes');
// Stage 2 will append its require() lines below this comment
const templatesRoutes     = require('./routes/templates.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const discountsRoutes     = require('./routes/discounts.routes');
const invoicesRoutes      = require('./routes/invoices.routes');
const billingRoutes       = require('./routes/billing.routes');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Route mounts (Stage 1) ────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/customers',     customersRoutes);
app.use('/api/products',      productsRoutes);
app.use('/api/plans',         plansRoutes);
app.use('/api/taxes',         taxesRoutes);
app.use('/api/payment-terms', paymentTermsRoutes);
// Stage 2/3 will append their app.use() lines below this comment
app.use('/api/templates',     templatesRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/discounts',     discountsRoutes);
app.use('/api/invoices',      invoicesRoutes);
app.use('/api/billing',       billingRoutes);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
