export default function TypingIndicator({ isTyping, typingUser }) {
  if (!isTyping) return null;

  return (
    <div className="chat-typing-indicator" role="status" aria-live="polite">
      <div className="chat-typing-bubble">
        <span className="chat-typing-dots" aria-hidden="true">
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
        </span>
        <span className="chat-typing-text">
          {typingUser ? `${typingUser} is typing...` : 'Typing...'}
        </span>
      </div>
    </div>
  );
}

