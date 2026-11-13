import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/socketServer.js';

const MAX_COMMENT_LENGTH = 1000;

/**
 * Add a comment to a post. Protected route.
 * POST /api/posts/:id/comments
 */
export async function createComment(req, res) {
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

  const rawContent = req.body?.content;
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Comment content cannot be empty',
    });
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
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

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content,
    });

    post.comments.push(comment._id);
    await post.save();

    await comment.populate('author', 'name username profilePicture');

    // Trigger notification if not self-comment
    const postAuthorId = (post.author?._id || post.author).toString();
    const recipientId = post.author?._id || post.author;
    if (postAuthorId !== req.user._id.toString()) {
      try {
        const notif = await Notification.create({
          recipient: recipientId,
          sender: req.user._id,
          type: 'COMMENT',
          post: post._id,
          comment: comment._id,
          message: 'commented on your post.',
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
        console.warn('[Notification] Failed to create COMMENT notification:', notifErr?.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment,
      commentsCount: post.comments.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to add comment',
    });
  }
}

/**
 * Get all comments for a post.
 * GET /api/posts/:id/comments
 */
export async function getPostComments(req, res) {
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

    const comments = await Comment.find({ post: id })
      .populate('author', 'name username profilePicture')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to retrieve comments',
    });
  }
}

/**
 * Update an existing comment. Only the author can update their comment.
 * PUT /api/comments/:id
 */
export async function updateComment(req, res) {
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
      message: 'Invalid comment ID',
    });
  }

  const rawContent = req.body?.content;
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Comment content cannot be empty',
    });
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
    });
  }

  try {
    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const commentAuthorId = comment.author?._id
      ? comment.author._id.toString()
      : comment.author?.toString();

    if (commentAuthorId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to update this comment',
      });
    }

    comment.content = content;
    await comment.save();
    await comment.populate('author', 'name username profilePicture');

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      comment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update comment',
    });
  }
}

/**
 * Delete a comment. Only the comment author (or post author) can delete the comment.
 * DELETE /api/comments/:id
 */
export async function deleteComment(req, res) {
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
      message: 'Invalid comment ID',
    });
  }

  try {
    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const commentAuthorId = comment.author?._id
      ? comment.author._id.toString()
      : comment.author?.toString();

    const isCommentAuthor = commentAuthorId === req.user._id.toString();

    let isPostAuthor = false;
    if (!isCommentAuthor && comment.post) {
      const post = await Post.findById(comment.post);
      const postAuthorId = post?.author?._id
        ? post.author._id.toString()
        : post?.author?.toString();
      if (postAuthorId === req.user._id.toString()) {
        isPostAuthor = true;
      }
    }

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to delete this comment',
      });
    }

    const postId = comment.post;
    await comment.deleteOne();

    if (postId) {
      await Post.findByIdAndUpdate(postId, {
        $pull: { comments: comment._id },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      commentId: comment._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to delete comment',
    });
  }
}
