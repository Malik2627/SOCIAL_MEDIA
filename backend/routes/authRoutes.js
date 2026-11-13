import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { changePassword, deleteAccount } from '../controllers/profileController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/security.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authMiddleware, getMe);
router.put('/change-password', authMiddleware, changePassword);
router.delete('/me', authMiddleware, deleteAccount);

export default router;

