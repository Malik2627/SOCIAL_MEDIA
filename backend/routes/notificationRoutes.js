import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);

// Mount /read-all BEFORE parameterized /:id routes
router.put('/read-all', authMiddleware, markAllAsRead);
router.put('/:id/read', authMiddleware, markAsRead);

export default router;

