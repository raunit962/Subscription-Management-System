'use strict';

const request = require('supertest');
const { resetDb, createUser, createPlan, createSubscription, createInvoice } = require('./helpers');
const app = require('../app');

describe('portal: customer isolation', () => {
  let tokenA;
  let subA;
  let subB;
  let invA;
  let invB;

  beforeAll(async () => {
    await resetDb();
    const a = await createUser({ email: 'a@portal.test', role: 'PORTAL', name: 'Customer A' });
    const b = await createUser({ email: 'b@portal.test', role: 'PORTAL', name: 'Customer B' });
    tokenA = a.token;
    const plan = await createPlan();
    subA = await createSubscription({ customerId: a.user.customerId, planId: plan.id });
    subB = await createSubscription({ customerId: b.user.customerId, planId: plan.id });
    invA = await createInvoice({ subscription: subA, total: '10.00' });
    invB = await createInvoice({ subscription: subB, total: '20.00' });
  });

  const get = (path) => request(app).get(path).set('Authorization', `Bearer ${tokenA}`);

  test("portal: customer A reading customer B's invoice → 404", async () => {
    expect((await get(`/api/portal/invoices/${invB.id}`)).status).toBe(404);
    expect((await get(`/api/portal/invoices/${invA.id}`)).status).toBe(200);
  });

  test("portal: customer A reading customer B's subscription → 404", async () => {
    expect((await get(`/api/portal/subscriptions/${subB.id}`)).status).toBe(404);
    expect((await get(`/api/portal/subscriptions/${subA.id}`)).status).toBe(200);
  });

  test('portal: lists only contain own records, ignoring customerId in the query', async () => {
    const subs = await get(`/api/portal/subscriptions?customerId=${subB.customerId}`);
    expect(subs.body.data.map((s) => s.id)).toEqual([subA.id]);

    const invs = await get(`/api/portal/invoices?customerId=${subB.customerId}`);
    expect(invs.body.data.map((i) => i.id)).toEqual([invA.id]);
  });

  test('portal: DRAFT invoices are hidden from the customer', async () => {
    const draft = await createInvoice({ subscription: subA, total: '5.00', status: 'DRAFT' });
    expect((await get(`/api/portal/invoices/${draft.id}`)).status).toBe(404);
  });

  test('portal: staff token on portal routes → 403', async () => {
    const { token } = await createUser({ email: 'staff@portal.test', role: 'INTERNAL' });
    const res = await request(app).get('/api/portal/invoices').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
