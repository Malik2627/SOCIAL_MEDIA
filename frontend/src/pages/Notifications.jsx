import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';
import '../styles/notifications.css';

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function formatNotificationTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function notifyBadge(count) {
  window.dispatchEvent(
    new CustomEvent('notifications-count-change', {
      detail: { unreadCount: count },
    })
  );
}

export default function Notifications() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;

    function handleNewNotification({ notification, unreadCount: count }) {
      if (!notification?._id) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === notification._id)) {
          return prev;
        }
        return [notification, ...prev];
      });

      if (typeof count === 'number') {
        setUnreadCount(count);
        notifyBadge(count);
      } else {
        setUnreadCount((c) => {
          const next = c + 1;
          notifyBadge(next);
          return next;
        });
      }
    }

    function handleCountUpdated({ unreadCount: count }) {
      if (typeof count === 'number') {
        setUnreadCount(count);
        notifyBadge(count);
      }
    }

    socket.on('newNotification', handleNewNotification);
    socket.on('notificationCountUpdated', handleCountUpdated);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('notificationCountUpdated', handleCountUpdated);
    };
  }, [socket]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    async function loadNotifications() {
      try {
        const response = await getNotifications();
        const list = Array.isArray(response?.data?.notifications)
          ? response.data.notifications
          : [];
        const count = typeof response?.data?.unreadCount === 'number'
          ? response.data.unreadCount
          : list.filter((n) => !n.read).length;

        if (isMounted) {
          setNotifications(list);
          setUnreadCount(count);
          notifyBadge(count);
        }
      } catch (err) {
        if (isMounted) {
          setError(getSafeErrorMessage(err, 'Failed to load notifications.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleMarkAllAsRead() {
    if (markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    setError('');

    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      notifyBadge(0);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to mark notifications as read.'));
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkSingleRead(notifId) {
    if (markingId || !notifId) return;

    setMarkingId(notifId);

    try {
      const response = await markNotificationRead(notifId);
      const serverUnread = response?.data?.unreadCount;

      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, read: true } : n))
      );

      const nextCount = typeof serverUnread === 'number'
        ? serverUnread
        : Math.max(0, unreadCount - 1);

      setUnreadCount(nextCount);
      notifyBadge(nextCount);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to update notification.'));
    } finally {
      setMarkingId(null);
    }
  }

  function renderNotificationText(notif) {
    const senderName = notif.sender?.name || notif.sender?.username || 'Someone';

    switch (notif.type) {
      case 'LIKE':
        return (
          <>
            <strong>{senderName}</strong> liked your post.
          </>
        );
      case 'COMMENT':
        return (
          <>
            <strong>{senderName}</strong> commented on your post.
          </>
        );
      case 'FOLLOW':
        return (
          <>
            <strong>{senderName}</strong> started following you.
          </>
        );
      case 'MESSAGE':
        return (
          <>
            <strong>{senderName}</strong> sent you a message.
          </>
        );
      default:
        return (
          <>
            <strong>{senderName}</strong> {notif.message || 'interacted with you.'}
          </>
        );
    }
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'LIKE':
        return '❤️';
      case 'COMMENT':
        return '💬';
      case 'FOLLOW':
        return '👤';
      case 'MESSAGE':
        return '✉️';
      default:
        return '🔔';
    }
  }

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div>
          <h1 className="notifications-title">Notifications</h1>
          <p className="notifications-subtitle">
            {unreadCount > 0
              ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}.`
              : 'Stay up to date with activity on your profile and posts.'}
          </p>
        </div>

        <button
          type="button"
          className="auth-btn auth-btn--secondary notifications-mark-all-btn"
          onClick={handleMarkAllAsRead}
          disabled={markingAll || unreadCount === 0 || loading}
          aria-label="Mark all notifications as read"
        >
          {markingAll ? 'Marking...' : 'Mark all as read'}
        </button>
      </header>

      {error && (
        <div className="auth-banner-error notifications-banner" role="alert">
          {error}
        </div>
      )}

      <main className="notifications-container" aria-live="polite">
        {loading ? (
          <div className="notifications-state notifications-state--loading" aria-busy="true">
            <span className="comment-spinner" aria-hidden="true" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state notifications-state--empty">
            <span className="notifications-state-icon" aria-hidden="true">
              🔔
            </span>
            <h3>No notifications yet</h3>
            <p>
              When people like your posts, leave comments, or start following you,
              you'll see them right here.
            </p>
          </div>
        ) : (
          <div className="notifications-list" role="feed" aria-label="Notifications list">
            {notifications.map((notif) => {
              const sender = notif.sender || {};
              const senderProfileUrl = sender.username
                ? `/profile/${sender.username}`
                : '/profile';
              const isUnread = !notif.read;

              return (
                <article
                  key={notif._id}
                  className={`notification-item${isUnread ? ' notification-item--unread' : ''}`}
                >
                  <div className="notification-main">
                    <Link
                      to={senderProfileUrl}
                      className="notification-avatar-link"
                      aria-label={`View ${sender.name || 'user'}'s profile`}
                    >
                      {sender.profilePicture ? (
                        <img
                          src={sender.profilePicture}
                          alt={sender.name || sender.username || 'User avatar'}
                          className="notification-avatar"
                        />
                      ) : (
                        <span className="notification-avatar-fallback">
                          {getUserInitial(sender)}
                        </span>
                      )}
                      <span className="notification-type-badge" aria-hidden="true">
                        {getNotificationIcon(notif.type)}
                      </span>
                    </Link>

                    <div className="notification-content">
                      <p className="notification-message">
                        {renderNotificationText(notif)}
                      </p>

                      {notif.post?.content && (
                        <p className="notification-post-snippet">
                          "{notif.post.content.length > 90
                            ? `${notif.post.content.slice(0, 90)}...`
                            : notif.post.content}"
                        </p>
                      )}

                      <div className="notification-meta">
                        <time dateTime={notif.createdAt}>
                          {formatNotificationTime(notif.createdAt)}
                        </time>
                        {isUnread && (
                          <span className="notification-unread-dot" aria-hidden="true">
                            • Unread
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      className="notification-mark-btn"
                      onClick={() => handleMarkSingleRead(notif._id)}
                      disabled={markingId === notif._id}
                      aria-label="Mark notification as read"
                      title="Mark as read"
                    >
                      {markingId === notif._id ? '...' : 'Mark read'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

