import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { followUser, unfollowUser } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/profile.css';

export default function FollowButton({
  targetUserId,
  initialIsFollowing,
  onFollowChange,
  className = '',
  size = 'md',
}) {
  const { user, updateFollowing } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const currentUserId = user?._id || user?.id;
  const targetIdStr = targetUserId
    ? (targetUserId?._id || targetUserId?.id || targetUserId).toString()
    : '';

  // Determine whether current user is following target user
  const contextIsFollowing = Boolean(
    currentUserId &&
      targetIdStr &&
      Array.isArray(user?.following) &&
      user.following.some(
        (f) => (f?._id || f?.id || f).toString() === targetIdStr
      )
  );

  const [isFollowing, setIsFollowing] = useState(
    typeof initialIsFollowing === 'boolean'
      ? initialIsFollowing
      : contextIsFollowing
  );

  useEffect(() => {
    if (typeof initialIsFollowing === 'boolean') {
      setIsFollowing(initialIsFollowing);
    } else {
      setIsFollowing(contextIsFollowing);
    }
  }, [contextIsFollowing, initialIsFollowing]);

  // Rule 1: Never render follow button for yourself or when target is invalid
  if (!targetIdStr || !currentUserId || currentUserId.toString() === targetIdStr) {
    return null;
  }

  async function handleToggleFollow(e) {
    e.stopPropagation();
    if (isLoading || !targetIdStr) return;

    const previousFollowing = isFollowing;
    const nextFollowing = !previousFollowing;

    // Optimistic update
    setIsFollowing(nextFollowing);
    updateFollowing?.(targetIdStr, nextFollowing);
    setIsLoading(true);
    setError('');

    try {
      let response;
      if (nextFollowing) {
        response = await followUser(targetIdStr);
      } else {
        response = await unfollowUser(targetIdStr);
      }

      const serverIsFollowing = response?.data?.isFollowing;
      const followersCount = response?.data?.followersCount;

      if (typeof serverIsFollowing === 'boolean') {
        setIsFollowing(serverIsFollowing);
        updateFollowing?.(targetIdStr, serverIsFollowing);
      }

      if (typeof onFollowChange === 'function') {
        onFollowChange({
          targetUserId: targetIdStr,
          isFollowing: typeof serverIsFollowing === 'boolean' ? serverIsFollowing : nextFollowing,
          followersCount,
          data: response?.data,
        });
      }
    } catch (err) {
      // Rollback optimistic update
      setIsFollowing(previousFollowing);
      updateFollowing?.(targetIdStr, previousFollowing);
      setError(getSafeErrorMessage(err, 'Failed to update follow status.'));
    } finally {
      setIsLoading(false);
    }
  }

  const buttonText = isFollowing
    ? isHovered
      ? 'Unfollow'
      : 'Following'
    : 'Follow';

  return (
    <div className="follow-btn-container">
      <button
        type="button"
        className={`follow-btn follow-btn--${size}${
          isFollowing ? ' follow-btn--following' : ' follow-btn--not-following'
        } ${className}`.trim()}
        onClick={handleToggleFollow}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        aria-label={
          isFollowing
            ? `Unfollow user`
            : `Follow user`
        }
        aria-pressed={isFollowing}
      >
        {isLoading ? '...' : buttonText}
      </button>
      {error && (
        <span className="follow-btn-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
