import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/socketServer.js';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

const MAX_CONTENT_LENGTH = 2000;

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'socialmedia/posts',
        resource_type: 'image',
        transformation: [
          { width: 1600, height: 1600, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
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

async function deleteFromCloudinary(publicId) {
  if (!publicId || typeof publicId !== 'string') return;
  if (!isCloudinaryConfigured()) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete post image ${publicId}:`, err?.message);
  }
}

/**
 * Create a new post. Requires authentication.
 * Accepts text content and an optional image (via file upload or image URL).
 */
export async function createPost(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const rawContent = req.body?.content;
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';

  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`,
    });
  }

  let imageUrl = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
  let imagePublicId = '';

  if (req.file) {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          'Cloudinary image service is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
      });
    }

    try {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to upload post image',
      });
    }
  }

  if (!content && !imageUrl) {
    return res.status(400).json({
      success: false,
      message: 'Post must contain either text content or an image',
    });
  }

  try {
    const post = await Post.create({
      author: req.user._id,
      content,
      image: imageUrl,
      imagePublicId,
      likes: [],
      comments: [],
    });

    await post.populate('author', 'name username profilePicture');

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create post',
    });
  }
}

/**
 * Get all posts sorted by newest first with populated author info.
 */
export async function getPosts(_req, res) {
  try {
    const posts = await Post.find()
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
      message: error?.message || 'Failed to retrieve posts',
    });
  }
}

/**
 * Get a single post by ID with populated author info.
 */
export async function getPostById(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  try {
    const post = await Post.findById(id).populate('author', 'name username profilePicture');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    return res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve post',
    });
  }
}

/**
 * Update an existing post. Only the author can update their post.
 */
export async function updatePost(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  try {
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const postAuthorId = post.author?._id
      ? post.author._id.toString()
      : post.author?.toString();

    if (postAuthorId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to update this post',
      });
    }

    const rawContent = req.body?.content;
    const nextContent =
      rawContent !== undefined
        ? typeof rawContent === 'string'
          ? rawContent.trim()
          : ''
        : post.content;

    if (nextContent.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`,
      });
    }

    let nextImage = post.image;
    let nextImagePublicId = post.imagePublicId;
    const oldPublicId = post.imagePublicId;

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          success: false,
          message:
            'Cloudinary image service is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
        nextImage = uploadResult.secure_url;
        nextImagePublicId = uploadResult.public_id;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error?.message || 'Failed to upload replacement post image',
        });
      }
    } else if (req.body?.removeImage === 'true' || req.body?.removeImage === true) {
      nextImage = '';
      nextImagePublicId = '';
    } else if (req.body?.image !== undefined) {
      nextImage = typeof req.body.image === 'string' ? req.body.image.trim() : '';
      if (!nextImage) {
        nextImagePublicId = '';
      }
    }

    if (!nextContent && !nextImage) {
      return res.status(400).json({
        success: false,
        message: 'Post must contain either text content or an image',
      });
    }

    post.content = nextContent;
    post.image = nextImage;
    post.imagePublicId = nextImagePublicId;

    await post.save();
    await post.populate('author', 'name username profilePicture');

    if (oldPublicId && oldPublicId !== nextImagePublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    return res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update post',
    });
  }
}

/**
 * Delete a post. Only the author can delete their post.
 */
export async function deletePost(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  try {
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const postAuthorId = post.author?._id
      ? post.author._id.toString()
      : post.author?.toString();

    if (postAuthorId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to delete this post',
      });
    }

    const publicIdToDelete = post.imagePublicId;

    await post.deleteOne();

    // Clean up associated comments
    if (
      mongoose.connection.readyState === 1 ||
      (typeof Comment.deleteMany === 'function' && Comment.deleteMany !== mongoose.Model.deleteMany)
    ) {
      try {
        await Comment.deleteMany({ post: post._id });
      } catch (err) {
        console.warn(`[Comments] Failed to delete comments for post ${post._id}:`, err?.message);
      }
    }

    if (publicIdToDelete) {
      await deleteFromCloudinary(publicIdToDelete);
    }

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to delete post',
    });
  }
}

/**
 * Toggle like/unlike on a post.
 * Adds user ID to post.likes if not present; removes if already present.
 */
export async function toggleLikePost(req, res) {
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
      message: 'Invalid post ID',
    });
  }

  try {
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const userId = req.user._id.toString();
    const existingIndex = post.likes.findIndex(
      (likeId) => (likeId?._id ? likeId._id.toString() : likeId.toString()) === userId
    );

    let liked = false;

    if (existingIndex > -1) {
      // User already liked -> unlike
      post.likes.splice(existingIndex, 1);
      liked = false;
    } else {
      // User has not liked -> like
      post.likes.push(req.user._id);
      liked = true;
    }

    await post.save();
    await post.populate('author', 'name username profilePicture');

    // Trigger notification if not self-like
    const postAuthorId = (post.author?._id || post.author).toString();
    const recipientId = post.author?._id || post.author;
    if (postAuthorId !== req.user._id.toString()) {
      if (liked) {
        try {
          const notif = await Notification.create({
            recipient: recipientId,
            sender: req.user._id,
            type: 'LIKE',
            post: post._id,
            message: 'liked your post.',
          });
          await notif.populate('sender', '_id name username profilePicture');
          await notif.populate('post', '_id content image');
          const unreadCount = await Notification.countDocuments({
            recipient: recipientId,
            read: false,
          });
          emitToUser(recipientId, 'newNotification', {
            notification: notif,
            unreadCount,
          });
        } catch (notifErr) {
          console.warn('[Notification] Failed to create LIKE notification:', notifErr?.message);
        }
      } else {
        try {
          await Notification.deleteMany({
            recipient: recipientId,
            sender: req.user._id,
            type: 'LIKE',
            post: post._id,
            read: false,
          });
          const unreadCount = await Notification.countDocuments({
            recipient: recipientId,
            read: false,
          });
          emitToUser(recipientId, 'notificationCountUpdated', { unreadCount });
        } catch (notifErr) {
          console.warn('[Notification] Failed to remove LIKE notification:', notifErr?.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      liked,
      likesCount: post.likes.length,
      message: liked ? 'Post liked successfully' : 'Post unliked successfully',
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to toggle like',
    });
  }
}

/**
 * Get all posts authored by a user by their user ID.
 * GET /api/posts/user/:userId
 */
export async function getPostsByUserId(req, res) {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID',
    });
  }

  try {
    const posts = await Post.find({ author: userId })
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
      message: error?.message || 'Failed to retrieve posts for user',
    });
  }
}

