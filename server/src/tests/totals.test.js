'use strict';

const request = require('supertest');
const app = require('../app');
const { resetDb, createUser, createPlan, prisma } = require('./helpers');

describe('totals: precision monetary calculations', () => {
  let adminToken;
  let customer;
  let plan;
  let prod1;
  let prod2;
  let tax18;
  let tax9;

  beforeAll(async () => {
    await resetDb();
    const admin = await createUser({ email: 'admin@totals.test', role: 'ADMIN' });
    adminToken = admin.token;

    const portal = await createUser({ email: 'client@totals.test', role: 'PORTAL' });
    customer = await portal.user;

    plan = await createPlan({ name: 'Totals Plan', period: 'MONTHLY' });

    // Product 1: CRM with Odoo variant (+560)
    prod1 = await prisma.product.create({
      data: {
        name: 'Enterprise Suite',
        salesPrice: 1200.00,
        attributeValues: {
          create: [{ attribute: 'Brand', value: 'Odoo', extraPrice: 560.00 }],
        },
      },
      include: { attributeValues: true },
    });

    // Product 2: Addon
    prod2 = await prisma.product.create({
      data: {
        name: 'Database Backup',
        salesPrice: 300.00,
      },
    });

    tax18 = await prisma.tax.create({ data: { name: 'GST 18%', percent: 18.00 } });
    tax9 = await prisma.tax.create({ data: { name: 'VAT 9%', percent: 9.00 } });

    // 10% discount on Product 1
    await prisma.discount.create({
      data: {
        name: '10% on Suite',
        type: 'PERCENT',
        value: 10.00,
        scope: 'PRODUCT',
        productId: prod1.id,
      },
    });
  });

  test('totals: fixture invoice subtotal, discount, tax, total match hand-calculated values to the cent', async () => {
    // Create subscription:
    // Line 1: 2 x (1200 + 560) = 2 x 1760.00 = 3520.00. Tax: 18%. Disc: 10% (352.00) -> Net: 3168.00 -> Tax: 570.24
    // Line 2: 3 x 300.00 = 900.00. Tax: 9% (81.00) -> Net: 900.00 -> Tax: 81.00
    // Subtotal: 3520.00 + 900.00 = 4420.00
    // DiscountTotal: 352.00
    // TaxTotal: 570.24 + 81.00 = 651.24
    // Total: 4420.00 - 352.00 + 651.24 = 4719.24
    const subRes = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.customerId,
        planId: plan.id,
        startDate: '2026-05-01T00:00:00Z',
        lines: [
          {
            productId: prod1.id,
            attributeValueId: prod1.attributeValues[0].id,
            qty: 2,
            taxId: tax18.id,
          },
          {
            productId: prod2.id,
            qty: 3,
            taxId: tax9.id,
          },
        ],
      });
    expect(subRes.status).toBe(201);
    const subId = subRes.body.id;

    // Activate subscription
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'QUOTATION' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'CONFIRMED' });
    await request(app).post(`/api/subscriptions/${subId}/transition`).set('Authorization', `Bearer ${adminToken}`).send({ to: 'ACTIVE' });

    // Generate invoice via billing run
    const runRes = await request(app)
      .post('/api/billing/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-05-10T00:00:00Z' });
    expect(runRes.status).toBe(200);

    const invRes = await request(app)
      .get(`/api/invoices?subscriptionId=${subId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invRes.body.data).toHaveLength(1);

    const inv = invRes.body.data[0];
    expect(inv.subtotal).toBe('4420.00');
    expect(inv.discountTotal).toBe('352.00');
    expect(inv.taxTotal).toBe('651.24');
    expect(inv.total).toBe('4719.24');
  });
});
