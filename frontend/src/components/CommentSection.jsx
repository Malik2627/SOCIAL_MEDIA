import { useEffect, useState } from 'react';
import CommentForm from './CommentForm.jsx';
import CommentItem from './CommentItem.jsx';
import { getPostComments } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';

export default function CommentSection({ postId, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchComments() {
      if (!postId) return;
      setLoading(true);
      setError('');

      try {
        const response = await getPostComments(postId);
        const list = Array.isArray(response?.data?.comments)
          ? response.data.comments
          : [];

        if (isMounted) {
          setComments(list);
          if (typeof onCommentCountChange === 'function') {
            onCommentCountChange(list.length);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(getSafeErrorMessage(err, 'Failed to load comments.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [postId, onCommentCountChange]);

  function handleCommentAdded(newComment, serverCount) {
    setComments((prev) => {
      const next = [...prev, newComment];
      if (typeof onCommentCountChange === 'function') {
        onCommentCountChange(
          typeof serverCount === 'number' ? serverCount : next.length
        );
      }
      return next;
    });
  }

  function handleCommentUpdated(updatedComment) {
    setComments((prev) =>
      prev.map((c) => (c._id === updatedComment._id ? updatedComment : c))
    );
  }

  function handleCommentDeleted(deletedId) {
    setComments((prev) => {
      const next = prev.filter((c) => c._id !== deletedId);
      if (typeof onCommentCountChange === 'function') {
        onCommentCountChange(next.length);
      }
      return next;
    });
  }

  return (
    <section className="post-comment-section" aria-label="Comments section">
      <CommentForm postId={postId} onCommentAdded={handleCommentAdded} />

      {error && (
        <div className="auth-banner-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="comment-loading-state" aria-busy="true">
          <span className="comment-spinner" aria-hidden="true" />
          <span>Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="comment-empty-state">
          No comments yet. Be the first to start the conversation!
        </div>
      ) : (
        <div className="comment-list" role="feed" aria-label="Comments">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onCommentUpdated={handleCommentUpdated}
              onCommentDeleted={handleCommentDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

