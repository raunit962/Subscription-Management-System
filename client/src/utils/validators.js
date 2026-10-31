/**
 * Password validation — mirrors server lib/auth.js rule exactly.
 * Rule: length > 8, ≥1 uppercase, ≥1 lowercase, ≥1 special char.
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$/;

/**
 * Returns an array of error strings (empty = valid).
 * Used for live feedback on the Signup / ResetPassword pages.
 */
export function validatePassword(password = '') {
  const errors = [];
  if (password.length <= 8)          errors.push('Must be longer than 8 characters');
  if (!/[A-Z]/.test(password))       errors.push('Must contain at least one uppercase letter');
  if (!/[a-z]/.test(password))       errors.push('Must contain at least one lowercase letter');
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Must contain at least one special character');
  return errors;
}

export function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

