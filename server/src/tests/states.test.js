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
});
