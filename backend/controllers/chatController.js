import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/socketServer.js';

const SAFE_USER_FIELDS = '_id name username profilePicture bio';
const SAFE_MESSAGE_USER_FIELDS = '_id name username profilePicture';
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Get or create a 1-to-1 conversation with another user.
 * POST /api/messages/conversations
 * POST /api/messages/with/:userId
 */
export async function getOrCreateConversation(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const recipientId = req.body?.recipientId || req.params?.userId || req.body?.userId;

  if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
    return res.status(400).json({
      success: false,
      message: 'A valid recipient ID is required',
    });
  }

  const currentUserId = req.user._id.toString();
  const targetId = recipientId.toString();

  if (currentUserId === targetId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot start a conversation with yourself',
    });
  }

  try {
    const targetUser = await User.findById(recipientId).select(SAFE_USER_FIELDS);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId], $size: 2 },
    })
      .populate('participants', SAFE_USER_FIELDS)
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender recipient', select: SAFE_MESSAGE_USER_FIELDS },
      });

    let statusCode = 200;

    if (!conversation) {
      const created = await Conversation.create({
        participants: [req.user._id, recipientId],
      });
      conversation = await Conversation.findById(created._id).populate(
        'participants',
        SAFE_USER_FIELDS
      );
      statusCode = 201;
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      recipient: req.user._id,
      read: false,
    });

    return res.status(statusCode).json({
      success: true,
      conversation: {
        ...conversation.toObject(),
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to get or create conversation',
    });
  }
}

/**
 * Get all conversations for the authenticated user, sorted by newest activity.
 * GET /api/messages/conversations
 */
export async function getUserConversations(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .sort({ updatedAt: -1 })
      .populate('participants', SAFE_USER_FIELDS)
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender recipient', select: SAFE_MESSAGE_USER_FIELDS },
      });

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          recipient: req.user._id,
          read: false,
        });
        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve conversations',
    });
  }
}

/**
 * Get message history for a conversation.
 * GET /api/messages/conversations/:conversationId/messages
 */
export async function getConversationMessages(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { conversationId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation ID',
    });
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    const currentUserId = req.user._id.toString();
    const isParticipant = conversation.participants.some(
      (p) => (p?._id ? p._id.toString() : p.toString()) === currentUserId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a participant in this conversation',
      });
    }

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate('sender', SAFE_MESSAGE_USER_FIELDS)
      .populate('recipient', SAFE_MESSAGE_USER_FIELDS);

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve messages',
    });
  }
}

/**
 * Send a message in a conversation.
 * POST /api/messages
 * POST /api/messages/conversations/:conversationId/messages
 */
export async function sendMessage(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const conversationId = req.params?.conversationId || req.body?.conversationId;
  const recipientId = req.body?.recipientId;
  const rawContent = req.body?.content;

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Message content cannot be empty',
    });
  }

  const content = rawContent.trim();
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    });
  }

  const currentUserId = req.user._id.toString();

  try {
    let activeConversation = null;
    let targetRecipientId = recipientId;

    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      activeConversation = await Conversation.findById(conversationId);
      if (!activeConversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      const isParticipant = activeConversation.participants.some(
        (p) => (p?._id ? p._id.toString() : p.toString()) === currentUserId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not a participant in this conversation',
        });
      }

      const otherParticipant = activeConversation.participants.find(
        (p) => (p?._id ? p._id.toString() : p.toString()) !== currentUserId
      );

      targetRecipientId = (otherParticipant?._id || otherParticipant)?.toString();
    } else if (recipientId) {
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient ID',
        });
      }

      if (recipientId.toString() === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send messages to yourself',
        });
      }

      activeConversation = await Conversation.findOne({
        participants: { $all: [req.user._id, recipientId], $size: 2 },
      });

      if (!activeConversation) {
        activeConversation = await Conversation.create({
          participants: [req.user._id, recipientId],
        });
      }

      targetRecipientId = recipientId.toString();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either conversationId or recipientId must be provided',
      });
    }

    if (!targetRecipientId || targetRecipientId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send a message to yourself',
      });
    }

    const message = await Message.create({
      conversation: activeConversation._id,
      sender: req.user._id,
      recipient: targetRecipientId,
      content,
    });

    activeConversation.lastMessage = message._id;
    activeConversation.updatedAt = new Date();
    await activeConversation.save();

    await message.populate('sender', SAFE_MESSAGE_USER_FIELDS);
    await message.populate('recipient', SAFE_MESSAGE_USER_FIELDS);
    await activeConversation.populate('participants', SAFE_USER_FIELDS);
    await activeConversation.populate({
      path: 'lastMessage',
      populate: { path: 'sender recipient', select: SAFE_MESSAGE_USER_FIELDS },
    });

    // Generate MESSAGE notification in Notification collection
    try {
      const notif = await Notification.create({
        recipient: targetRecipientId,
        sender: req.user._id,
        type: 'MESSAGE',
        message: 'sent you a message.',
      });
      await notif.populate('sender', SAFE_MESSAGE_USER_FIELDS);
      const unreadCount = await Notification.countDocuments({
        recipient: targetRecipientId,
        read: false,
      });
      emitToUser(targetRecipientId, 'newNotification', {
        notification: notif,
        unreadCount,
      });
    } catch (notifErr) {
      console.warn('[Notification] Failed to create MESSAGE notification:', notifErr?.message);
    }

    // Emit real-time Socket.io event to recipient and sender's other tabs
    emitToUser(targetRecipientId, 'newMessage', {
      message,
      conversationId: activeConversation._id,
    });
    emitToUser(currentUserId, 'newMessage', {
      message,
      conversationId: activeConversation._id,
    });

    return res.status(201).json({
      success: true,
      message,
      conversation: activeConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to send message',
    });
  }
}

/**
 * Mark all unread messages in a conversation as read.
 * PUT /api/messages/conversations/:conversationId/read
 */
export async function markConversationRead(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { conversationId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation ID',
    });
  }

  const currentUserId = req.user._id.toString();

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => (p?._id ? p._id.toString() : p.toString()) === currentUserId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not a participant in this conversation',
      });
    }

    const otherParticipant = conversation.participants.find(
      (p) => (p?._id ? p._id.toString() : p.toString()) !== currentUserId
    );
    const otherUserId = (otherParticipant?._id || otherParticipant)?.toString();

    const readAt = new Date();
    const result = await Message.updateMany(
      {
        conversation: conversationId,
        recipient: req.user._id,
        read: false,
      },
      {
        $set: {
          read: true,
          readAt,
        },
      }
    );

    // Real-time socket event notifying the sender that their messages were read
    if (otherUserId) {
      emitToUser(otherUserId, 'messagesRead', {
        conversationId,
        readerId: currentUserId,
        readAt,
      });
    }

    return res.status(200).json({
      success: true,
      count: result.modifiedCount,
      readAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to mark messages as read',
    });
  }
}

