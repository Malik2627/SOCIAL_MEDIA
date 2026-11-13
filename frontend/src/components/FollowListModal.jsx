import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FollowButton from './FollowButton.jsx';
import { getUserFollowers, getUserFollowing } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';

function getUserInitial(u) {
  const source = u?.name || u?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

export default function FollowListModal({
  isOpen,
  type = 'followers',
  userId,
  onClose,
}) {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id || currentUser?.id;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isFollowers = type === 'followers';
  const title = isFollowers ? 'Followers' : 'Following';

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    async function fetchList() {
      try {
        const response = isFollowers
          ? await getUserFollowers(userId)
          : await getUserFollowing(userId);

        const items = isFollowers
          ? response?.data?.followers
          : response?.data?.following;

        if (isMounted) {
          setList(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(getSafeErrorMessage(err, `Failed to load ${type}.`));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchList();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, isFollowers, type]);

  if (!isOpen) return null;

  return (
    <div
      className="follow-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-modal-title"
    >
      <div
        className="follow-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="follow-modal-header">
          <h2 id="follow-modal-title" className="follow-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="follow-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        {error && (
          <div className="auth-banner-error follow-modal-banner" role="alert">
            {error}
          </div>
        )}

        <div className="follow-modal-body">
          {loading ? (
            <div className="follow-modal-state" aria-busy="true">
              <span className="comment-spinner" aria-hidden="true" />
              <span>Loading {title.toLowerCase()}...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="follow-modal-empty">
              {isFollowers
                ? 'No followers yet.'
                : 'Not following anyone yet.'}
            </div>
          ) : (
            <ul className="follow-modal-list">
              {list.map((item) => {
                const isSelf = Boolean(
                  currentUserId &&
                    item?._id &&
                    currentUserId.toString() === item._id.toString()
                );
                const itemProfileUrl = isSelf
                  ? '/profile'
                  : item?.username
                  ? `/profile/${item.username}`
                  : '/profile';

                return (
                  <li key={item._id} className="follow-modal-item">
                    <div className="follow-modal-user-info">
                      <Link
                        to={itemProfileUrl}
                        onClick={onClose}
                        className="follow-modal-avatar-link"
                        aria-label={`View ${item.name || 'user'}'s profile`}
                      >
                        {item.profilePicture ? (
                          <img
                            src={item.profilePicture}
                            alt={item.name || item.username || 'User avatar'}
                            className="follow-modal-avatar"
                          />
                        ) : (
                          <span className="follow-modal-avatar-fallback">
                            {getUserInitial(item)}
                          </span>
                        )}
                      </Link>

                      <div className="follow-modal-names">
                        <Link
                          to={itemProfileUrl}
                          onClick={onClose}
                          className="follow-modal-name-link"
                        >
                          <span className="follow-modal-name">
                            {item.name || 'Unnamed User'}
                          </span>
                        </Link>
                        {item.username && (
                          <Link
                            to={itemProfileUrl}
                            onClick={onClose}
                            className="follow-modal-handle-link"
                          >
                            <span className="follow-modal-handle">
                              @{item.username}
                            </span>
                          </Link>
                        )}
                        {item.bio && (
                          <p className="follow-modal-bio">{item.bio}</p>
                        )}
                      </div>
                    </div>

                    <FollowButton targetUserId={item._id} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

