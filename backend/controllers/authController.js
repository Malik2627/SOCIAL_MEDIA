import User from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { normalizeText, sanitizeUser } from '../utils/userFormatter.js';

/**
 * Register a new user, hash password, and return safe user data with a JWT.
 */
export async function register(req, res) {
  const { name, username, email, password } = req.body ?? {};
  const trimmedName = normalizeText(name);
  const normalizedUsername = normalizeText(username).toLowerCase();
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!trimmedName || !normalizedUsername || !normalizedEmail || typeof password !== 'string' || password.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'All fields (name, username, email, password) are required',
    });
  }

  try {
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken',
      });
    }

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name: trimmedName,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const firstError = Object.values(error.errors ?? {})[0]?.message;
      return res.status(400).json({
        success: false,
        message: firstError || 'Validation failed',
      });
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists',
      });
    }

    if (error?.message?.includes('JWT_SECRET is not configured')) {
      return res.status(500).json({
        success: false,
        message: 'Server authentication configuration error',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
}

/**
 * Authenticate a user by email and password and return safe user data with a JWT.
 */
export async function login(req, res) {
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!normalizedEmail || typeof password !== 'string' || password.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error?.message?.includes('JWT_SECRET is not configured')) {
      return res.status(500).json({
        success: false,
        message: 'Server authentication configuration error',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to log in',
    });
  }
}

/**
 * Return the currently authenticated user attached by authMiddleware.
 */
export function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
}

