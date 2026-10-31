'use strict';
/**
 * roles.test.js — Stage 1 test gate
 *
 * Covers:
 *   roles: INTERNAL creating staff → 403
 *   roles: PORTAL on POST /api/products → 403
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const request = require('supertest');
const app     = require('../app');
const { prisma, resetDb, createUser } = require('./helpers');

let adminToken, internalToken, portalToken;

beforeAll(async () => {
  await resetDb();
  ({ token: adminToken }    = await createUser({ email: 'admin@roles.test',    role: 'ADMIN' }));
  ({ token: internalToken } = await createUser({ email: 'internal@roles.test', role: 'INTERNAL' }));
  ({ token: portalToken }   = await createUser({ email: 'portal@roles.test',   role: 'PORTAL' }));
});

// ─── INTERNAL creating staff → 403 ───────────────────────────────────────────

describe('roles: POST /api/users', () => {
  test('INTERNAL creating staff → 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${internalToken}`)
      .send({ name: 'Hacker', email: 'hacker@test.com', password: 'Valid@Pass1' });
    expect(res.status).toBe(403);
  });

  test('PORTAL creating staff → 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ name: 'Hacker', email: 'hacker2@test.com', password: 'Valid@Pass1' });
    expect(res.status).toBe(403);
  });

  test('ADMIN creating staff → 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Staff', email: 'newstaff@roles.test', password: 'Valid@Pass1', role: 'INTERNAL' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('INTERNAL');
  });

  test('unauthenticated → 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

// ─── PORTAL on POST /api/products → 403 ──────────────────────────────────────

describe('roles: POST /api/products', () => {
  test('PORTAL on POST /api/products → 403', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ name: 'Exploit', salesPrice: 0 });
    expect(res.status).toBe(403);
  });

  test('INTERNAL on POST /api/products → 403 (read-only)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${internalToken}`)
      .send({ name: 'Exploit', salesPrice: 0 });
    expect(res.status).toBe(403);
  });

  test('INTERNAL can read products (GET → 200)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${internalToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

// ─── PORTAL cannot read admin resources ───────────────────────────────────────

describe('roles: PORTAL access to admin resources', () => {
  test('PORTAL on GET /api/customers → 403', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(403);
  });

  test('PORTAL on GET /api/users → 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(403);
  });
});
