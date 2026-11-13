import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { getAllowedOrigins } from '../middleware/security.js';

/**
 * In-memory map of online users supporting multiple tabs/connections per user.
 * Structure: Map<userId (string), Set<socketId (string)>>
 */
const onlineUsers = new Map();

let ioInstance = null;

/**
 * Authenticates a socket connection during the handshake phase using JWT.
 * Extracts token from socket.handshake.auth?.token or Authorization header.
 */
export async function socketAuthMiddleware(socket, next) {
  let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

  if (typeof token === 'string' && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = verifyToken(token);
    const userId = decoded?.id || decoded?.userId;

    if (!userId) {
      return next(new Error('Authentication error'));
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.userId = (user._id || user.id || userId).toString();
    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error('Authentication error'));
  }
}

/**
 * Initializes Socket.io attached to the given HTTP server.
 *
 * @param {import('node:http').Server} httpServer
 * @param {object} [options]
 * @returns {Server}
 */
export function initSocketServer(httpServer, options = {}) {
  const allowedOrigin = options.corsOrigin !== undefined ? options.corsOrigin : getAllowedOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
      ...options.cors,
    },
    ...options.serverOptions,
  });

  ioInstance = io;

  // Apply JWT handshake authentication
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Join personal user rooms for direct messaging & notifications (STEP 15 & 16)
    socket.join(userId);
    socket.join(`user:${userId}`);

    // Track presence (supporting multi-tab)
    let userSockets = onlineUsers.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      onlineUsers.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // Broadcast online user IDs to all connected clients
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));

    // Real-time chat events (typing indicator & mark read)
    socket.on('typing', (data) => {
      const { conversationId, recipientId } = data || {};
      if (recipientId) {
        emitToUser(recipientId, 'userTyping', {
          conversationId,
          userId: socket.userId,
          username: socket.user?.username || '',
        });
      }
    });

    socket.on('startTyping', (data) => {
      const { conversationId, recipientId } = data || {};
      if (recipientId) {
        emitToUser(recipientId, 'userTyping', {
          conversationId,
          userId: socket.userId,
          username: socket.user?.username || '',
        });
      }
    });

    socket.on('stopTyping', (data) => {
      const { conversationId, recipientId } = data || {};
      if (recipientId) {
        emitToUser(recipientId, 'userStopTyping', {
          conversationId,
          userId: socket.userId,
        });
      }
    });

    socket.on('markMessagesRead', (data) => {
      const { conversationId, recipientId } = data || {};
      if (recipientId) {
        emitToUser(recipientId, 'messagesRead', {
          conversationId,
          readerId: socket.userId,
          readAt: new Date(),
        });
      }
    });

    socket.on('disconnect', () => {
      const currentSockets = onlineUsers.get(userId);
      if (currentSockets) {
        currentSockets.delete(socket.id);
        if (currentSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        }
      }
    });
  });

  return io;
}

/**
 * Returns the active Socket.io server instance.
 */
export function getIO() {
  return ioInstance;
}

/**
 * Returns an array of user IDs currently marked online.
 */
export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}

/**
 * Returns true if the user is online with at least one active socket.
 */
export function isUserOnline(userId) {
  if (!userId) return false;
  const idStr = (userId?._id || userId?.id || userId).toString();
  return onlineUsers.has(idStr);
}

/**
 * Emits an event to a specific user across all their connected sockets / devices.
 */
export function emitToUser(userId, event, payload) {
  if (!ioInstance) return false;
  const targetId = (userId?._id || userId?.id || userId)?.toString();
  if (!targetId) return false;

  ioInstance.to(targetId).to(`user:${targetId}`).emit(event, payload);
  return true;
}

/**
 * Test helper to clear in-memory state.
 */
export function _resetSocketServerForTest() {
  onlineUsers.clear();
  ioInstance = null;
}

