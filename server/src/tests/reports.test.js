'use strict';

const request = require('supertest');
const { resetDb, createUser, createPlan, createProduct, createSubscription, createInvoice, prisma } =
  require('./helpers');
const app = require('../app');

const DAY = 86400000;
const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0));
const isoDay = (d) => d.toISOString().slice(0, 10);

describe('reports', () => {
  let adminToken;
  let monthly;
  let dueToday;
  let dueYesterday;

  beforeAll(async () => {
    await resetDb();
    adminToken = (await createUser({ email: 'admin@reports.test', role: 'ADMIN' })).token;
    const cust = await createUser({ email: 'cust@reports.test', role: 'PORTAL' });
    const customerId = cust.user.customerId;
    const product = await createProduct();

    monthly = await createPlan({ name: 'Monthly', period: 'MONTHLY' });
    const yearly = await createPlan({ name: 'Yearly', period: 'YEARLY' });
    const line = (amount) => [{ productId: product.id, qty: 1, unitPrice: amount, amount }];

    // MRR: 100 (monthly) + 1200/12 (yearly) = 200.00; paused sub excluded
    const s1 = await createSubscription({ customerId, planId: monthly.id, lines: line('100.00') });
    const s2 = await createSubscription({ customerId, planId: yearly.id, lines: line('1200.00') });
    await createSubscription({ customerId, planId: monthly.id, status: 'PAUSED', lines: line('999.00') });

    // Outstanding (CONFIRMED): 200 + 50 + 80 = 330.00 · Overdue: 200 + 80 = 280.00
    dueYesterday = await createInvoice({
      subscription: s1, total: '300.00', amountPaid: '100.00', dueDate: new Date(todayStart - 3600000),
    });
    dueToday = await createInvoice({
      subscription: s1, total: '50.00', dueDate: new Date(todayStart.getTime() + 12 * 3600000),
    });
    const paid = await createInvoice({ subscription: s2, total: '1200.00', amountPaid: '1200.00', status: 'PAID' });
    await createInvoice({ subscription: s2, total: '80.00', dueDate: new Date(todayStart - 10 * DAY) });
    await createInvoice({ subscription: s1, total: '999.00', status: 'CANCELLED', dueDate: new Date(todayStart - 5 * DAY) });
    await createInvoice({ subscription: s1, total: '40.00', status: 'DRAFT', dueDate: new Date(todayStart - 5 * DAY) });

    // Revenue: 100.00 today + 1200.00 on 2026-01-15 = 1300.00
    await prisma.payment.create({ data: { invoiceId: dueYesterday.id, amount: '100.00', date: new Date() } });
    await prisma.payment.create({ data: { invoiceId: paid.id, amount: '1200.00', date: new Date('2026-01-15T10:00:00Z') } });
  });

  const get = (path) => request(app).get(path).set('Authorization', `Bearer ${adminToken}`);

  test('overdue: due today is not overdue; due yesterday is', async () => {
    const res = await get('/api/reports/overdue');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.id);
    expect(ids).toContain(dueYesterday.id);
    expect(ids).not.toContain(dueToday.id);

    const row = res.body.data.find((r) => r.id === dueYesterday.id);
    expect(row.daysOverdue).toBe(1);
    expect(row.outstanding).toBe('200.00');
  });

  test('dashboard: KPIs on fixed fixture equal hand-calculated values', async () => {
    const res = await get('/api/reports/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.activeSubscriptions).toBe(2);
    expect(res.body.revenueCollected).toBe('1300.00');
    expect(res.body.outstanding).toEqual({ count: 3, amount: '330.00' });
    expect(res.body.overdue).toEqual({ count: 2, amount: '280.00' });
    expect(res.body.mrr).toBe('200.00');

    const confirmed = res.body.invoicesByStatus.find((r) => r.status === 'CONFIRMED');
    expect(confirmed).toEqual({ status: 'CONFIRMED', count: 3, total: '430.00', paid: '100.00', outstanding: '330.00' });
  });

  test('dashboard: plan and date filters narrow the KPIs', async () => {
    const byPlan = await get(`/api/reports/dashboard?planId=${monthly.id}`);
    expect(byPlan.body.activeSubscriptions).toBe(1);
    expect(byPlan.body.mrr).toBe('100.00');
    expect(byPlan.body.revenueCollected).toBe('100.00');
    expect(byPlan.body.outstanding).toEqual({ count: 2, amount: '250.00' });
    expect(byPlan.body.overdue).toEqual({ count: 1, amount: '200.00' });

    const today = isoDay(new Date());
    const byDate = await get(`/api/reports/dashboard?from=${today}&to=${today}`);
    expect(byDate.body.revenueCollected).toBe('100.00');

    const byStatus = await get('/api/reports/dashboard?status=paid');
    expect(byStatus.body.invoicesByStatus).toEqual([
      { status: 'PAID', count: 1, total: '1200.00', paid: '1200.00', outstanding: '0.00' },
    ]);
  });

  test('reports: PORTAL → 403', async () => {
    const { token } = await createUser({ email: 'p2@reports.test', role: 'PORTAL' });
    const res = await request(app).get('/api/reports/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
