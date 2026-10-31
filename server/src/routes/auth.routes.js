'use strict';

const { Router } = require('express');
const prisma      = require('../lib/prisma');
const {
  validatePassword,
  hashPassword,
  comparePassword,
  signToken,
  requireAuth,
  generateResetToken,
} = require('../lib/auth');
const { HttpError } = require('../lib/errors');

const router = Router();

// ─── POST /api/auth/signup ──────────────────────────────────────────────────
// Creates a PORTAL user + linked Customer. Email is lowercased before save.
// Returns 409 on duplicate email.

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      throw new HttpError(400, 'name, email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    validatePassword(password); // throws 400 on failure

    // Duplicate check (covers case-insensitive duplicates via lowercasing)
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await hashPassword(password);

    // Create Customer + User in one transaction
    const user = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name,
          email: normalizedEmail,
          phone: phone || null,
        },
      });
      return tx.user.create({
        data: {
          email:      normalizedEmail,
          passwordHash,
          name,
          role:       'PORTAL',
          customerId: customer.id,
        },
      });
    });

    const token = signToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    // Prisma unique constraint on email → return 409 instead of 500
    if (err.code === 'P2002') {
      return next(new HttpError(409, 'An account with this email already exists.'));
    }
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'email and password are required.');

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Use the same generic message for not-found and wrong-password (security)
    if (!user) throw new HttpError(401, 'Invalid email or password.');

    const match = await comparePassword(password, user.passwordHash);
    if (!match) throw new HttpError(401, 'Invalid email or password.');

    const token = signToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, customerId: true, createdAt: true },
    });
    if (!user) throw new HttpError(404, 'User not found.');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/forgot ───────────────────────────────────────────────────
// Generates a single-use reset token valid for 30 min.
// Logs the reset link to the server console (no real email).

router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new HttpError(400, 'email is required.');

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always return 200 to avoid user enumeration
    if (user) {
      const token   = generateResetToken();
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      await prisma.user.update({
        where: { id: user.id },
        data:  { resetToken: token, resetExpires: expires },
      });

      const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      console.log('\n📧  PASSWORD RESET LINK (no email configured — printed to console):');
      console.log(`    ${resetLink}\n`);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/reset ────────────────────────────────────────────────────
// Validates token, sets new password, clears token (single-use).

router.post('/reset', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new HttpError(400, 'token and password are required.');

    const user = await prisma.user.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetExpires || user.resetExpires < new Date()) {
      throw new HttpError(400, 'Reset token is invalid or has expired.');
    }

    validatePassword(password); // throws 400 on policy failure

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, resetToken: null, resetExpires: null },
    });

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeUser(user) {
  return {
    id:         user.id,
    email:      user.email,
    name:       user.name,
    role:       user.role,
    customerId: user.customerId,
  };
}

module.exports = router;

