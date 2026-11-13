import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createPost } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import { validatePostImageFile } from '../utils/authValidation.js';

const MAX_CONTENT_LENGTH = 2000;

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    const validation = validatePostImageFile(file);
    if (!validation.isValid) {
      setError(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreview = URL.createObjectURL(file);
    setImageFile(file);
    setPreviewUrl(nextPreview);
  }

  function handleRemoveImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const trimmedContent = content.trim();

    if (!trimmedContent && !imageFile) {
      setError('Please write some text or attach an image.');
      return;
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      setError(`Post content cannot exceed ${MAX_CONTENT_LENGTH} characters.`);
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (trimmedContent) {
        formData.append('content', trimmedContent);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await createPost(formData);
      const newPost = response?.data?.post;

      if (!newPost) {
        throw new Error('Create post response was incomplete.');
      }

      setContent('');
      handleRemoveImage();

      if (typeof onPostCreated === 'function') {
        onPostCreated(newPost);
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to create post. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const isOverLimit = content.length > MAX_CONTENT_LENGTH;
  const canSubmit = !submitting && !isOverLimit && (Boolean(content.trim()) || Boolean(imageFile));

  return (
    <article className="create-post-card" aria-label="Create a post">
      <div className="create-post-header">
        {user?.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name || user.username || 'User avatar'}
            className="create-post-avatar"
          />
        ) : (
          <span className="create-post-avatar-fallback" aria-hidden="true">
            {getUserInitial(user)}
          </span>
        )}
        <span className="create-post-prompt">
          What is on your mind{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?
        </span>
      </div>

      {error && (
        <div className="auth-banner-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError('');
          }}
          placeholder="Share something with your network..."
          className="create-post-textarea"
          rows={3}
          disabled={submitting}
          aria-label="Post text content"
        />

        {previewUrl && (
          <div className="create-post-preview-wrap">
            <img
              src={previewUrl}
              alt="Post attachment preview"
              className="create-post-preview-img"
            />
            <button
              type="button"
              className="create-post-remove-preview-btn"
              onClick={handleRemoveImage}
              title="Remove image"
              aria-label="Remove attached image"
              disabled={submitting}
            >
              ✕
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
          disabled={submitting}
          aria-label="Attach an image to post"
        />

        <div className="create-post-footer">
          <div className="create-post-actions-left">
            <button
              type="button"
              className="create-post-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              📷 Attach Image
            </button>

            <span
              className={`create-post-char-count${
                isOverLimit ? ' create-post-char-count--warn' : ''
              }`}
            >
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </div>

          <button
            type="submit"
            className="auth-btn auth-btn--primary create-post-submit-btn"
            disabled={!canSubmit}
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </article>
  );
}

