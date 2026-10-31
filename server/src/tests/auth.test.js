'use strict';
/**
 * auth.test.js — Stage 1 test gate
 *
 * Covers every rule named in plan.md §4:
 *   password rule: rejects 8 chars / no upper / no lower / no special; accepts valid
 *   signup: duplicate email (different case) → 409
 *   reset: token works once, then fails; expired token fails
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const request = require('supertest');
const app     = require('../app');
const { prisma, resetDb } = require('./helpers');

// Wipe DB once before this file runs
beforeAll(() => resetDb());

// ─── password rule ────────────────────────────────────────────────────────────

describe('password rule', () => {
  // Use a unique email per test so earlier passes don't cause 409
  const email = (n) => `pwtest${n}@example.com`;
  const name  = 'PW Test';

  test('rejects 8 chars (exactly 8 — must be > 8)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: email(1), password: 'Ab@12345' }); // exactly 8
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/longer than 8/i);
  });

  test('rejects no uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: email(2), password: 'ab@123456' }); // 9 chars, no upper
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uppercase/i);
  });

  test('rejects no lowercase', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: email(3), password: 'AB@123456' }); // 9 chars, no lower
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lowercase/i);
  });

  test('rejects no special character', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: email(4), password: 'Abcdefghi1' }); // 10 chars, no special
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/special/i);
  });

  test('accepts valid password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: email(5), password: 'Valid@Pass1' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });
});

// ─── signup: duplicate email (different case) → 409 ──────────────────────────

describe('signup: duplicate email', () => {
  const dupEmail = 'dup-case@example.com';

  // Register once
  beforeAll(() =>
    request(app)
      .post('/api/auth/signup')
      .send({ name: 'Original', email: dupEmail, password: 'Valid@Pass1' })
  );

  test('duplicate email (exact) → 409', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Copy', email: dupEmail, password: 'Valid@Pass1' });
    expect(res.status).toBe(409);
  });

  test('duplicate email (different case: uppercase) → 409', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Copy2', email: dupEmail.toUpperCase(), password: 'Valid@Pass1' });
    expect(res.status).toBe(409);
  });

  test('duplicate email (mixed case) → 409', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Copy3', email: 'DUP-CASE@Example.COM', password: 'Valid@Pass1' });
    expect(res.status).toBe(409);
  });
});

// ─── reset: token works once, then fails; expired token fails ─────────────────

describe('reset: token lifecycle', () => {
  const resetEmail = 'reset-lifecycle@example.com';
  let resetToken;

  beforeAll(async () => {
    // Create the user
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Reset User', email: resetEmail, password: 'Valid@Pass1' });

    // Trigger forgot — token is written to DB
    await request(app)
      .post('/api/auth/forgot')
      .send({ email: resetEmail });

    // Read token directly from DB (console log is the "email")
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    resetToken = user?.resetToken;
  });

  test('forgot: token is stored in DB and not yet expired', async () => {
    expect(resetToken).toBeTruthy();
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user.resetExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test('reset: valid token changes password (works once)', async () => {
    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: resetToken, password: 'Changed@Pass99' });
    expect(res.status).toBe(200);

    // Confirm new password works for login
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: 'Changed@Pass99' });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
  });

  test('reset: same token fails the second time (single-use)', async () => {
    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: resetToken, password: 'AnotherValid@Pass2' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/i);
  });

  test('reset: expired token fails', async () => {
    // Register a fresh user and set an already-expired token directly in DB
    const expiredEmail = 'expired-reset@example.com';
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Expired User', email: expiredEmail, password: 'Valid@Pass1' });

    const expiredToken = 'expired-token-abc123def456expired';
    const pastDate     = new Date(Date.now() - 60 * 1000); // 1 minute ago

    await prisma.user.update({
      where: { email: expiredEmail },
      data:  { resetToken: expiredToken, resetExpires: pastDate },
    });

    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: expiredToken, password: 'NewValid@Pass9' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/i);
  });
});
