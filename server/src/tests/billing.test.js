'use strict';

const request = require('supertest');
const app = require('../app');
const { resetDb, createUser, createPlan, createProduct } = require('./helpers');
const { periodEnd } = require('../lib/billing');

describe('billing: period math, catch-up and double-billing guard', () => {
  let adminToken;
  let customer;
  let monthlyPlan;
  let product;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ email: 'admin@billing.test', role: 'ADMIN' });
    adminToken = admin.token;

    const portal = await createUser({ email: 'client@billing.test', role: 'PORTAL' });
    customer = await portal.user;

    monthlyPlan = await createPlan({
      name: 'Monthly Billing Plan',
      period: 'MONTHLY',
      pausable: true,
      closable: true,
    });

    product = await createProduct({ name: 'Standard Seat', salesPrice: 50.00 });
  });

  test('periods: 31 Jan monthly → next 28 Feb (29 in leap year)', () => {
    // 2026 is non-leap year: 31 Jan -> 28 Feb
    const jan31_2026 = new Date('2026-01-31T00:00:00Z');
    const feb2026 = periodEnd(jan31_2026, 'MONTHLY');
    expect(feb2026.getUTCFullYear()).toBe(2026);
    expect(feb2026.getUTCMonth()).toBe(1); // 0-indexed: Feb is 1
    expect(feb2026.getUTCDate()).toBe(28);

    // 2024 is a leap year: 31 Jan -> 29 Feb
    const jan31_2024 = new Date('2024-01-31T00:00:00Z');
    const feb2024 = periodEnd(jan31_2024, 'MONTHLY');
    expect(feb2024.getUTCFullYear()).toBe(2024);
    expect(feb2024.getUTCMonth()).toBe(1);
    expect(feb2024.getUTCDate()).toBe(29);
  });

  test('billing: running twice for the same date creates no duplicate invoices', async () => {
    // Create an active subscription
    const subRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: monthlyPlan.id,
        startDate: '2026-01-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 2 }],
      });
    const subId = subRes.body.id;

    // Move to ACTIVE
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });

    // Run billing for 2026-01-15 (covers Jan 1)
    const run1 = await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-01-15T00:00:00Z' });
    expect(run1.status).toBe(200);
    expect(run1.body.createdCount).toBe(1);

    // Run billing again with same date → 0 created, no duplicate
    const run2 = await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-01-15T00:00:00Z' });
    expect(run2.status).toBe(200);
    expect(run2.body.createdCount).toBe(0);

    // Verify invoice count for this subscription is exactly 1
    const invRes = await request(app)
      .get(`/api/invoices?subscriptionId=${subId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invRes.body.total).toBe(1);
  });

  test('billing: subscription 3 months behind → exactly 3 invoices', async () => {
    // Create subscription starting 3 months ago (e.g. 2026-06-01)
    const subRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: monthlyPlan.id,
        startDate: '2026-06-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const subId = subRes.body.id;

    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });

    // Date is 3 months later: 2026-08-15 (covers periods starting June 1, July 1, Aug 1)
    const runRes = await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-08-15T00:00:00Z' });

    expect(runRes.status).toBe(200);

    // Query invoices for this specific subscription
    const invoices = await request(app)
      .get(`/api/invoices?subscriptionId=${subId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(invoices.body.total).toBe(3);
    expect(invoices.body.data).toHaveLength(3);
  });

  test('billing: paused and closed subscriptions are not billed', async () => {
    // 1. Paused subscription
    const pausedRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: monthlyPlan.id,
        startDate: '2026-01-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const pausedId = pausedRes.body.id;
    await request(app).post(`/api/subscriptions/${pausedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${pausedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${pausedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });
    await request(app).post(`/api/subscriptions/${pausedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'PAUSED' });

    // 2. Closed subscription
    const closedRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: monthlyPlan.id,
        startDate: '2026-01-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const closedId = closedRes.body.id;
    await request(app).post(`/api/subscriptions/${closedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${closedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${closedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });
    await request(app).post(`/api/subscriptions/${closedId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CLOSED' });

    // Trigger billing
    await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-05-01T00:00:00Z' });

    // Neither paused nor closed subscriptions should have any invoices
    const pInvoices = await request(app)
      .get(`/api/invoices?subscriptionId=${pausedId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pInvoices.body.total).toBe(0);

    const cInvoices = await request(app)
      .get(`/api/invoices?subscriptionId=${closedId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cInvoices.body.total).toBe(0);
  });
});
