import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/chatController.js';

const router = express.Router();

router.use(protect);

router.get('/conversations', getUserConversations);
router.post('/conversations', getOrCreateConversation);
router.post('/with/:userId', getOrCreateConversation);

router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/messages', sendMessage);

router.post('/', sendMessage);
router.put('/conversations/:conversationId/read', markConversationRead);

export default router;

