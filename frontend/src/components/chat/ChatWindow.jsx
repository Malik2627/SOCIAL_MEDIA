import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Message from './Message.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

function getUserInitial(user) {
  const source = user?.name || user?.username || 'U';
  return source.trim().charAt(0).toUpperCase() || 'U';
}

export default function ChatWindow({
  conversation,
  currentUser,
  messages,
  isTyping,
  typingUser,
  loadingMessages,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onBack,
}) {
  const { isUserOnline } = useSocket();
  const messagesEndRef = useRef(null);

  const currentUserId = (currentUser?._id || currentUser?.id)?.toString();

  const otherUser = conversation?.participants?.find(
    (p) => (p?._id || p?.id || p).toString() !== currentUserId
  );

  const otherUserId = otherUser?._id || otherUser?.id;
  const isOnline = isUserOnline(otherUserId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!conversation) {
    return (
      <div className="chat-window-empty">
        <div className="chat-window-empty-content">
          <span className="chat-window-empty-icon" aria-hidden="true">
            💬
          </span>
          <h2 className="chat-window-empty-title">Select a conversation</h2>
          <p className="chat-window-empty-subtitle">
            Choose a conversation from the left or search for a member to start chatting.
          </p>
        </div>
      </div>
    );
  }

  const profileUrl = otherUser?.username ? `/profile/${otherUser.username}` : '#';

  return (
    <div className="chat-window" aria-label="Conversation window">
      <header className="chat-window-header">
        {onBack && (
          <button
            type="button"
            className="chat-back-btn"
            onClick={onBack}
            aria-label="Back to conversations list"
          >
            ← Back
          </button>
        )}

        <div className="chat-header-user-info">
          <Link to={profileUrl} className="chat-header-avatar-link">
            {otherUser?.profilePicture ? (
              <img
                src={otherUser.profilePicture}
                alt={otherUser.name || otherUser.username || 'User avatar'}
                className="chat-header-avatar"
              />
            ) : (
              <span className="chat-header-avatar-fallback">
                {getUserInitial(otherUser)}
              </span>
            )}
            <span
              className={`chat-header-status-dot ${
                isOnline ? 'chat-header-status-dot--online' : 'chat-header-status-dot--offline'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
              aria-label={isOnline ? 'Online' : 'Offline'}
            />
          </Link>

          <div className="chat-header-names">
            <Link to={profileUrl} className="chat-header-name-link">
              <h2 className="chat-header-name">{otherUser?.name || 'Member'}</h2>
            </Link>
            <div className="chat-header-status-line">
              {otherUser?.username && (
                <span className="chat-header-handle">@{otherUser.username}</span>
              )}
              <span className="chat-header-separator">•</span>
              <span
                className={`chat-header-online-text ${
                  isOnline ? 'chat-header-online-text--online' : 'chat-header-online-text--offline'
                }`}
              >
                {isOnline ? 'Active now' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="chat-messages-container" role="list">
        {loadingMessages ? (
          <div className="chat-messages-loading">
            <span className="chat-spinner" aria-hidden="true" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-messages-empty-state">
            <p>No messages here yet.</p>
            <p className="chat-messages-empty-hint">Say hi to start the conversation!</p>
          </div>
        ) : (
          messages.map((m) => {
            const senderId = (m.sender?._id || m.sender?.id || m.sender)?.toString();
            const isOwn = senderId === currentUserId;
            return <Message key={m._id || m.id} message={m} isOwn={isOwn} />;
          })
        )}
        <TypingIndicator isTyping={isTyping} typingUser={typingUser} />
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-window-footer">
        <MessageInput
          onSendMessage={onSendMessage}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          disabled={loadingMessages}
        />
      </footer>
    </div>
  );
}

