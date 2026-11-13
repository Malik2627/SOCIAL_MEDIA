import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import FollowButton from '../components/FollowButton.jsx';
import FollowListModal from '../components/FollowListModal.jsx';
import PostCard from '../components/PostCard.jsx';
import { getPublicProfile, getUserPosts } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/profile.css';
import '../styles/posts.css';

function getInitials(u) {
  const source = u?.name || u?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function formatJoinedDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicProfile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const { isUserOnline } = useSocket();

  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'followers',
  });

  const isOwnProfile = Boolean(
    currentUser?.username &&
      username &&
      currentUser.username.toLowerCase() === username.toLowerCase()
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setPostsLoading(true);
    setError('');
    setIsNotFound(false);

    async function fetchProfileData() {
      if (!username) return;

      try {
        const profileRes = await getPublicProfile(username);
        const fetchedUser = profileRes?.data?.user;

        if (!fetchedUser) {
          throw new Error('Profile response was empty');
        }

        if (isMounted) {
          setProfileUser(fetchedUser);
          setFollowersCount(
            typeof fetchedUser.followersCount === 'number'
              ? fetchedUser.followersCount
              : Array.isArray(fetchedUser.followers)
              ? fetchedUser.followers.length
              : 0
          );
          setLoading(false);
        }

        // Fetch user posts
        try {
          const postsRes = await getUserPosts(username);
          const postList = Array.isArray(postsRes?.data?.posts)
            ? postsRes.data.posts
            : [];
          if (isMounted) {
            setPosts(postList);
          }
        } catch (postErr) {
          console.warn('[PublicProfile] Failed to fetch posts:', postErr?.message);
        } finally {
          if (isMounted) {
            setPostsLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          if (err?.response?.status === 404) {
            setIsNotFound(true);
          } else {
            setError(getSafeErrorMessage(err, 'Failed to load profile.'));
          }
          setLoading(false);
          setPostsLoading(false);
        }
      }
    }

    fetchProfileData();

    return () => {
      isMounted = false;
    };
  }, [username]);

  function handleFollowChange({ isFollowing, followersCount: newCount }) {
    if (typeof newCount === 'number') {
      setFollowersCount(newCount);
    } else {
      setFollowersCount((prev) => (isFollowing ? prev + 1 : Math.max(0, prev - 1)));
    }
  }

  function handlePostUpdated(updatedPost) {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  }

  function handlePostDeleted(deletedPostId) {
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  }

  if (loading) {
    return (
      <div className="profile-page">
        <section className="profile-card profile-state-card" aria-busy="true">
          <span className="comment-spinner" aria-hidden="true" />
          <p className="auth-subtitle">Loading profile...</p>
        </section>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="profile-page">
        <section className="profile-card profile-state-card">
          <span className="search-state-icon" aria-hidden="true">
            👤
          </span>
          <h2 className="profile-name">User Not Found</h2>
          <p className="auth-subtitle">
            We couldn't find a member with the handle @{username}. They may have
            changed their username or the account doesn't exist.
          </p>
          <div className="profile-not-found-actions">
            <Link to="/search" className="auth-btn auth-btn--primary">
              Search Members
            </Link>
            <Link to="/" className="auth-btn auth-btn--secondary">
              Back to Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (error && !profileUser) {
    return (
      <div className="profile-page">
        <section className="profile-card profile-state-card">
          <div className="auth-banner-error" role="alert">
            {error}
          </div>
          <button
            type="button"
            className="auth-btn auth-btn--primary profile-retry-btn"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </section>
      </div>
    );
  }

  const followingCount = Array.isArray(profileUser?.following)
    ? profileUser.following.length
    : 0;
  const joinedText = formatJoinedDate(profileUser?.createdAt);

  return (
    <div className="profile-page">
      {error && (
        <div className="auth-banner-error" role="alert">
          {error}
        </div>
      )}

      {/* Profile Header Card */}
      <section className="profile-card" aria-labelledby="public-profile-heading">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            {profileUser?.profilePicture ? (
              <img
                src={profileUser.profilePicture}
                alt={`${profileUser.name || profileUser.username}'s profile`}
                className="profile-avatar-img"
              />
            ) : (
              <span className="profile-avatar-fallback" aria-hidden="true">
                {getInitials(profileUser)}
              </span>
            )}
            {isUserOnline(profileUser?._id) && (
              <span
                className="profile-avatar-online-dot"
                title="Online"
                aria-label="Online"
              />
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-identity-top">
              <div>
                <h1 id="public-profile-heading" className="profile-name">
                  {profileUser?.name || 'Unnamed Member'}
                  {isUserOnline(profileUser?._id) && (
                    <span className="profile-online-badge" aria-label="User is online">
                      <span className="profile-online-dot" aria-hidden="true" /> Online
                    </span>
                  )}
                </h1>
                <p className="profile-username">@{profileUser?.username}</p>
              </div>

              {isOwnProfile ? (
                <Link to="/profile" className="auth-btn auth-btn--secondary profile-edit-btn">
                  Edit Profile
                </Link>
              ) : (
                <div className="profile-actions-group">
                  <FollowButton
                    targetUserId={profileUser?._id}
                    onFollowChange={handleFollowChange}
                    size="md"
                  />
                  <Link
                    to={`/messages?user=${profileUser?._id}`}
                    className="auth-btn auth-btn--secondary profile-message-btn"
                    aria-label={`Message ${profileUser?.name || profileUser?.username}`}
                  >
                    Message
                  </Link>
                </div>
              )}
            </div>

            {profileUser?.bio && (
              <p className="profile-bio">{profileUser.bio}</p>
            )}

            {joinedText && (
              <p className="profile-joined-text">
                📅 Joined {joinedText}
              </p>
            )}

            <dl className="profile-stats">
              <button
                type="button"
                className="profile-stat-item profile-stat-btn"
                onClick={() =>
                  setModalConfig({ isOpen: true, type: 'followers' })
                }
                aria-label={`View ${followersCount} followers`}
              >
                <dt className="profile-stat-label">Followers</dt>
                <dd className="profile-stat-value">{followersCount}</dd>
              </button>

              <button
                type="button"
                className="profile-stat-item profile-stat-btn"
                onClick={() =>
                  setModalConfig({ isOpen: true, type: 'following' })
                }
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

      {/* User Posts Section */}
      <section className="profile-posts-section" aria-label="User posts">
        <div className="profile-posts-header">
          <h2 className="profile-posts-title">
            {isOwnProfile ? 'Your Posts' : 'Posts'}
          </h2>
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
            <p>
              {isOwnProfile
                ? "You haven't shared any posts yet."
                : `@${profileUser?.username} hasn't posted anything yet.`}
            </p>
            {isOwnProfile && (
              <Link to="/" className="auth-btn auth-btn--primary" style={{ width: 'auto', marginTop: '12px' }}>
                Create Post
              </Link>
            )}
          </div>
        ) : (
          <div className="post-feed-list" role="feed" aria-label="Posts by user">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </div>
        )}
      </section>

      {/* Followers / Following Modal */}
      <FollowListModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        userId={profileUser?._id}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

