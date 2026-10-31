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
  test('totals: subscription-level discount is applied before tax, to the cent', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const prodA = await prisma.product.create({ data: { name: 'Seat', salesPrice: 33.33 } });
    const prodB = await prisma.product.create({ data: { name: 'Storage', salesPrice: 50.00 } });
    const prodC = await prisma.product.create({ data: { name: 'CRM Odoo', salesPrice: 1760.00 } });
    // Created first, so it wins when both apply (qty >= 5)
    await prisma.discount.create({
      data: { name: '10% min qty 5', type: 'PERCENT', value: 10.00, minQty: 5, scope: 'SUBSCRIPTION' },
    });
    await prisma.discount.create({
      data: { name: '10 off', type: 'FIXED', value: 10.00, scope: 'SUBSCRIPTION' },
    });

    async function billedInvoice(lines) {
      const subRes = await request(app).post('/api/subscriptions').set(auth).send({
        customerId: customer.customerId, planId: plan.id, startDate: '2026-05-01T00:00:00Z', lines,
      });
      expect(subRes.status).toBe(201);
      for (const to of ['QUOTATION', 'CONFIRMED', 'ACTIVE']) {
        await request(app).post(`/api/subscriptions/${subRes.body.id}/transition`).set(auth).send({ to });
      }
      await request(app).post('/api/billing/run').set(auth).send({ date: '2026-05-10T00:00:00Z' });
      const invRes = await request(app).get(`/api/invoices?subscriptionId=${subRes.body.id}`).set(auth);
      return invRes.body.data[0];
    }

    // 10% on 5 x 1760.00 = 8800.00 -> 880.00 off -> tax 18% of 7920.00 = 1425.60 -> 9345.60
    const pct = await billedInvoice([{ productId: prodC.id, qty: 5, taxId: tax18.id }]);
    expect(pct.subtotal).toBe('8800.00');
    expect(pct.discountTotal).toBe('880.00');
    expect(pct.taxTotal).toBe('1425.60');
    expect(pct.total).toBe('9345.60');

    // Fixed 10.00 split pro rata over net 149.99:
    //   Seat    3 x 33.33 = 99.99 -> share 6.67 -> 93.32 x 18% = 16.80
    //   Storage 1 x 50.00 = 50.00 -> share 3.33 -> 46.67 x  9% =  4.20
    // 149.99 - 10.00 + 21.00 = 160.99
    const fixed = await billedInvoice([
      { productId: prodA.id, qty: 3, taxId: tax18.id },
      { productId: prodB.id, qty: 1, taxId: tax9.id },
    ]);
    expect(fixed.subtotal).toBe('149.99');
    expect(fixed.discountTotal).toBe('10.00');
    expect(fixed.taxTotal).toBe('21.00');
    expect(fixed.total).toBe('160.99');
    const byDesc = Object.fromEntries(fixed.lines.map((l) => [l.description, l]));
    expect(byDesc.Seat).toMatchObject({ discount: '6.67', tax: '16.80', amount: '93.32' });
    expect(byDesc.Storage).toMatchObject({ discount: '3.33', tax: '4.20', amount: '46.67' });
  });
});
