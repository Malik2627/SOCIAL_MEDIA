import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/socketServer.js';

const SAFE_USER_FIELDS = '_id name username profilePicture bio';

/**
 * Follow a user. Protected route.
 * POST /api/users/:id/follow
 */
export async function followUser(req, res) {
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
      message: 'Invalid user ID',
    });
  }

  const currentUserId = req.user._id.toString();

  // Rule 1: Cannot follow yourself
  if (currentUserId === id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot follow yourself',
    });
  }

  try {
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Atomically add to followers/following without duplicates
    const updatedTargetUser = await User.findByIdAndUpdate(
      id,
      { $addToSet: { followers: req.user._id } },
      { new: true }
    );

    const updatedCurrentUser = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { following: updatedTargetUser._id } },
      { new: true }
    );

    const followersCount = Array.isArray(updatedTargetUser.followers)
      ? updatedTargetUser.followers.length
      : 0;
    const followingCount = Array.isArray(updatedTargetUser.following)
      ? updatedTargetUser.following.length
      : 0;
    const currentUserFollowingCount = Array.isArray(updatedCurrentUser?.following)
      ? updatedCurrentUser.following.length
      : 0;

    // Trigger notification if not self-follow
    const targetUserId = (updatedTargetUser?._id || targetUser._id).toString();
    if (targetUserId !== req.user._id.toString()) {
      try {
        const notif = await Notification.create({
          recipient: updatedTargetUser._id,
          sender: req.user._id,
          type: 'FOLLOW',
          message: 'started following you.',
        });
        await notif.populate('sender', '_id name username profilePicture');
        const unreadCount = await Notification.countDocuments({
          recipient: updatedTargetUser._id,
          read: false,
        });
        emitToUser(updatedTargetUser._id, 'newNotification', {
          notification: notif,
          unreadCount,
        });
      } catch (notifErr) {
        console.warn('[Notification] Failed to create FOLLOW notification:', notifErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'User followed successfully',
      isFollowing: true,
      followersCount,
      followingCount,
      currentUserFollowingCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to follow user',
    });
  }
}

/**
 * Unfollow a user. Protected route.
 * DELETE /api/users/:id/follow
 */
export async function unfollowUser(req, res) {
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
      message: 'Invalid user ID',
    });
  }

  const currentUserId = req.user._id.toString();

  // Rule 1: Cannot unfollow yourself
  if (currentUserId === id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot unfollow yourself',
    });
  }

  try {
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Atomically remove from followers/following
    const updatedTargetUser = await User.findByIdAndUpdate(
      id,
      { $pull: { followers: req.user._id } },
      { new: true }
    );

    const updatedCurrentUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { following: updatedTargetUser._id } },
      { new: true }
    );

    const followersCount = Array.isArray(updatedTargetUser.followers)
      ? updatedTargetUser.followers.length
      : 0;
    const followingCount = Array.isArray(updatedTargetUser.following)
      ? updatedTargetUser.following.length
      : 0;
    const currentUserFollowingCount = Array.isArray(updatedCurrentUser?.following)
      ? updatedCurrentUser.following.length
      : 0;

    // Remove unread follow notification if unfollowed
    const targetUserId = (updatedTargetUser?._id || targetUser._id).toString();
    if (targetUserId !== req.user._id.toString()) {
      try {
        await Notification.deleteMany({
          recipient: updatedTargetUser._id,
          sender: req.user._id,
          type: 'FOLLOW',
          read: false,
        });
        const unreadCount = await Notification.countDocuments({
          recipient: updatedTargetUser._id,
          read: false,
        });
        emitToUser(updatedTargetUser._id, 'notificationCountUpdated', { unreadCount });
      } catch (notifErr) {
        console.warn('[Notification] Failed to remove FOLLOW notification:', notifErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
      isFollowing: false,
      followersCount,
      followingCount,
      currentUserFollowingCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to unfollow user',
    });
  }
}

/**
 * Get followers list of a user.
 * GET /api/users/:id/followers
 */
export async function getUserFollowers(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID',
    });
  }

  try {
    const user = await User.findById(id).populate('followers', SAFE_USER_FIELDS);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const followers = Array.isArray(user.followers) ? user.followers : [];

    return res.status(200).json({
      success: true,
      followersCount: followers.length,
      followers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve followers',
    });
  }
}

/**
 * Get following list of a user.
 * GET /api/users/:id/following
 */
export async function getUserFollowing(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID',
    });
  }

  try {
    const user = await User.findById(id).populate('following', SAFE_USER_FIELDS);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const following = Array.isArray(user.following) ? user.following : [];

    return res.status(200).json({
      success: true,
      followingCount: following.length,
      following,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve following',
    });
  }
}

/**
 * Escape regex special characters to prevent ReDoS / regex injection.
 */
function escapeRegex(string) {
  return typeof string === 'string'
    ? string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';
}

/**
 * Search users by partial name or username.
 * GET /api/users/search?q=query
 */
export async function searchUsers(req, res) {
  const rawQuery = req.query?.q;
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

  if (!query) {
    return res.status(200).json({
      success: true,
      count: 0,
      users: [],
    });
  }

  try {
    const escapedQuery = escapeRegex(query);
    const searchRegex = new RegExp(escapedQuery, 'i');

    const users = await User.find({
      $or: [{ username: searchRegex }, { name: searchRegex }],
    })
      .select('_id name username profilePicture bio followers following')
      .limit(30);

    const safeUsers = users.map((u) => ({
      _id: u._id,
      name: u.name,
      username: u.username,
      profilePicture: u.profilePicture || '',
      bio: u.bio || '',
      followers: u.followers || [],
      following: u.following || [],
      followersCount: Array.isArray(u.followers) ? u.followers.length : 0,
      followingCount: Array.isArray(u.following) ? u.following.length : 0,
    }));

    return res.status(200).json({
      success: true,
      count: safeUsers.length,
      users: safeUsers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to search users',
    });
  }
}

/**
 * Get public profile by username.
 * GET /api/users/profile/:username or GET /api/profile/:username
 */
export async function getPublicProfile(req, res) {
  const rawUsername = req.params?.username;
  const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';

  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required',
    });
  }

  // Prevent collision if route pattern reaches here with "me"
  if (username.toLowerCase() === 'me' && req.user) {
    const followers = Array.isArray(req.user.followers) ? req.user.followers : [];
    const following = Array.isArray(req.user.following) ? req.user.following : [];
    return res.status(200).json({
      success: true,
      user: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        profilePicture: req.user.profilePicture || '',
        bio: req.user.bio || '',
        followers,
        following,
        followersCount: followers.length,
        followingCount: following.length,
        createdAt: req.user.createdAt,
      },
    });
  }

  try {
    const escaped = escapeRegex(username);
    const user = await User.findOne({
      username: new RegExp(`^${escaped}$`, 'i'),
    }).select('-password -email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const followers = Array.isArray(user.followers) ? user.followers : [];
    const following = Array.isArray(user.following) ? user.following : [];

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture || '',
        bio: user.bio || '',
        followers,
        following,
        followersCount: followers.length,
        followingCount: following.length,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve public profile',
    });
  }
}

/**
 * Get all posts authored by a user (by username).
 * GET /api/users/:username/posts
 */
export async function getUserPosts(req, res) {
  const rawUsername = req.params?.username;
  const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';

  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required',
    });
  }

  try {
    const escaped = escapeRegex(username);
    const user = await User.findOne({
      username: new RegExp(`^${escaped}$`, 'i'),
    }).select('_id');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate('author', 'name username profilePicture');

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve user posts',
    });
  }
}

