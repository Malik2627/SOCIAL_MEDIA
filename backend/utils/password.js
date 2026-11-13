import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password with bcryptjs.
 * Never logs or returns the original password.
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 */
export async function comparePassword(password, hashedPassword) {
  if (typeof password !== 'string' || typeof hashedPassword !== 'string' || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(password, hashedPassword);
}

