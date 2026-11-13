import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { deleteComment, updateComment } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';

const MAX_COMMENT_LENGTH = 1000;

function getUserInitial(author) {
  const source = author?.name || author?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function formatCommentTime(dateString) {
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

export default function CommentItem({ comment, onCommentUpdated, onCommentDeleted }) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment?.content || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = user?._id || user?.id;
  const author = comment?.author || {};
  const commentAuthorId = author?._id || author?.id || author;

  const isOwner = Boolean(
    currentUserId &&
      commentAuthorId &&
      currentUserId.toString() === commentAuthorId.toString()
  );

  const isEdited = Boolean(
    comment?.updatedAt &&
      comment?.createdAt &&
      new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000
  );

  function handleStartEdit() {
    setEditContent(comment?.content || '');
    setError('');
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setEditContent(comment?.content || '');
    setError('');
    setIsEditing(false);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (saving) return;

    const trimmed = editContent.trim();
    if (!trimmed) {
      setError('Comment content cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await updateComment(comment._id, trimmed);
      const updated = response?.data?.comment;

      setIsEditing(false);
      if (typeof onCommentUpdated === 'function' && updated) {
        onCommentUpdated(updated);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to update comment.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const confirmed = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      await deleteComment(comment._id);
      if (typeof onCommentDeleted === 'function') {
        onCommentDeleted(comment._id);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to delete comment.'));
      setDeleting(false);
    }
  }

  const commentAuthorUrl = isOwner
    ? '/profile'
    : author?.username
    ? `/profile/${author.username}`
    : '/profile';

  return (
    <div className="comment-item" aria-label={`Comment by ${author.name || 'User'}`}>
      <div className="comment-avatar-wrap">
        <Link to={commentAuthorUrl} className="comment-avatar-link" aria-label={`View ${author.name || 'commenter'}'s profile`}>
          {author.profilePicture ? (
            <img
              src={author.profilePicture}
              alt={author.name || author.username || 'Commenter avatar'}
              className="comment-avatar"
            />
          ) : (
            <span className="comment-avatar-fallback" aria-hidden="true">
              {getUserInitial(author)}
            </span>
          )}
        </Link>
      </div>

      <div className="comment-content-wrap">
        <div className="comment-header">
          <div className="comment-names">
            <Link to={commentAuthorUrl} className="comment-author-name-link">
              <span className="comment-author-name">{author.name || 'Unnamed Member'}</span>
            </Link>
            {author.username && (
              <Link to={commentAuthorUrl} className="comment-author-handle-link">
                <span className="comment-author-handle">@{author.username}</span>
              </Link>
            )}
            <span className="comment-dot">•</span>
            <time className="comment-time" dateTime={comment.createdAt}>
              {formatCommentTime(comment.createdAt)}
            </time>
            {isEdited && <span className="comment-edited-tag">(edited)</span>}
          </div>

          {isOwner && !isEditing && (
            <div className="comment-owner-actions">
              <button
                type="button"
                className="comment-action-btn"
                onClick={handleStartEdit}
                disabled={deleting}
                aria-label="Edit comment"
              >
                Edit
              </button>
              <button
                type="button"
                className="comment-action-btn comment-action-btn--delete"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete comment"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="auth-banner-error comment-error" role="alert">
            {error}
          </div>
        )}

        {isEditing ? (
          <form className="comment-edit-form" onSubmit={handleSaveEdit}>
            <textarea
              className="comment-form-textarea"
              rows={2}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={saving}
              aria-label="Edit comment content"
            />
            <div className="comment-edit-actions">
              <span className="comment-char-counter">
                {editContent.length}/{MAX_COMMENT_LENGTH}
              </span>
              <div className="comment-edit-btn-group">
                <button
                  type="submit"
                  className="auth-btn auth-btn--primary comment-btn-sm"
                  disabled={saving || !editContent.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="auth-btn auth-btn--secondary comment-btn-sm"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="comment-body">{comment.content}</p>
        )}
      </div>
    </div>
  );
}

