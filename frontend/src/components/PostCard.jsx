import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import CommentSection from './CommentSection.jsx';
import FollowButton from './FollowButton.jsx';
import { deletePost, toggleLikePost, updatePost } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import { validatePostImageFile } from '../utils/authValidation.js';

const MAX_CONTENT_LENGTH = 2000;

function getUserInitial(author) {
  const source = author?.name || author?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function formatPostTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function PostCard({ post, onPostUpdated, onPostDeleted }) {
  const { user } = useAuth();
  const { isUserOnline } = useSocket();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post?.content || '');
  const [replacementImage, setReplacementImage] = useState(null);
  const [replacementPreview, setReplacementPreview] = useState('');
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const editFileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (replacementPreview) {
        URL.revokeObjectURL(replacementPreview);
      }
    };
  }, [replacementPreview]);

  // Ownership verification: user matches post.author (by _id or string)
  const currentUserId = user?._id || user?.id;
  const postAuthorId = post?.author?._id || post?.author?.id || post?.author;
  const isOwner = Boolean(
    currentUserId &&
      postAuthorId &&
      currentUserId.toString() === postAuthorId.toString()
  );

  const initialLiked = Boolean(
    currentUserId &&
      Array.isArray(post?.likes) &&
      post.likes.some(
        (likeItem) =>
          (likeItem?._id ? likeItem._id.toString() : likeItem.toString()) ===
          currentUserId.toString()
      )
  );

  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(
    Array.isArray(post?.likes) ? post.likes.length : 0
  );
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(
    Array.isArray(post?.comments) ? post.comments.length : 0
  );

  useEffect(() => {
    setCommentsCount(Array.isArray(post?.comments) ? post.comments.length : 0);
  }, [post?.comments]);

  useEffect(() => {
    const isLiked = Boolean(
      currentUserId &&
        Array.isArray(post?.likes) &&
        post.likes.some(
          (likeItem) =>
            (likeItem?._id ? likeItem._id.toString() : likeItem.toString()) ===
            currentUserId.toString()
        )
    );
    setLiked(isLiked);
    setLikesCount(Array.isArray(post?.likes) ? post.likes.length : 0);
  }, [post?.likes, currentUserId]);

  async function handleToggleLike() {
    if (!user || isLiking) return;

    const previousLiked = liked;
    const previousCount = likesCount;

    // Optimistic update
    const nextLiked = !previousLiked;
    const nextCount = nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

    setLiked(nextLiked);
    setLikesCount(nextCount);
    setIsLiking(true);

    try {
      const response = await toggleLikePost(post._id);
      const {
        liked: serverLiked,
        likesCount: serverCount,
        post: updatedPost,
      } = response?.data || {};

      if (serverLiked !== undefined) setLiked(serverLiked);
      if (typeof serverCount === 'number') setLikesCount(serverCount);

      if (updatedPost && typeof onPostUpdated === 'function') {
        onPostUpdated(updatedPost);
      }
    } catch (err) {
      // Revert optimistic update on error
      setLiked(previousLiked);
      setLikesCount(previousCount);
      setError(getSafeErrorMessage(err, 'Failed to update like.'));
    } finally {
      setIsLiking(false);
    }
  }

  const isEdited = Boolean(
    post?.updatedAt &&
      post?.createdAt &&
      new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000
  );

  function handleStartEdit() {
    setEditContent(post?.content || '');
    setReplacementImage(null);
    if (replacementPreview) {
      URL.revokeObjectURL(replacementPreview);
    }
    setReplacementPreview('');
    setRemoveExistingImage(false);
    setError('');
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (replacementPreview) {
      URL.revokeObjectURL(replacementPreview);
    }
    setReplacementPreview('');
    setReplacementImage(null);
    setRemoveExistingImage(false);
    setError('');
    setIsEditing(false);
  }

  function handleReplacementImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    const validation = validatePostImageFile(file);
    if (!validation.isValid) {
      setError(validation.error);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      return;
    }

    if (replacementPreview) {
      URL.revokeObjectURL(replacementPreview);
    }

    const nextPreview = URL.createObjectURL(file);
    setReplacementImage(file);
    setReplacementPreview(nextPreview);
    setRemoveExistingImage(false);
  }

  function handleClearReplacement() {
    if (replacementPreview) {
      URL.revokeObjectURL(replacementPreview);
    }
    setReplacementPreview('');
    setReplacementImage(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (savingEdit) return;

    const trimmed = editContent.trim();
    const willHaveImage =
      (Boolean(post.image) && !removeExistingImage) || Boolean(replacementImage);

    if (!trimmed && !willHaveImage) {
      setError('A post must contain either text content or an image.');
      return;
    }

    if (trimmed.length > MAX_CONTENT_LENGTH) {
      setError(`Content cannot exceed ${MAX_CONTENT_LENGTH} characters.`);
      return;
    }

    setError('');
    setSavingEdit(true);

    try {
      const formData = new FormData();
      formData.append('content', trimmed);

      if (replacementImage) {
        formData.append('image', replacementImage);
      } else if (removeExistingImage) {
        formData.append('removeImage', 'true');
      }

      const response = await updatePost(post._id, formData);
      const updatedPost = response?.data?.post;

      if (!updatedPost) {
        throw new Error('Update response was incomplete.');
      }

      handleCancelEdit();
      if (typeof onPostUpdated === 'function') {
        onPostUpdated(updatedPost);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to update post.'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const confirmed = window.confirm('Are you sure you want to delete this post?');
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      await deletePost(post._id);
      if (typeof onPostDeleted === 'function') {
        onPostDeleted(post._id);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to delete post.'));
      setDeleting(false);
    }
  }

  const author = post?.author || {};
  const authorUsername = author?.username;
  const authorProfileUrl = isOwner
    ? '/profile'
    : authorUsername
    ? `/profile/${authorUsername}`
    : '/profile';

  return (
    <article className="post-card" aria-label={`Post by ${author.name || 'User'}`}>
      <header className="post-card-header">
        <div className="post-card-author-info">
          <Link
            to={authorProfileUrl}
            className="post-card-avatar-link"
            aria-label={`View ${author.name || 'author'}'s profile`}
          >
            {author.profilePicture ? (
              <img
                src={author.profilePicture}
                alt={author.name || author.username || 'Author avatar'}
                className="post-card-avatar"
              />
            ) : (
              <span className="post-card-avatar-fallback" aria-hidden="true">
                {getUserInitial(author)}
              </span>
            )}
            {isUserOnline(postAuthorId) && (
              <span
                className="post-author-online-dot"
                title="Author is online"
                aria-label="Author is online"
              />
            )}
          </Link>

          <div className="post-card-names">
            <Link to={authorProfileUrl} className="post-card-name-link">
              <h3 className="post-card-author-name">{author.name || 'Unnamed Member'}</h3>
            </Link>
            <div className="post-card-meta">
              {author.username && (
                <Link to={authorProfileUrl} className="post-card-handle-link">
                  <span className="post-card-author-handle">@{author.username}</span>
                </Link>
              )}
              <span>•</span>
              <time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time>
              {isEdited && <span className="post-card-edited-tag">(edited)</span>}
            </div>
          </div>
        </div>

        {isOwner && !isEditing && (
          <div className="post-card-owner-actions">
            <button
              type="button"
              className="post-card-btn-icon"
              onClick={handleStartEdit}
              disabled={deleting}
              aria-label="Edit post"
            >
              Edit
            </button>
            <button
              type="button"
              className="post-card-btn-icon post-card-btn-delete"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete post"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}

        {!isOwner && !isEditing && author?._id && (
          <div className="post-card-header-actions">
            <FollowButton targetUserId={author._id} size="sm" />
          </div>
        )}
      </header>

      {error && (
        <div className="auth-banner-error" role="alert">
          {error}
        </div>
      )}

      {isEditing ? (
        <form className="post-edit-card" onSubmit={handleSaveEdit}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="create-post-textarea"
            rows={3}
            disabled={savingEdit}
            placeholder="Edit your post..."
            aria-label="Edit post content"
          />

          {/* Replacement image preview */}
          {replacementPreview ? (
            <div className="create-post-preview-wrap">
              <img
                src={replacementPreview}
                alt="Replacement attachment preview"
                className="create-post-preview-img"
              />
              <button
                type="button"
                className="create-post-remove-preview-btn"
                onClick={handleClearReplacement}
                title="Cancel replacement"
                disabled={savingEdit}
              >
                ✕
              </button>
            </div>
          ) : post.image && !removeExistingImage ? (
            <div className="create-post-preview-wrap">
              <img
                src={post.image}
                alt="Current attachment"
                className="create-post-preview-img"
              />
              <button
                type="button"
                className="create-post-remove-preview-btn"
                onClick={() => setRemoveExistingImage(true)}
                title="Remove image from post"
                disabled={savingEdit}
              >
                ✕
              </button>
            </div>
          ) : null}

          <input
            ref={editFileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleReplacementImageSelect}
            style={{ display: 'none' }}
            disabled={savingEdit}
          />

          <div className="post-edit-actions">
            <button
              type="button"
              className="create-post-attach-btn"
              onClick={() => editFileInputRef.current?.click()}
              disabled={savingEdit}
            >
              📷 {post.image && !removeExistingImage ? 'Replace Image' : 'Attach Image'}
            </button>

            {removeExistingImage && (
              <button
                type="button"
                className="create-post-attach-btn"
                onClick={() => setRemoveExistingImage(false)}
                disabled={savingEdit}
              >
                ↩ Restore Image
              </button>
            )}

            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              className="auth-btn auth-btn--secondary"
              onClick={handleCancelEdit}
              disabled={savingEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {post.content && <p className="post-card-body">{post.content}</p>}

          {post.image && (
            <div className="post-card-image-wrap">
              <img
                src={post.image}
                alt="Post content"
                className="post-card-image"
                loading="lazy"
              />
            </div>
          )}

          <footer className="post-card-footer">
            <button
              type="button"
              className={`post-card-metric-btn post-card-like-btn${
                liked ? ' post-card-like-btn--active' : ''
              }`}
              onClick={handleToggleLike}
              disabled={isLiking}
              aria-label={liked ? 'Unlike post' : 'Like post'}
              aria-pressed={liked}
            >
              <span className="post-card-like-icon" aria-hidden="true">
                {liked ? '❤️' : '🤍'}
              </span>
              <span className="post-card-metric-label">
                {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
              </span>
            </button>

            <button
              type="button"
              className={`post-card-metric-btn post-card-comment-btn${
                showComments ? ' post-card-comment-btn--active' : ''
              }`}
              onClick={() => setShowComments((prev) => !prev)}
              aria-label={`${commentsCount} comments. Click to ${showComments ? 'hide' : 'view'} comments`}
              aria-expanded={showComments}
            >
              <span className="post-card-comment-icon" aria-hidden="true">
                💬
              </span>
              <span className="post-card-metric-label">
                {commentsCount} {commentsCount === 1 ? 'Comment' : 'Comments'}
              </span>
            </button>
          </footer>

          {showComments && (
            <CommentSection
              postId={post._id}
              onCommentCountChange={(newCount) => setCommentsCount(newCount)}
            />
          )}
        </>
      )}
    </article>
  );
}

