import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  updateComment,
  deleteComment,
} from '../controllers/commentController.js';

const router = express.Router();

router.put('/:id', authMiddleware, updateComment);
router.delete('/:id', authMiddleware, deleteComment);

export default router;

