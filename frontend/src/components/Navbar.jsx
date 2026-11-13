import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { getConversations, getNotifications } from '../services/api.js';

const UPCOMING_NAV_ITEMS = [];

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isConnected, socket } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setUnreadCount(0);
      setUnreadMessagesCount(0);
      return;
    }

    async function fetchUnread() {
      try {
        const res = await getNotifications();
        if (isMounted && typeof res?.data?.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        }
      } catch {
        // Silently ignore background failure
      }

      try {
        const convRes = await getConversations();
        const convs = convRes?.data?.conversations || [];
        const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (isMounted) {
          setUnreadMessagesCount(total);
        }
      } catch {
        // Silently ignore background failure
      }
    }

    fetchUnread();

    function handleCountChange(e) {
      if (typeof e.detail?.unreadCount === 'number') {
        setUnreadCount(e.detail.unreadCount);
      }
    }

    function handleMessagesCountChange(e) {
      if (typeof e.detail?.unreadCount === 'number') {
        setUnreadMessagesCount(e.detail.unreadCount);
      }
    }

    window.addEventListener('notifications-count-change', handleCountChange);
    window.addEventListener('messages-count-change', handleMessagesCountChange);
    return () => {
      isMounted = false;
      window.removeEventListener('notifications-count-change', handleCountChange);
      window.removeEventListener('messages-count-change', handleMessagesCountChange);
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    function handleNewNotification({ notification, unreadCount: count }) {
      if (typeof count === 'number') {
        setUnreadCount(count);
      } else {
        setUnreadCount((prev) => prev + 1);
      }

      if (notification) {
        const isMessagesPage =
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/messages');
        if (notification.type === 'MESSAGE' && isMessagesPage) {
          return;
        }

        setToast(notification);
        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
          setToast(null);
          toastTimerRef.current = null;
        }, 5000);
      }
    }

    function handleCountUpdated({ unreadCount: count }) {
      if (typeof count === 'number') {
        setUnreadCount(count);
      }
    }

    socket.on('newNotification', handleNewNotification);
    socket.on('notificationCountUpdated', handleCountUpdated);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('notificationCountUpdated', handleCountUpdated);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [socket]);

  const displayName = user?.username ? `@${user.username}` : user?.name || 'Member';
  const avatarAlt = `${user?.name || user?.username || 'User'} avatar`;

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        <div className="navbar-top-row">
          <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
            <span className="navbar-logo-mark" aria-hidden="true">
              SM
            </span>
            <span className="navbar-brand-text">Social Media</span>
          </Link>

          <button
            type="button"
            className="navbar-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={`navbar-nav-panel${menuOpen ? ' navbar-nav-panel--open' : ''}`}
        >
          <ul className="navbar-links">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Home
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Search
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/messages"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span>Messages</span>
                {unreadMessagesCount > 0 && (
                  <span
                    className="navbar-badge"
                    aria-label={`${unreadMessagesCount} unread messages`}
                  >
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="navbar-badge" aria-label={`${unreadCount} unread notifications`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </NavLink>
            </li>

            {UPCOMING_NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="navbar-link navbar-link--disabled"
                  disabled
                  aria-disabled="true"
                  title={`${item.label} (coming soon)`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="navbar-user-area">
            {user && (
              <div className="navbar-user-chip">
                <div className="navbar-avatar-wrapper">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={avatarAlt}
                      className="navbar-avatar-img"
                    />
                  ) : (
                    <span className="navbar-avatar-fallback" aria-hidden="true">
                      {getUserInitial(user)}
                    </span>
                  )}
                  <span
                    className={`navbar-status-dot ${
                      isConnected ? 'navbar-status-dot--online' : 'navbar-status-dot--offline'
                    }`}
                    title={isConnected ? 'Connected (Online)' : 'Connecting / Offline'}
                    aria-label={isConnected ? 'Connected (Online)' : 'Connecting / Offline'}
                  />
                </div>
                <span className="navbar-username">{displayName}</span>
              </div>
            )}

            <button
              type="button"
              className="navbar-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </nav>
      </div>

      {toast && (
        <div className="navbar-toast" role="alert" aria-live="polite">
          <Link
            to="/notifications"
            className="navbar-toast-content"
            onClick={() => setToast(null)}
          >
            <span className="navbar-toast-icon" aria-hidden="true">
              {toast.type === 'LIKE'
                ? '❤️'
                : toast.type === 'COMMENT'
                ? '💬'
                : toast.type === 'FOLLOW'
                ? '👤'
                : '📩'}
            </span>
            <div className="navbar-toast-body">
              <strong className="navbar-toast-sender">
                {toast.sender?.name || toast.sender?.username || 'Someone'}
              </strong>{' '}
              <span className="navbar-toast-msg">{toast.message}</span>
            </div>
          </Link>
          <button
            type="button"
            className="navbar-toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification preview"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}

