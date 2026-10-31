'use strict';

// Runs against the DEV database after `SEED_SIZE=large npm run seed`.
// Skipped unless PERF=1:  PERF=1 npm test -- perf
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const request = require('supertest');

const run = process.env.PERF === '1' ? describe : describe.skip;

run('perf: large seed responds < 2s', () => {
  let app;
  let token;

  beforeAll(async () => {
    app = require('../app');
    const prisma = require('../lib/prisma');
    const { signToken } = require('../lib/auth');
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    token = signToken(admin);
    const subs = await prisma.subscription.count();
    if (subs < 5000) throw new Error(`Expected ≥5000 subscriptions, found ${subs}. Run SEED_SIZE=large npm run seed.`);
  });

  const timed = async (path) => {
    const start = Date.now();
    const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    const ms = Date.now() - start;
    console.log(`${path} → ${res.status} in ${ms}ms`);
    expect(res.status).toBe(200);
    return ms;
  };

  test.each([
    '/api/subscriptions?page=1&pageSize=100',
    '/api/subscriptions?page=40&pageSize=100&status=ACTIVE',
    '/api/invoices?page=1&pageSize=100',
    '/api/invoices?page=50&pageSize=100&status=CONFIRMED',
    '/api/reports/dashboard',
    '/api/reports/dashboard?planId=2&status=PAID',
    '/api/reports/overdue?pageSize=100',
  ])('perf: %s < 2s', async (path) => {
    expect(await timed(path)).toBeLessThan(2000);
  });
});
