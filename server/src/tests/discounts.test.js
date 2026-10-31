'use strict';

const request = require('supertest');
const app = require('../app');
const { resetDb, createUser, createPlan, createProduct, prisma } = require('./helpers');

describe('discounts: limits, applicability and expiration', () => {
  let adminToken;
  let customer;
  let plan;
  let product;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ email: 'admin@discounts.test', role: 'ADMIN' });
    adminToken = admin.token;

    const portal = await createUser({ email: 'client@discounts.test', role: 'PORTAL' });
    customer = await portal.user;

    plan = await createPlan({ name: 'Discount Test Plan', price: 100.00 });
    product = await createProduct({ name: 'App License', salesPrice: 200.00 });
  });

  test('discount: usage limit 1 with 2 subscriptions billed → applied once; expired discount not applied', async () => {
    // 1. Create a discount with usageLimit = 1
    const discRes = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Single Use 15%',
        type: 'PERCENT',
        value: 15.00,
        scope: 'SUBSCRIPTION',
        usageLimit: 1,
      });
    expect(discRes.status).toBe(201);
    const discId = discRes.body.id;

    // 2. Create 2 active subscriptions
    const sub1Res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: plan.id,
        startDate: '2026-02-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const sub1Id = sub1Res.body.id;

    const sub2Res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: plan.id,
        startDate: '2026-02-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const sub2Id = sub2Res.body.id;

    // Activate both
    for (const id of [sub1Id, sub2Id]) {
      await request(app).post(`/api/subscriptions/${id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
      await request(app).post(`/api/subscriptions/${id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
      await request(app).post(`/api/subscriptions/${id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });
    }

    // 3. Run billing
    const billingRun = await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-02-15T00:00:00Z' });
    expect(billingRun.status).toBe(200);
    expect(billingRun.body.createdCount).toBe(2);

    // Fetch invoices for both subs
    const inv1Res = await request(app).get(`/api/invoices?subscriptionId=${sub1Id}`).set('Authorization', `Bearer ${adminToken}`);
    const inv2Res = await request(app).get(`/api/invoices?subscriptionId=${sub2Id}`).set('Authorization', `Bearer ${adminToken}`);

    const inv1 = inv1Res.body.data[0];
    const inv2 = inv2Res.body.data[0];

    // One invoice received the 15% discount (30.00), the other received 0.00
    const discountsApplied = [parseFloat(inv1.discountTotal), parseFloat(inv2.discountTotal)];
    expect(discountsApplied).toContain(30.00);
    expect(discountsApplied).toContain(0.00);

    // Verify discount usage count in DB is 1
    const updatedDisc = await prisma.discount.findUnique({ where: { id: discId } });
    expect(updatedDisc.usageCount).toBe(1);

    // 4. Test expired discount
    await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Expired 50%',
        type: 'PERCENT',
        value: 50.00,
        scope: 'SUBSCRIPTION',
        endDate: '2024-01-01T00:00:00Z',
      });

    // Create and activate sub starting in 2026
    const sub3Res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: plan.id,
        startDate: '2026-03-01T00:00:00Z',
        lines: [{ productId: product.id, qty: 1 }],
      });
    const sub3Id = sub3Res.body.id;
    await request(app).post(`/api/subscriptions/${sub3Id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${sub3Id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${sub3Id}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });

    await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-03-15T00:00:00Z' });

    const inv3Res = await request(app).get(`/api/invoices?subscriptionId=${sub3Id}`).set('Authorization', `Bearer ${adminToken}`);
    const inv3 = inv3Res.body.data[0];
    expect(parseFloat(inv3.discountTotal)).toBe(0.00);
  });
});
