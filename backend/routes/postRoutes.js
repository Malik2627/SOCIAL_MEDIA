import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { handlePostImageUpload } from '../config/upload.js';
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLikePost,
  getPostsByUserId,
} from '../controllers/postController.js';
import {
  createComment,
  getPostComments,
} from '../controllers/commentController.js';

const router = express.Router();

router.get('/', getPosts);
router.get('/user/:userId', getPostsByUserId);
router.get('/:id', getPostById);
router.post('/', authMiddleware, handlePostImageUpload, createPost);
router.put('/:id', authMiddleware, handlePostImageUpload, updatePost);
router.delete('/:id', authMiddleware, deletePost);
router.post('/:id/like', authMiddleware, toggleLikePost);
router.put('/:id/like', authMiddleware, toggleLikePost);
router.get('/:id/comments', getPostComments);
router.post('/:id/comments', authMiddleware, createComment);

export default router;

