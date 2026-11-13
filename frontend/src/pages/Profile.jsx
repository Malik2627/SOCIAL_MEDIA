import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getUserPosts, uploadProfileAvatar } from '../services/api.js';
import FollowListModal from '../components/FollowListModal.jsx';
import PostCard from '../components/PostCard.jsx';
import { getSafeErrorMessage } from '../utils/apiError.js';
import { validateAvatarFile, validateProfileForm } from '../utils/authValidation.js';
import '../styles/auth.css';
import '../styles/profile.css';

function getInitials(profile) {
  const source = profile?.name || profile?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function toFormValues(profile) {
  return {
    name: profile?.name ?? '',
    username: profile?.username ?? '',
    bio: profile?.bio ?? '',
    profilePicture: profile?.profilePicture ?? '',
  };
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();

  const [profile, setProfile] = useState(user);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'followers' });
  const [formData, setFormData] = useState(() => toFormValues(user));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const fileInputRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const targetUserId = profile?._id || user?._id;
    if (!targetUserId) return;

    async function loadUserPosts() {
      setPostsLoading(true);
      try {
        const res = await getUserPosts(targetUserId);
        if (isMounted) {
          setPosts(Array.isArray(res?.data?.posts) ? res.data.posts : []);
        }
      } catch (err) {
        console.warn('[Profile] Failed to load posts:', err?.message);
      } finally {
        if (isMounted) {
          setPostsLoading(false);
        }
      }
    }

    loadUserPosts();

    return () => {
      isMounted = false;
    };
  }, [profile?._id, user?._id]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError('');
    setAvatarSuccess('');

    const validation = validateAvatarFile(file);
    if (!validation.isValid) {
      setAvatarError(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
  }

  function handleCancelAvatar() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setSelectedFile(null);
    setAvatarError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleUploadAvatar() {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setAvatarError('');
    setAvatarSuccess('');

    try {
      const response = await uploadProfileAvatar(selectedFile, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      const updatedProfile = response?.data?.user;
      if (!updatedProfile) {
        throw new Error('Upload response was incomplete.');
      }

      setProfile(updatedProfile);
      setFormData(toFormValues(updatedProfile));
      setImageLoadFailed(false);
      updateUser(updatedProfile);
      setAvatarSuccess('Profile picture updated successfully.');

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        logout();
        return;
      }
      setAvatarError(getSafeErrorMessage(error, 'Failed to upload profile picture.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const fetchProfile = useCallback(async (isActive = () => true) => {
    try {
      const response = await api.get('/profile/me');
      if (!isActive()) return;

      const fetchedProfile = response?.data?.user ?? null;

      if (!fetchedProfile) {
        setLoadError('Profile data could not be loaded.');
        return;
      }

      setProfile(fetchedProfile);
      setFormData(toFormValues(fetchedProfile));
      setImageLoadFailed(false);
      updateUser(fetchedProfile);
    } catch (error) {
      if (!isActive()) return;

      if (error?.response?.status === 401) {
        logout();
        return;
      }
      setLoadError(getSafeErrorMessage(error, 'Unable to load your profile.'));
    } finally {
      if (isActive()) {
        setLoadingProfile(false);
      }
    }
  }, [logout, updateUser]);

  const handleRetry = useCallback(async () => {
    setLoadingProfile(true);
    setLoadError('');
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function loadInitialProfile() {
      await fetchProfile(() => mounted);
    }

    loadInitialProfile();

    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  function handleOpenEdit() {
    setFormData(toFormValues(profile));
    setFieldErrors({});
    setSaveError('');
    setSaveSuccess('');
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setFormData(toFormValues(profile));
    setFieldErrors({});
    setSaveError('');
    setIsEditing(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (saveError) {
      setSaveError('');
    }
    if (saveSuccess) {
      setSaveSuccess('');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaveError('');
    setSaveSuccess('');

    const { isValid, errors, payload } = validateProfileForm(formData);
    if (!isValid) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);

    try {
      const response = await api.put('/profile/me', payload);
      const updatedProfile = response?.data?.user ?? null;

      if (!updatedProfile) {
        setSaveError('Profile update response was incomplete.');
        return;
      }

      setProfile(updatedProfile);
      setFormData(toFormValues(updatedProfile));
      setImageLoadFailed(false);
      updateUser(updatedProfile);
      setSaveSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (error) {
      if (error?.response?.status === 401) {
        logout();
        return;
      }
      setSaveError(getSafeErrorMessage(error, 'Unable to update your profile.'));
    } finally {
      setSaving(false);
    }
  }

  if (loadingProfile) {
    return (
      <section className="profile-card profile-state-card" aria-busy="true" aria-live="polite">
        <p className="auth-subtitle">Loading profile...</p>
      </section>
    );
  }

  if (loadError && !profile) {
    return (
      <section className="profile-card profile-state-card">
        <div className="auth-banner-error" role="alert">
          {loadError}
        </div>
        <button
          type="button"
          className="auth-btn auth-btn--primary profile-retry-btn"
          onClick={handleRetry}
        >
          Try Again
        </button>
      </section>
    );
  }

  const activeProfile = profile ?? user ?? {};
  const isOwnProfile = Boolean(
    user?._id &&
      activeProfile?._id &&
      user._id.toString() === activeProfile._id.toString()
  );
  const effectiveFollowing = isOwnProfile && Array.isArray(user?.following)
    ? user.following
    : activeProfile.following;
  const followersCount = Array.isArray(activeProfile.followers)
    ? activeProfile.followers.length
    : 0;
  const followingCount = Array.isArray(effectiveFollowing)
    ? effectiveFollowing.length
    : 0;
  const hasAvatar = Boolean(activeProfile.profilePicture) && !imageLoadFailed;

  return (
    <div className="profile-page">
      {loadError && (
        <div className="auth-banner-error" role="alert">
          {loadError}
        </div>
      )}

      {saveSuccess && (
        <div className="profile-banner-success" role="status">
          {saveSuccess}
        </div>
      )}

      {avatarSuccess && (
        <div className="profile-banner-success" role="status">
          {avatarSuccess}
        </div>
      )}

      {avatarError && (
        <div className="auth-banner-error" role="alert">
          {avatarError}
        </div>
      )}

      <section className="profile-card" aria-labelledby="profile-name-heading">
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className="profile-avatar-wrap">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="Selected avatar preview"
                    className="profile-avatar-img profile-avatar-img--preview"
                  />
                  <span className="profile-avatar-preview-badge">Preview</span>
                </>
              ) : hasAvatar ? (
                <img
                  src={activeProfile.profilePicture}
                  alt={`${activeProfile.name || activeProfile.username || 'User'} profile`}
                  className="profile-avatar-img"
                  onError={() => setImageLoadFailed(true)}
                />
              ) : (
                <span className="profile-avatar-fallback" aria-hidden="true">
                  {getInitials(activeProfile)}
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="profile-avatar-input-hidden"
              aria-label="Upload profile picture"
              disabled={uploading}
            />

            {previewUrl ? (
              <div className="profile-avatar-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn--primary profile-avatar-confirm-btn"
                  onClick={handleUploadAvatar}
                  disabled={uploading}
                >
                  {uploading
                    ? uploadProgress > 0
                      ? `Uploading (${uploadProgress}%)`
                      : 'Uploading...'
                    : 'Save Picture'}
                </button>
                <button
                  type="button"
                  className="auth-btn auth-btn--secondary profile-avatar-cancel-btn"
                  onClick={handleCancelAvatar}
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="auth-btn auth-btn--secondary profile-avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Change Photo
              </button>
            )}

            {uploading && (
              <div className="profile-upload-progress" aria-live="polite">
                <div className="profile-upload-bar">
                  <div
                    className="profile-upload-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="profile-upload-text">{uploadProgress}%</span>
              </div>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-identity-top">
              <div>
                <h1 id="profile-name-heading" className="profile-name">
                  {activeProfile.name || 'Unnamed User'}
                </h1>
                <p className="profile-username">
                  {activeProfile.username ? `@${activeProfile.username}` : ''}
                </p>
              </div>

              {!isEditing && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="auth-btn auth-btn--secondary profile-edit-btn"
                    onClick={handleOpenEdit}
                  >
                    Edit Profile
                  </button>
                  <Link
                    to="/settings"
                    className="auth-btn auth-btn--secondary profile-settings-btn"
                    title="Account Settings"
                  >
                    Settings
                  </Link>
                </div>
              )}
            </div>

            {activeProfile.email && (
              <p className="profile-email">{activeProfile.email}</p>
            )}

            <p className="profile-bio">
              {activeProfile.bio || 'No bio added yet.'}
            </p>

            <dl className="profile-stats">
              <button
                type="button"
                className="profile-stat-item profile-stat-btn"
                onClick={() => setModalConfig({ isOpen: true, type: 'followers' })}
                aria-label={`View ${followersCount} followers`}
              >
                <dt className="profile-stat-label">Followers</dt>
                <dd className="profile-stat-value">{followersCount}</dd>
              </button>
              <button
                type="button"
                className="profile-stat-item profile-stat-btn"
                onClick={() => setModalConfig({ isOpen: true, type: 'following' })}
                aria-label={`View ${followingCount} following`}
              >
                <dt className="profile-stat-label">Following</dt>
                <dd className="profile-stat-value">{followingCount}</dd>
              </button>
              <div className="profile-stat-item">
                <dt className="profile-stat-label">Posts</dt>
                <dd className="profile-stat-value">{posts.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {isEditing && (
        <section className="profile-card" aria-labelledby="edit-profile-heading">
          <div className="profile-edit-header">
            <h2 id="edit-profile-heading" className="profile-edit-title">
              Edit Profile
            </h2>
            <p className="auth-subtitle">
              Update your public display information below.
            </p>
          </div>

          {saveError && (
            <div className="auth-banner-error" role="alert">
              {saveError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="profile-name-input">
                Name
              </label>
              <input
                id="profile-name-input"
                name="name"
                type="text"
                className={`auth-input${fieldErrors.name ? ' auth-input--error' : ''}`}
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
              />
              {fieldErrors.name && (
                <p id="profile-name-error" className="auth-field-error" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="profile-username-input">
                Username
              </label>
              <input
                id="profile-username-input"
                name="username"
                type="text"
                className={`auth-input${fieldErrors.username ? ' auth-input--error' : ''}`}
                value={formData.username}
                onChange={handleChange}
                placeholder="username"
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'profile-username-error' : undefined}
              />
              {fieldErrors.username && (
                <p id="profile-username-error" className="auth-field-error" role="alert">
                  {fieldErrors.username}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="profile-email-readonly">
                Email <span className="auth-label-optional">(Read-only)</span>
              </label>
              <input
                id="profile-email-readonly"
                type="email"
                className="auth-input profile-input--readonly"
                value={activeProfile.email ?? ''}
                readOnly
                disabled
                aria-describedby="profile-email-note"
              />
              <p id="profile-email-note" className="profile-helper-text">
                Email cannot be changed from profile settings.
              </p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="profile-picture-input">
                Profile Picture URL <span className="auth-label-optional">(Optional)</span>
              </label>
              <input
                id="profile-picture-input"
                name="profilePicture"
                type="url"
                className={`auth-input${fieldErrors.profilePicture ? ' auth-input--error' : ''}`}
                value={formData.profilePicture}
                onChange={handleChange}
                placeholder="https://example.com/avatar.jpg"
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.profilePicture)}
                aria-describedby={
                  fieldErrors.profilePicture ? 'profile-picture-error' : undefined
                }
              />
              {fieldErrors.profilePicture && (
                <p id="profile-picture-error" className="auth-field-error" role="alert">
                  {fieldErrors.profilePicture}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="profile-bio-input">
                Bio <span className="auth-label-optional">(Optional, max 250 characters)</span>
              </label>
              <textarea
                id="profile-bio-input"
                name="bio"
                className={`auth-textarea${fieldErrors.bio ? ' auth-textarea--error' : ''}`}
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell people a bit about yourself"
                maxLength={250}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby={fieldErrors.bio ? 'profile-bio-error' : undefined}
              />
              {fieldErrors.bio && (
                <p id="profile-bio-error" className="auth-field-error" role="alert">
                  {fieldErrors.bio}
                </p>
              )}
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="auth-btn auth-btn--primary profile-submit-btn"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="auth-btn auth-btn--secondary profile-cancel-btn"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Authored Posts Section */}
      <section className="profile-posts-section" aria-label="Your posts">
        <div className="profile-posts-header">
          <h2 className="profile-posts-title">Your Posts</h2>
          <span className="profile-posts-count">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </span>
        </div>

        {postsLoading ? (
          <div className="post-empty-state">
            <span className="comment-spinner" aria-hidden="true" />
            <p>Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="post-empty-state">
            <p>You haven't created any posts yet.</p>
            <Link to="/" className="auth-btn auth-btn--primary" style={{ width: 'auto', marginTop: '12px' }}>
              Create Post
            </Link>
          </div>
        ) : (
          <div className="post-feed-list" role="feed" aria-label="Your posts">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostUpdated={(updated) =>
                  setPosts((prev) =>
                    prev.map((p) => (p._id === updated._id ? updated : p))
                  )
                }
                onPostDeleted={(deletedId) =>
                  setPosts((prev) => prev.filter((p) => p._id !== deletedId))
                }
              />
            ))}
          </div>
        )}
      </section>

      <FollowListModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        userId={activeProfile._id}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
