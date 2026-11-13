import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { searchUsers } from '../../services/api.js';

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

function formatConversationTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ConversationList({
  conversations,
  activeConversationId,
  currentUser,
  onSelectConversation,
  onStartConversationWithUser,
  loading,
}) {
  const { isUserOnline } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  const currentUserId = (currentUser?._id || currentUser?.id)?.toString();

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchUsers(trimmed);
        const users = res?.data?.users || [];
        setSearchResults(
          users.filter(
            (u) => (u._id || u.id)?.toString() !== currentUserId
          )
        );
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, currentUserId]);

  function handleSelectSearchResult(user) {
    setSearchQuery('');
    setSearchResults([]);
    onStartConversationWithUser(user);
  }

  return (
    <aside className="chat-conversation-sidebar" aria-label="Messages conversations list">
      <div className="chat-sidebar-header">
        <h1 className="chat-sidebar-title">Messages</h1>
        <div className="chat-search-wrap">
          <input
            type="search"
            className="chat-search-input"
            placeholder="Search members to chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search members to message"
          />
          {searchQuery && (
            <button
              type="button"
              className="chat-search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="chat-conversation-items" role="list">
        {searchQuery.trim() ? (
          <div className="chat-search-results">
            <div className="chat-search-results-header">Search Results</div>
            {isSearching ? (
              <div className="chat-search-state">Searching members...</div>
            ) : searchResults.length === 0 ? (
              <div className="chat-search-state">No members found matching &quot;{searchQuery}&quot;</div>
            ) : (
              searchResults.map((user) => {
                const userId = user._id || user.id;
                const online = isUserOnline(userId);
                return (
                  <button
                    key={userId}
                    type="button"
                    className="chat-conversation-item chat-search-result-item"
                    onClick={() => handleSelectSearchResult(user)}
                  >
                    <div className="chat-item-avatar-wrap">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.name || user.username || 'User avatar'}
                          className="chat-item-avatar"
                        />
                      ) : (
                        <span className="chat-item-avatar-fallback">
                          {getUserInitial(user)}
                        </span>
                      )}
                      <span
                        className={`chat-item-status-dot ${
                          online ? 'chat-item-status-dot--online' : 'chat-item-status-dot--offline'
                        }`}
                        title={online ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div className="chat-item-info">
                      <div className="chat-item-header">
                        <span className="chat-item-name">{user.name || 'Member'}</span>
                      </div>
                      <span className="chat-item-handle">@{user.username}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : loading ? (
          <div className="chat-conversations-loading">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="chat-conversations-empty">
            <p>No conversations yet.</p>
            <p className="chat-conversations-empty-hint">
              Search above or visit a member&apos;s profile to start chatting.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const otherUser = conv.participants?.find(
              (p) => (p?._id || p?.id || p).toString() !== currentUserId
            );
            const otherUserId = otherUser?._id || otherUser?.id;
            const online = isUserOnline(otherUserId);
            const isActive = conv._id === activeConversationId;
            const unread = conv.unreadCount || 0;

            const lastMsg = conv.lastMessage;
            const lastMsgPreview = lastMsg?.content || 'No messages yet';
            const lastMsgTime = formatConversationTime(
              lastMsg?.createdAt || conv.updatedAt
            );

            return (
              <button
                key={conv._id}
                type="button"
                className={`chat-conversation-item ${
                  isActive ? 'chat-conversation-item--active' : ''
                } ${unread > 0 ? 'chat-conversation-item--unread' : ''}`}
                onClick={() => onSelectConversation(conv)}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="chat-item-avatar-wrap">
                  {otherUser?.profilePicture ? (
                    <img
                      src={otherUser.profilePicture}
                      alt={otherUser.name || otherUser.username || 'User avatar'}
                      className="chat-item-avatar"
                    />
                  ) : (
                    <span className="chat-item-avatar-fallback">
                      {getUserInitial(otherUser)}
                    </span>
                  )}
                  <span
                    className={`chat-item-status-dot ${
                      online ? 'chat-item-status-dot--online' : 'chat-item-status-dot--offline'
                    }`}
                    title={online ? 'Online' : 'Offline'}
                  />
                </div>

                <div className="chat-item-info">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{otherUser?.name || 'Member'}</span>
                    {lastMsgTime && (
                      <span className="chat-item-time">{lastMsgTime}</span>
                    )}
                  </div>
                  <div className="chat-item-footer">
                    <span className="chat-item-preview">{lastMsgPreview}</span>
                    {unread > 0 && (
                      <span className="chat-item-unread-badge" aria-label={`${unread} unread messages`}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

