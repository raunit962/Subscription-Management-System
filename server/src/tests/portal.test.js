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

  test('portal: customer pauses and resumes own subscription; other customer → 404', async () => {
    const { prisma } = require('./helpers');
    const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${tokenA}`).send(body);

    expect((await post(`/api/portal/subscriptions/${subB.id}/transition`, { to: 'PAUSED' })).status).toBe(404);
    expect((await prisma.subscription.findUnique({ where: { id: subB.id } })).status).toBe('ACTIVE');

    const paused = await post(`/api/portal/subscriptions/${subA.id}/transition`, { to: 'PAUSED' });
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe('PAUSED');
    const resumed = await post(`/api/portal/subscriptions/${subA.id}/transition`, { to: 'ACTIVE' });
    expect(resumed.body.status).toBe('ACTIVE');
  });

  test('portal: plan rules still apply and customers cannot activate', async () => {
    const { prisma } = require('./helpers');
    const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${tokenA}`).send(body);
    const strict = await createPlan({ name: 'Strict', pausable: false, closable: false, renewable: false });
    const s1 = await createSubscription({ customerId: subA.customerId, planId: strict.id });
    expect((await post(`/api/portal/subscriptions/${s1.id}/transition`, { to: 'PAUSED' })).status).toBe(409);
    expect((await post(`/api/portal/subscriptions/${s1.id}/transition`, { to: 'CLOSED' })).status).toBe(409);
    expect((await post(`/api/portal/subscriptions/${s1.id}/renew`)).status).toBe(409);

    const confirmed = await createSubscription({ customerId: subA.customerId, planId: strict.id, status: 'CONFIRMED' });
    expect((await post(`/api/portal/subscriptions/${confirmed.id}/transition`, { to: 'ACTIVE' })).status).toBe(409);
    expect((await prisma.subscription.findUnique({ where: { id: confirmed.id } })).status).toBe('CONFIRMED');
  });

  test('portal: renew extends expiry by one period; open-ended subscription → 409', async () => {
    const { prisma } = require('./helpers');
    const post = (path) => request(app).post(path).set('Authorization', `Bearer ${tokenA}`).send({});
    const plan = await createPlan({ name: 'Renewable monthly', period: 'MONTHLY', renewable: true });
    const open = await createSubscription({ customerId: subA.customerId, planId: plan.id });
    expect((await post(`/api/portal/subscriptions/${open.id}/renew`)).status).toBe(409);

    const dated = await createSubscription({ customerId: subA.customerId, planId: plan.id });
    await prisma.subscription.update({ where: { id: dated.id }, data: { expiryDate: new Date('2027-03-31T00:00:00Z') } });
    const res = await post(`/api/portal/subscriptions/${dated.id}/renew`);
    expect(res.status).toBe(200);
    expect(res.body.expiryDate.slice(0, 10)).toBe('2027-04-30');
  });
});
