import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Express middleware that authenticates requests using an Authorization: Bearer <token> header
 * and attaches the corresponding user document (without password) to req.user.
 */
export async function protect(req, res, next) {
  const authHeader = req.headers?.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, missing or invalid authorization header',
    });
  }

  const parts = authHeader.trim().split(/\s+/);
  const token = parts.length === 2 ? parts[1] : '';

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing',
    });
  }

  try {
    const decoded = verifyToken(token);
    const userId = decoded?.id || decoded?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid token payload',
      });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error?.message?.includes('JWT_SECRET is not configured')) {
      return res.status(500).json({
        success: false,
        message: 'Server authentication configuration error',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid or expired',
    });
  }
}

export default protect;

