function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Message({ message, isOwn }) {
  if (!message) return null;

  return (
    <div
      className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'}`}
      role="listitem"
    >
      <div className="chat-message-bubble">
        <p className="chat-message-text">{message.content}</p>
        <div className="chat-message-meta">
          <time className="chat-message-time" dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>
          {isOwn && (
            <span
              className={`chat-message-status ${
                message.read ? 'chat-message-status--read' : 'chat-message-status--sent'
              }`}
              title={message.read ? 'Read' : 'Sent'}
              aria-label={message.read ? 'Read' : 'Sent'}
            >
              {message.read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

