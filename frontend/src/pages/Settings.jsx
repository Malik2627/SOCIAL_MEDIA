import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword, deleteAccount, updateProfile } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/settings.css';

const MAX_BIO_LENGTH = 250;

function formatMemberDate(dateString) {
  if (!dateString) return 'Member';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Profile Settings Form State
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Delete Account Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Handle Profile Update
  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      setProfileError('Name cannot be empty.');
      return;
    }

    if (!trimmedUsername) {
      setProfileError('Username cannot be empty.');
      return;
    }

    if (/\s/.test(trimmedUsername)) {
      setProfileError('Username cannot contain spaces.');
      return;
    }

    if (trimmedBio.length > MAX_BIO_LENGTH) {
      setProfileError(`Bio cannot exceed ${MAX_BIO_LENGTH} characters.`);
      return;
    }

    setProfileSaving(true);
    try {
      const res = await updateProfile({
        name: trimmedName,
        username: trimmedUsername,
        bio: trimmedBio,
      });

      const updatedUser = res?.data?.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(getSafeErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setProfileSaving(false);
    }
  }

  // Handle Password Change
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess(res?.data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(getSafeErrorMessage(err, 'Failed to change password.'));
    } finally {
      setPasswordSaving(false);
    }
  }

  // Handle Logout
  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Handle Account Deletion
  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm account deletion.');
      return;
    }

    setDeleteDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(getSafeErrorMessage(err, 'Failed to delete account.'));
      setDeleteDeleting(false);
    }
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your account settings, profile information, password, and security preferences.
        </p>
      </header>

      {/* SECTION 1: Profile Settings */}
      <section className="settings-card" aria-labelledby="settings-profile-heading">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 id="settings-profile-heading" className="settings-card-title">
              <span>👤</span> Profile Settings
            </h2>
            <p className="settings-card-description">
              Update your public display name, username, and bio.
            </p>
          </div>
          <div className="settings-link-hint">
            <Link to="/profile">Manage avatar on Profile →</Link>
          </div>
        </div>

        {profileSuccess && (
          <div className="settings-alert settings-alert--success" role="status">
            ✓ {profileSuccess}
          </div>
        )}

        {profileError && (
          <div className="settings-alert settings-alert--error" role="alert">
            ⚠ {profileError}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="settings-form" noValidate>
          <div className="settings-field-group">
            <label htmlFor="settings-name" className="settings-label">
              Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              className="settings-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setProfileError('');
                setProfileSuccess('');
              }}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="settings-field-group">
            <label htmlFor="settings-username" className="settings-label">
              Username
              <span className="settings-label-hint">(letters, numbers, underscores)</span>
            </label>
            <input
              id="settings-username"
              type="text"
              className="settings-input"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setProfileError('');
                setProfileSuccess('');
              }}
              placeholder="username"
              required
            />
          </div>

          <div className="settings-field-group">
            <label htmlFor="settings-bio" className="settings-label">
              Bio
              <span className="settings-label-hint">({MAX_BIO_LENGTH} characters max)</span>
            </label>
            <textarea
              id="settings-bio"
              className="settings-textarea"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setProfileError('');
                setProfileSuccess('');
              }}
              placeholder="Tell others a little about yourself"
              rows={3}
              maxLength={MAX_BIO_LENGTH}
            />
            <span className="settings-char-count">
              {bio.length} / {MAX_BIO_LENGTH}
            </span>
          </div>

          <div className="settings-actions">
            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={profileSaving}
            >
              {profileSaving ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>

      {/* SECTION 2: Account Information */}
      <section className="settings-card" aria-labelledby="settings-info-heading">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 id="settings-info-heading" className="settings-card-title">
              <span>📋</span> Account Information
            </h2>
            <p className="settings-card-description">
              Read-only details linked to your account.
            </p>
          </div>
        </div>

        <div className="settings-info-list">
          <div className="settings-info-item">
            <span className="settings-info-label">Email Address</span>
            <div className="settings-info-value">
              <span>{user?.email || 'N/A'}</span>
              <span className="settings-info-badge">Primary</span>
            </div>
          </div>

          <div className="settings-info-item">
            <span className="settings-info-label">Username Handle</span>
            <div className="settings-info-value">
              <span>@{user?.username || 'user'}</span>
            </div>
          </div>

          <div className="settings-info-item">
            <span className="settings-info-label">Member Since</span>
            <div className="settings-info-value">
              <span>{formatMemberDate(user?.createdAt)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Change Password */}
      <section className="settings-card" aria-labelledby="settings-password-heading">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 id="settings-password-heading" className="settings-card-title">
              <span>🔒</span> Change Password
            </h2>
            <p className="settings-card-description">
              Ensure your account is using a long, secure password.
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="settings-alert settings-alert--success" role="status">
            ✓ {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div className="settings-alert settings-alert--error" role="alert">
            ⚠ {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="settings-form" noValidate>
          <div className="settings-field-group">
            <label htmlFor="settings-current-password" className="settings-label">
              Current Password
            </label>
            <input
              id="settings-current-password"
              type="password"
              className="settings-input"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="settings-field-group">
            <label htmlFor="settings-new-password" className="settings-label">
              New Password
              <span className="settings-label-hint">(minimum 6 characters)</span>
            </label>
            <input
              id="settings-new-password"
              type="password"
              className="settings-input"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="settings-field-group">
            <label htmlFor="settings-confirm-password" className="settings-label">
              Confirm New Password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              className="settings-input"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="settings-actions">
            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* SECTION 4: Session / Logout */}
      <section className="settings-card" aria-labelledby="settings-session-heading">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 id="settings-session-heading" className="settings-card-title">
              <span>🚪</span> Active Session
            </h2>
            <p className="settings-card-description">
              Manage your logged in session on this device.
            </p>
          </div>
        </div>

        <div className="settings-session-content">
          <div className="settings-session-text">
            <p>
              Logging out will clear your local authentication token and disconnect any active real-time connections.
            </p>
          </div>
          <button
            type="button"
            className="auth-btn auth-btn--secondary"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </section>

      {/* SECTION 5: Danger Zone — Delete Account */}
      <section className="settings-card settings-danger-card" aria-labelledby="settings-danger-heading">
        <div className="settings-card-header">
          <div className="settings-card-title-group">
            <h2 id="settings-danger-heading" className="settings-card-title">
              <span>⚠️</span> Danger Zone — Delete Account
            </h2>
            <p className="settings-card-description">
              Permanently delete your profile and all associated data.
            </p>
          </div>
        </div>

        <div className="settings-danger-content">
          <div className="settings-danger-text">
            <p>
              Once you delete your account, there is no going back. All of your posts, comments, likes, notifications, and messages will be permanently deleted.
            </p>
          </div>
          <button
            type="button"
            className="settings-btn-danger"
            onClick={() => {
              setDeletePassword('');
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          className="settings-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <h3 id="delete-modal-title" className="settings-modal-title">
                <span>⚠️</span> Confirm Account Deletion
              </h3>
              <p className="settings-modal-desc">
                This action is <strong>irreversible</strong>. Please enter your password to confirm that you want to permanently delete your account.
              </p>
            </div>

            <div className="settings-modal-warning-box">
              All your posts, comments, images, conversations, and follower relationships will be erased immediately.
            </div>

            {deleteError && (
              <div className="settings-alert settings-alert--error" role="alert">
                ⚠ {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="settings-form" noValidate>
              <div className="settings-field-group">
                <label htmlFor="settings-delete-password" className="settings-label">
                  Your Account Password
                </label>
                <input
                  id="settings-delete-password"
                  type="password"
                  className="settings-input"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="Enter your password to confirm"
                  required
                  autoFocus
                />
              </div>

              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn--secondary"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-btn-danger"
                  disabled={deleteDeleting}
                >
                  {deleteDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

