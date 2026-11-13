import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  searchUsers,
  getPublicProfile,
  getUserPosts,
} from '../controllers/userController.js';

const router = express.Router();

// Specific routes mounted BEFORE parameterized :id routes
router.get('/search', searchUsers);
router.get('/profile/:username', getPublicProfile);
router.get('/:username/posts', getUserPosts);

router.post('/:id/follow', authMiddleware, followUser);
router.delete('/:id/follow', authMiddleware, unfollowUser);
router.get('/:id/followers', getUserFollowers);
router.get('/:id/following', getUserFollowing);

export default router;

