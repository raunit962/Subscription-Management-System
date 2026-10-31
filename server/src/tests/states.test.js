'use strict';

const request = require('supertest');
const app = require('../app');
const { resetDb, createUser, createPlan, createProduct } = require('./helpers');

describe('states: subscription and invoice state machines', () => {
  let adminToken;
  let customer;
  let pausablePlan;
  let nonPausablePlan;
  let product;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ email: 'admin@states.test', role: 'ADMIN' });
    adminToken = admin.token;

    const portal = await createUser({ email: 'client@states.test', role: 'PORTAL' });
    customer = await portal.user;

    pausablePlan = await createPlan({ name: 'Pausable Plan', pausable: true, closable: true });
    nonPausablePlan = await createPlan({ name: 'Non-Pausable Plan', pausable: false, closable: true });
    product = await createProduct({ name: 'Service A', salesPrice: 100.00 });
  });

  test('states: every invalid subscription transition → 409; pause blocked when plan not pausable', async () => {
    // 1. Create a draft subscription
    const subRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: pausablePlan.id,
        lines: [{ productId: product.id, qty: 1 }],
      });
    expect(subRes.status).toBe(201);
    const subId = subRes.body.id;
    expect(subRes.body.status).toBe('DRAFT');

    // Invalid moves from DRAFT:
    // DRAFT -> CONFIRMED (skip QUOTATION)
    let res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'CONFIRMED' });
    expect(res.status).toBe(409);

    // DRAFT -> ACTIVE
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'ACTIVE' });
    expect(res.status).toBe(409);

    // DRAFT -> PAUSED
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'PAUSED' });
    expect(res.status).toBe(409);

    // DRAFT -> CLOSED
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'CLOSED' });
    expect(res.status).toBe(409);

    // Valid: DRAFT -> QUOTATION
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'QUOTATION' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('QUOTATION');

    // Invalid from QUOTATION: -> ACTIVE
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'ACTIVE' });
    expect(res.status).toBe(409);

    // Valid: QUOTATION -> CONFIRMED
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');

    // Invalid from CONFIRMED: -> PAUSED
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'PAUSED' });
    expect(res.status).toBe(409);

    // Valid: CONFIRMED -> ACTIVE
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');

    // Invalid from ACTIVE: -> DRAFT
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'DRAFT' });
    expect(res.status).toBe(409);

    // Check pause blocked on non-pausable plan
    const nonPauseSub = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: nonPausablePlan.id,
        lines: [{ productId: product.id, qty: 1 }],
      });
    expect(nonPauseSub.status).toBe(201);
    const npId = nonPauseSub.body.id;

    // Fast-forward to ACTIVE
    await request(app).post(`/api/subscriptions/${npId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${npId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${npId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });

    // Pause on non-pausable plan MUST FAIL with 409
    res = await request(app)
      .post(`/api/subscriptions/${npId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'PAUSED' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Plan does not allow pausing/i);

    // Pause on pausable sub succeeds
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'PAUSED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAUSED');

    // Resume from PAUSED -> ACTIVE succeeds
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');

    // Close from ACTIVE -> CLOSED succeeds
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'CLOSED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');

    // Any transition from CLOSED fails
    res = await request(app)
      .post(`/api/subscriptions/${subId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to: 'ACTIVE' });
    expect(res.status).toBe(409);
  });

  test('quotation: confirming after the template validity has passed → 409', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const { prisma } = require('./helpers');
    const tmpl = await prisma.quoteTemplate.create({
      data: { name: 'Quick quote', planId: pausablePlan.id, validityDays: 7, lines: [{ productId: product.id, qty: 1 }] },
    });
    const subRes = await request(app).post('/api/subscriptions').set(auth)
      .send({ customerId: customer.customerId, templateId: tmpl.id });
    expect(subRes.status).toBe(201);
    expect(subRes.body.quoteValidUntil).toBeTruthy();
    await request(app).post(`/api/subscriptions/${subRes.body.id}/transition`).set(auth).send({ to: 'QUOTATION' });

    // Pretend 8 days have passed
    await prisma.subscription.update({
      where: { id: subRes.body.id },
      data: { quoteValidUntil: new Date(Date.now() - 86400000) },
    });
    const res = await request(app).post(`/api/subscriptions/${subRes.body.id}/transition`).set(auth).send({ to: 'CONFIRMED' });
    expect(res.status).toBe(409);
  });

  test('plan availability: subscription starting outside the plan dates → 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const windowed = await createPlan({
      name: 'Summer Plan',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-08-31T00:00:00Z'),
    });
    const make = (startDate) => request(app).post('/api/subscriptions').set(auth).send({
      customerId: customer.customerId, planId: windowed.id, startDate, lines: [{ productId: product.id, qty: 1 }],
    });
    expect((await make('2026-05-31')).status).toBe(400);
    expect((await make('2026-09-01')).status).toBe(400);
    expect((await make('2026-07-01')).status).toBe(201);
  });

  test('subscription: expiry date must be after the start date → 400', async () => {
    const res = await request(app).post('/api/subscriptions').set({ Authorization: `Bearer ${adminToken}` }).send({
      customerId: customer.customerId, planId: pausablePlan.id, startDate: '2026-07-01', expiryDate: '2026-06-01',
      lines: [{ productId: product.id, qty: 1 }],
    });
    expect(res.status).toBe(400);
  });
});
