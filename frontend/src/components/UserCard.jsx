import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import FollowButton from './FollowButton.jsx';

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

export default function UserCard({ user, onFollowChange }) {
  const { user: currentUser } = useAuth();
  const { isUserOnline } = useSocket();

  const currentUserId = currentUser?._id || currentUser?.id;
  const targetId = user?._id || user?.id;
  const isSelf = Boolean(
    currentUserId &&
      targetId &&
      currentUserId.toString() === targetId.toString()
  );
  const isOnline = isUserOnline(targetId);

  const profileUrl = isSelf ? '/profile' : `/profile/${user?.username || targetId}`;

  const initialFollowers = typeof user?.followersCount === 'number'
    ? user.followersCount
    : Array.isArray(user?.followers)
    ? user.followers.length
    : 0;

  const followingCount = typeof user?.followingCount === 'number'
    ? user.followingCount
    : Array.isArray(user?.following)
    ? user.following.length
    : 0;

  const [followersCount, setFollowersCount] = useState(initialFollowers);

  useEffect(() => {
    setFollowersCount(initialFollowers);
  }, [initialFollowers]);

  function handleFollowToggle({ isFollowing, followersCount: serverCount }) {
    if (typeof serverCount === 'number') {
      setFollowersCount(serverCount);
    } else {
      setFollowersCount((prev) => (isFollowing ? prev + 1 : Math.max(0, prev - 1)));
    }
    if (typeof onFollowChange === 'function') {
      onFollowChange({ userId: targetId, isFollowing });
    }
  }

  return (
    <article className="user-card" aria-label={`User ${user?.name || user?.username || 'Profile'}`}>
      <div className="user-card-content">
        <Link to={profileUrl} className="user-card-avatar-link" aria-hidden="true" tabIndex={-1}>
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name || user.username || 'User avatar'}
              className="user-card-avatar"
            />
          ) : (
            <span className="user-card-avatar-fallback">
              {getUserInitial(user)}
            </span>
          )}
          {isOnline && (
            <span
              className="user-online-badge"
              title="Online"
              aria-label="Online"
            />
          )}
        </Link>

        <div className="user-card-info">
          <div className="user-card-header">
            <Link to={profileUrl} className="user-card-name-link">
              <h3 className="user-card-name">{user?.name || 'Unnamed Member'}</h3>
            </Link>
            {user?.username && (
              <span className="user-card-handle">@{user.username}</span>
            )}
            {isOnline && (
              <span className="online-indicator-pill" aria-label="User is online">
                Online
              </span>
            )}
          </div>

          {user?.bio && (
            <p className="user-card-bio">{user.bio}</p>
          )}

          <div className="user-card-stats">
            <span className="user-card-stat">
              <strong>{followersCount}</strong> {followersCount === 1 ? 'follower' : 'followers'}
            </span>
            <span className="user-card-stat-dot">•</span>
            <span className="user-card-stat">
              <strong>{followingCount}</strong> following
            </span>
          </div>
        </div>
      </div>

      {!isSelf && targetId && (
        <div className="user-card-actions">
          <FollowButton
            targetUserId={targetId}
            onFollowChange={handleFollowToggle}
            size="sm"
          />
        </div>
      )}
    </article>
  );
}

