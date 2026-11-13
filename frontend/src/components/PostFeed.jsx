import { useCallback, useEffect, useState } from 'react';
import CreatePost from './CreatePost.jsx';
import PostCard from './PostCard.jsx';
import { getPosts } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/posts.css';

export default function PostFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchFeed = useCallback(async (isActive = () => true) => {
    try {
      const response = await getPosts();
      if (!isActive()) return;

      const fetchedPosts = Array.isArray(response?.data?.posts)
        ? response.data.posts
        : [];

      setPosts(fetchedPosts);
      setError('');
    } catch (err) {
      if (!isActive()) return;
      setError(getSafeErrorMessage(err, 'Unable to load posts at this time.'));
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadInitialFeed() {
      await fetchFeed(() => mounted);
    }

    loadInitialFeed();

    return () => {
      mounted = false;
    };
  }, [fetchFeed]);

  function handleRetry() {
    setLoading(true);
    setError('');
    fetchFeed();
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    try {
      const response = await getPosts();
      const fetchedPosts = Array.isArray(response?.data?.posts)
        ? response.data.posts
        : [];
      setPosts(fetchedPosts);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Unable to refresh posts.'));
    } finally {
      setRefreshing(false);
    }
  }

  function handlePostCreated(newPost) {
    if (newPost && newPost._id) {
      setPosts((prev) => [newPost, ...prev]);
    }
  }

  function handlePostUpdated(updatedPost) {
    if (!updatedPost || !updatedPost._id) return;
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  }

  function handlePostDeleted(deletedPostId) {
    if (!deletedPostId) return;
    setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));
  }

  return (
    <section className="post-feed-container" aria-label="Social Feed">
      <CreatePost onPostCreated={handlePostCreated} />

      <div className="feed-header-bar">
        <h2 className="feed-title">Feed Updates</h2>
        <button
          type="button"
          className="feed-refresh-btn"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh feed posts"
          title="Refresh feed posts"
        >
          <span
            className={`feed-refresh-icon${refreshing ? ' feed-refresh-icon--spinning' : ''}`}
            aria-hidden="true"
          >
            ↻
          </span>
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {loading ? (
        <div
          className="post-skeleton-feed"
          aria-busy="true"
          aria-live="polite"
          aria-label="Loading feed posts"
        >
          {[1, 2, 3].map((n) => (
            <div key={n} className="post-card post-skeleton-card">
              <div className="post-skeleton-header">
                <div className="post-skeleton-avatar skeleton-shimmer" />
                <div className="post-skeleton-meta">
                  <div className="post-skeleton-line post-skeleton-line--title skeleton-shimmer" />
                  <div className="post-skeleton-line post-skeleton-line--subtitle skeleton-shimmer" />
                </div>
              </div>
              <div className="post-skeleton-body">
                <div className="post-skeleton-line post-skeleton-line--full skeleton-shimmer" />
                <div className="post-skeleton-line post-skeleton-line--partial skeleton-shimmer" />
              </div>
              <div className="post-skeleton-footer">
                <div className="post-skeleton-pill skeleton-shimmer" />
                <div className="post-skeleton-pill skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="profile-card profile-state-card">
          <div className="auth-banner-error" role="alert">
            {error}
          </div>
          <button
            type="button"
            className="auth-btn auth-btn--primary profile-retry-btn"
            onClick={handleRetry}
          >
            Try Again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="post-empty-state" role="status">
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="post-feed-list" role="feed" aria-label="Posts stream">
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
  );
}

