'use strict';
/**
 * products.test.js — Stage 1 test gate
 *
 * Covers:
 *   variant price: Brand Odoo adds 560
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const request = require('supertest');
const app     = require('../app');
const { prisma, resetDb, createUser } = require('./helpers');

let adminToken, internalToken, portalToken;
let productId; // shared across tests in the variant describe

beforeAll(async () => {
  await resetDb();
  ({ token: adminToken }    = await createUser({ email: 'admin@products.test',    role: 'ADMIN' }));
  ({ token: internalToken } = await createUser({ email: 'internal@products.test', role: 'INTERNAL' }));
  ({ token: portalToken }   = await createUser({ email: 'portal@products.test',   role: 'PORTAL' }));
});

// ─── variant price: Brand Odoo adds 560 ──────────────────────────────────────

describe('variant price: Brand Odoo adds 560', () => {
  test('ADMIN creates CRM product with Brand: Odoo (+560) and Generic (+0)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:       'CRM Software',
        type:       'service',
        salesPrice: 1200,
        costPrice:  400,
        attributeValues: [
          { attribute: 'Brand', value: 'Odoo',    extraPrice: 560 },
          { attribute: 'Brand', value: 'Generic', extraPrice: 0   },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('CRM Software');
    expect(res.body.salesPrice).toBe('1200.00');
    expect(res.body.attributeValues).toHaveLength(2);
    productId = res.body.id;
  });

  test('variant price: Odoo adds 560 → variantPrice = 1760.00', async () => {
    expect(productId).toBeDefined(); // guard: previous test must have passed
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const odoo = res.body.attributeValues.find((av) => av.value === 'Odoo');
    expect(odoo).toBeDefined();
    expect(odoo.extraPrice).toBe('560.00');
    expect(odoo.variantPrice).toBe('1760.00'); // 1200 + 560
  });

  test('variant price: Generic adds 0 → variantPrice = 1200.00', async () => {
    expect(productId).toBeDefined();
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const generic = res.body.attributeValues.find((av) => av.value === 'Generic');
    expect(generic).toBeDefined();
    expect(generic.extraPrice).toBe('0.00');
    expect(generic.variantPrice).toBe('1200.00'); // 1200 + 0
  });

  test('variant price is returned as a decimal string (not JS float)', async () => {
    expect(productId).toBeDefined();
    const res = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const odoo = res.body.attributeValues.find((av) => av.value === 'Odoo');
    // Must be string "1760.00", never number 1760
    expect(typeof odoo.variantPrice).toBe('string');
    expect(typeof odoo.extraPrice).toBe('string');
    expect(typeof res.body.salesPrice).toBe('string');
  });

  test('adding a new variant via POST /api/products/:id/attributes → correct price', async () => {
    expect(productId).toBeDefined();
    const res = await request(app)
      .post(`/api/products/${productId}/attributes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attribute: 'Brand', value: 'Custom', extraPrice: 250 });

    expect(res.status).toBe(201);
    // 1200 + 250 = 1450.00
    expect(res.body.variantPrice).toBe('1450.00');
    expect(res.body.extraPrice).toBe('250.00');
  });

  test('duplicate attribute value → 409', async () => {
    expect(productId).toBeDefined();
    const res = await request(app)
      .post(`/api/products/${productId}/attributes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attribute: 'Brand', value: 'Odoo', extraPrice: 999 });
    expect(res.status).toBe(409);
  });
});

// ─── Role guards on products ──────────────────────────────────────────────────

describe('products: role guards', () => {
  test('PORTAL cannot create product → 403', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ name: 'X', salesPrice: 1 });
    expect(res.status).toBe(403);
  });

  test('INTERNAL can list products → 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${internalToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pageSize');
  });

  test('unauthenticated cannot list products → 401', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});

// ─── Plans ────────────────────────────────────────────────────────────────────

describe('plans: CRUD + role guards', () => {
  test('ADMIN creates monthly plan → 201, price as decimal string', async () => {
    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Monthly Pro', price: 99, period: 'MONTHLY', pausable: true });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe('99.00');
    expect(typeof res.body.price).toBe('string');
  });

  test('invalid period → 400', async () => {
    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', price: 9, period: 'HOURLY' });
    expect(res.status).toBe(400);
  });

  test('PORTAL cannot create plan → 403', async () => {
    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ name: 'X', price: 1, period: 'MONTHLY' });
    expect(res.status).toBe(403);
  });

  test('INTERNAL can read plans → 200', async () => {
    const res = await request(app)
      .get('/api/plans')
      .set('Authorization', `Bearer ${internalToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── Taxes ────────────────────────────────────────────────────────────────────

describe('taxes: CRUD + validation', () => {
  test('ADMIN creates tax → 201, percent as decimal string', async () => {
    const res = await request(app)
      .post('/api/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'GST 18%', percent: 18 });
    expect(res.status).toBe(201);
    expect(res.body.percent).toBe('18.00');
    expect(typeof res.body.percent).toBe('string');
  });

  test('percent > 100 → 400', async () => {
    const res = await request(app)
      .post('/api/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', percent: 150 });
    expect(res.status).toBe(400);
  });
});

// ─── Payment Terms ────────────────────────────────────────────────────────────

describe('payment terms: CRUD + validation', () => {
  test('ADMIN creates payment term → 201', async () => {
    const res = await request(app)
      .post('/api/payment-terms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Net 30', dueDays: 30 });
    expect(res.status).toBe(201);
    expect(res.body.dueDays).toBe(30);
  });

  test('negative dueDays → 400', async () => {
    const res = await request(app)
      .post('/api/payment-terms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', dueDays: -1 });
    expect(res.status).toBe(400);
  });
});
