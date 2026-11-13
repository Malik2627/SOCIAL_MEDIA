import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '7d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Set JWT_SECRET in backend/.env.');
  }

  return secret;
}

function buildPayload(userId) {
  if (typeof userId === 'string') {
    const trimmed = userId.trim();
    if (!trimmed) {
      throw new Error('User ID is required to generate a token');
    }
    return { id: trimmed };
  }

  if (userId && typeof userId.toHexString === 'function') {
    return { id: userId.toHexString() };
  }

  if (userId && typeof userId === 'object' && !Array.isArray(userId)) {
    return userId;
  }

  throw new Error('A valid userId is required to generate a token');
}

/**
 * Sign a JWT token for the given userId using process.env.JWT_SECRET.
 */
export function generateToken(userId, options = {}) {
  const payload = buildPayload(userId);
  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;

  return jwt.sign(payload, secret, {
    ...options,
    expiresIn,
  });
}

/**
 * Verify a JWT token using process.env.JWT_SECRET and return the decoded payload.
 */
export function verifyToken(token) {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Token is required');
  }

  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}
