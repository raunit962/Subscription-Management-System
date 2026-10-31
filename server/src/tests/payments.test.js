'use strict';

const request = require('supertest');
const { resetDb, createUser, createPlan, createSubscription, createInvoice, prisma } = require('./helpers');
const app = require('../app');

describe('payments', () => {
  let staffToken;
  let subscription;

  beforeAll(async () => {
    await resetDb();
    staffToken = (await createUser({ email: 'staff@payments.test', role: 'INTERNAL' })).token;
    const portal = await createUser({ email: 'cust@payments.test', role: 'PORTAL' });
    const plan = await createPlan();
    subscription = await createSubscription({ customerId: portal.user.customerId, planId: plan.id });
  });

  const pay = (body) =>
    request(app).post('/api/payments').set('Authorization', `Bearer ${staffToken}`).send(body);

  test('payments: overpayment rejected', async () => {
    const inv = await createInvoice({ subscription, total: '100.00' });
    const res = await pay({ invoiceId: inv.id, amount: '100.01' });
    expect(res.status).toBe(400);

    const after = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(after.amountPaid.toFixed(2)).toBe('0.00');
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(0);
  });

  test('payments: partial then full → PAID', async () => {
    const inv = await createInvoice({ subscription, total: '250.50' });

    const partial = await pay({ invoiceId: inv.id, amount: '100.25', method: 'card' });
    expect(partial.status).toBe(201);
    expect(partial.body.invoice.status).toBe('CONFIRMED');
    expect(partial.body.invoice.outstanding).toBe('150.25');

    // Second payment larger than what's left is still an overpayment
    expect((await pay({ invoiceId: inv.id, amount: '150.26' })).status).toBe(400);

    const full = await pay({ invoiceId: inv.id, amount: '150.25' });
    expect(full.status).toBe(201);
    expect(full.body.invoice.status).toBe('PAID');
    expect(full.body.invoice.amountPaid).toBe('250.50');

    // Nothing more can be paid on a PAID invoice
    expect((await pay({ invoiceId: inv.id, amount: '1' })).status).toBe(409);
  });

  test('payments: payment on DRAFT rejected', async () => {
    const inv = await createInvoice({ subscription, total: '50.00', status: 'DRAFT' });
    expect((await pay({ invoiceId: inv.id, amount: '10' })).status).toBe(409);
  });

  test('payments: payment on CANCELLED rejected', async () => {
    const inv = await createInvoice({ subscription, total: '50.00', status: 'CANCELLED' });
    expect((await pay({ invoiceId: inv.id, amount: '10' })).status).toBe(409);
  });

  test('payments: zero or negative amount rejected', async () => {
    const inv = await createInvoice({ subscription, total: '50.00' });
    expect((await pay({ invoiceId: inv.id, amount: 0 })).status).toBe(400);
    expect((await pay({ invoiceId: inv.id, amount: '-5' })).status).toBe(400);
  });

  test('payments: PORTAL cannot record payments', async () => {
    const { token } = await createUser({ email: 'other@payments.test', role: 'PORTAL' });
    const inv = await createInvoice({ subscription, total: '50.00' });
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoiceId: inv.id, amount: '10' });
    expect(res.status).toBe(403);
  });
});
