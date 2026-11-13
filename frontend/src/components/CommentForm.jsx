import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createComment } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';

const MAX_COMMENT_LENGTH = 1000;

export default function CommentForm({ postId, onCommentAdded, placeholder = 'Write a comment...' }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) {
      setError('You must be logged in to comment.');
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError('Comment cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await createComment(postId, trimmed);
      const newComment = response?.data?.comment;
      const commentsCount = response?.data?.commentsCount;

      setContent('');
      if (typeof onCommentAdded === 'function' && newComment) {
        onCommentAdded(newComment, commentsCount);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to post comment.'));
    } finally {
      setSubmitting(false);
    }
  }

  const remainingChars = MAX_COMMENT_LENGTH - content.length;
  const isNearLimit = remainingChars <= 100;

  return (
    <form className="comment-form" onSubmit={handleSubmit} aria-label="Add a comment">
      {error && (
        <div className="auth-banner-error" role="alert">
          {error}
        </div>
      )}

      <div className="comment-form-input-wrap">
        <textarea
          className="comment-form-textarea"
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={user ? placeholder : 'Log in to write a comment...'}
          maxLength={MAX_COMMENT_LENGTH}
          disabled={submitting || !user}
          aria-label="Comment text"
        />
      </div>

      <div className="comment-form-footer">
        <span
          className={`comment-char-counter${isNearLimit ? ' comment-char-counter--warn' : ''}`}
          aria-live="polite"
        >
          {content.length}/{MAX_COMMENT_LENGTH}
        </span>

        <button
          type="submit"
          className="auth-btn auth-btn--primary comment-submit-btn"
          disabled={submitting || !content.trim() || !user}
        >
          {submitting ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </form>
  );
}

