import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getMyProfile,
  updateMyProfile,
  uploadProfileAvatar,
  changePassword,
  deleteAccount,
} from '../controllers/profileController.js';
import { getPublicProfile } from '../controllers/userController.js';
import { handleAvatarUpload } from '../config/upload.js';

const router = express.Router();

router.get('/me', authMiddleware, getMyProfile);
router.put('/me', authMiddleware, updateMyProfile);
router.put('/me/password', authMiddleware, changePassword);
router.delete('/me', authMiddleware, deleteAccount);
router.post('/me/avatar', authMiddleware, handleAvatarUpload, uploadProfileAvatar);
router.put('/me/avatar', authMiddleware, handleAvatarUpload, uploadProfileAvatar);
router.post('/me/picture', authMiddleware, handleAvatarUpload, uploadProfileAvatar);
router.get('/:username', getPublicProfile);

export default router;

