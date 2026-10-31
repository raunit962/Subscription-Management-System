'use strict';

const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const { HttpError } = require('./errors');

// ─── Password validation ────────────────────────────────────────────────────
// Rule: length > 8, ≥1 uppercase, ≥1 lowercase, ≥1 special char.
// Same regex is mirrored in client/src/utils/validators.js.

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$/;

/**
 * Returns true if the password satisfies the policy.
 * Throws HttpError 400 with a descriptive message if it doesn't.
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new HttpError(400, 'Password is required.');
  }
  if (password.length <= 8) {
    throw new HttpError(400, 'Password must be longer than 8 characters.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new HttpError(400, 'Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    throw new HttpError(400, 'Password must contain at least one lowercase letter.');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    throw new HttpError(400, 'Password must contain at least one special character.');
  }
  return true;
}

// ─── bcrypt helpers ─────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function signToken(user) {
  const payload = {
    id:         user.id,
    role:       user.role,
    customerId: user.customerId ?? null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * requireAuth — extracts Bearer token, verifies it, attaches payload to req.user.
 */
function requireAuth(req, _res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required.'));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token.'));
  }
}

/**
 * requireRole(...roles) — factory; must be used AFTER requireAuth.
 * e.g. router.post('/', requireAuth, requireRole('ADMIN'), handler)
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, `Access denied. Required role: ${roles.join(' or ')}.`));
    }
    next();
  };
}

// ─── Reset token helper ───────────────────────────────────────────────────────

const crypto = require('crypto');

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  PASSWORD_REGEX,
  validatePassword,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  requireAuth,
  requireRole,
  generateResetToken,
};

