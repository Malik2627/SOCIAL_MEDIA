import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/socketServer.js';

/**
 * Get notifications for authenticated user.
 * GET /api/notifications
 */
export async function getNotifications(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', '_id name username profilePicture')
      .populate('post', '_id content image');

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve notifications',
    });
  }
}

/**
 * Mark all unread notifications as read.
 * PUT /api/notifications/read-all
 */
export async function markAllAsRead(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    emitToUser(req.user._id, 'notificationCountUpdated', { unreadCount: 0 });

    return res.status(200).json({
      success: true,
      unreadCount: 0,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to mark all notifications as read',
    });
  }
}

/**
 * Mark a single notification as read.
 * PUT /api/notifications/:id/read
 */
export async function markAsRead(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification ID',
    });
  }

  try {
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const recipientId = (notification.recipient?._id || notification.recipient).toString();

    if (recipientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to update this notification',
      });
    }

    notification.read = true;
    await notification.save();
    await notification.populate('sender', '_id name username profilePicture');
    await notification.populate('post', '_id content image');

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    emitToUser(req.user._id, 'notificationCountUpdated', { unreadCount });

    return res.status(200).json({
      success: true,
      unreadCount,
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to mark notification as read',
    });
  }
}

