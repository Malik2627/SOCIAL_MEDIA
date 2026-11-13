import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Helmet middleware configured with crossOriginResourcePolicy allowing cross-origin assets (e.g., avatar images).
 */
export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * General API rate limiter (500 req / 15 min default).
 * Skips in test environments unless ENFORCE_RATE_LIMIT=true.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'test' && !process.env.ENFORCE_RATE_LIMIT,
});

/**
 * Strict authentication endpoints rate limiter (30 req / 15 min default).
 * Skips in test environments unless ENFORCE_RATE_LIMIT=true.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'test' && !process.env.ENFORCE_RATE_LIMIT,
});

/**
 * Recursively removes any object keys that start with '$' or contain '.' to prevent NoSQL operator injection.
 */
function cleanNoSqlKeys(obj) {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      cleanNoSqlKeys(obj[i]);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object') {
      cleanNoSqlKeys(obj[key]);
    }
  }
}

/**
 * Express 5 safe NoSQL injection sanitization middleware.
 * Sanitizes req.body, req.params, and properties in req.query without reassigning req.query.
 */
export function sanitizeNoSql(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    cleanNoSqlKeys(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    cleanNoSqlKeys(req.params);
  }
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = { ...req.query };
    cleanNoSqlKeys(sanitizedQuery);
    try {
      Object.defineProperty(req, 'query', {
        value: sanitizedQuery,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } catch {
      // Fallback
    }
  }
  next();
}

/**
 * Compute allowed origins based on environment.
 * Fallback to http://localhost:5173 is only permitted in non-production.
 */
export function getAllowedOrigins() {
  if (process.env.CLIENT_URL) {
    const urls = process.env.CLIENT_URL
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    return urls.length === 1 ? urls[0] : urls;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return 'http://localhost:5173';
}
