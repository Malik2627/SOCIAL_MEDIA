import { Readable } from 'node:stream';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { normalizeText, sanitizeUser } from '../utils/userFormatter.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

const MAX_BIO_LENGTH = 250;

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Return the currently authenticated user's safe profile data.
 */
export function getMyProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
}

/**
 * Update the currently authenticated user's allowed profile fields.
 * Email cannot be changed through this endpoint.
 */
export async function updateMyProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const body = req.body ?? {};
  const { name, username, bio, profilePicture, email } = body;

  if (Object.hasOwn(body, 'email')) {
    const incomingEmail = normalizeText(email).toLowerCase();
    const currentEmail = normalizeText(req.user.email).toLowerCase();
    if (incomingEmail !== currentEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email cannot be changed through this endpoint',
      });
    }
  }

  const nextName = name !== undefined ? normalizeText(name) : normalizeText(req.user.name);
  if (!nextName) {
    return res.status(400).json({
      success: false,
      message: 'Name cannot be empty',
    });
  }

  const nextUsername =
    username !== undefined ? normalizeText(username).toLowerCase() : normalizeText(req.user.username).toLowerCase();
  if (!nextUsername) {
    return res.status(400).json({
      success: false,
      message: 'Username cannot be empty',
    });
  }
  if (/\s/.test(nextUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Username cannot contain spaces',
    });
  }

  const updates = {
    name: nextName,
    username: nextUsername,
  };

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Bio must be a string',
      });
    }
    const trimmedBio = bio.trim();
    if (trimmedBio.length > MAX_BIO_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Bio cannot exceed ${MAX_BIO_LENGTH} characters`,
      });
    }
    updates.bio = trimmedBio;
  }

  if (profilePicture !== undefined) {
    if (typeof profilePicture !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Profile picture must be a valid URL string',
      });
    }
    const trimmedPicture = profilePicture.trim();
    if (trimmedPicture && !isValidHttpUrl(trimmedPicture)) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture must be a valid http or https URL',
      });
    }
    updates.profilePicture = trimmedPicture;
  }

  try {
    const currentUsername = normalizeText(req.user.username).toLowerCase();
    if (nextUsername !== currentUsername) {
      const existingUser = await User.findOne({
        username: nextUsername,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const firstError = Object.values(error.errors ?? {})[0]?.message;
      return res.status(400).json({
        success: false,
        message: firstError || 'Validation failed',
      });
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
}

/**
 * Upload a memory buffer stream directly to Cloudinary.
 */
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'socialmedia/avatars',
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

/**
 * Safely delete an existing asset from Cloudinary (non-fatal if missing or fails).
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId || typeof publicId !== 'string') return;
  if (!isCloudinaryConfigured()) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete previous avatar ${publicId}:`, err?.message);
  }
}

/**
 * Upload and set the authenticated user's profile avatar using Cloudinary.
 * Deletes previous Cloudinary avatar if present.
 */
export async function uploadProfileAvatar(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an image file to upload (supported fields: avatar, image, or profilePicture)',
    });
  }

  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Cloudinary image service is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
    });
  }

  try {
    const previousPublicId = req.user.profilePicturePublicId || '';

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'socialmedia/avatars',
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        profilePicture: uploadResult.secure_url,
        profilePicturePublicId: uploadResult.public_id,
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (previousPublicId && previousPublicId !== uploadResult.public_id) {
      await deleteFromCloudinary(previousPublicId);
    }

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to upload profile picture',
    });
  }
}

/**
 * Change the authenticated user's password.
 * PUT /api/profile/me/password or PUT /api/auth/change-password
 */
export async function changePassword(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

  if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Current password is required',
    });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long',
    });
  }

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirmation do not match',
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from current password',
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const isSamePassword = await comparePassword(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update password',
    });
  }
}

/**
 * Permanently delete the authenticated user's account and all associated data.
 * DELETE /api/profile/me or DELETE /api/auth/me
 */
export async function deleteAccount(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { password } = req.body ?? {};

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Password is required to delete your account',
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    const userId = user._id;

    // 1. Delete user's Cloudinary profile picture
    if (user.profilePicturePublicId) {
      await deleteFromCloudinary(user.profilePicturePublicId);
    }

    // 2. Find all user's posts to clean up images and comments
    const userPosts = await Post.find({ author: userId });
    const userPostIds = userPosts.map((p) => p._id);

    for (const p of userPosts) {
      if (p.imagePublicId) {
        await deleteFromCloudinary(p.imagePublicId);
      }
    }

    // 3. Delete comments on user's posts, and comments written by user on any post
    await Comment.deleteMany({
      $or: [{ author: userId }, { post: { $in: userPostIds } }],
    });

    // 4. Delete user's posts
    await Post.deleteMany({ author: userId });

    // 5. Remove user from likes arrays of all other posts
    await Post.updateMany(
      {},
      {
        $pull: {
          likes: userId,
        },
      }
    );

    // 6. Delete all notifications where user is recipient or sender
    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }],
    });

    // 7. Remove user from followers and following arrays of other users
    await User.updateMany(
      {},
      {
        $pull: {
          followers: userId,
          following: userId,
        },
      }
    );

    // 8. Delete user's chat messages and conversations
    await Message.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }],
    });
    await Conversation.deleteMany({
      participants: userId,
    });

    // 9. Delete the user document itself
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account',
    });
  }
}


