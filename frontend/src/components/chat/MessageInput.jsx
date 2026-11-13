import { useEffect, useRef, useState } from 'react';

const TYPING_TIMEOUT_MS = 2000;

export default function MessageInput({ onSendMessage, onTypingStart, onTypingStop, disabled }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef(null);

  function stopTypingImmediately() {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  }

  function handleTextChange(e) {
    const nextVal = e.target.value;
    setText(nextVal);

    if (nextVal.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart?.();
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStop?.();
        typingTimerRef.current = null;
      }, TYPING_TIMEOUT_MS);
    } else {
      stopTypingImmediately();
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    stopTypingImmediately();
    setSending(true);

    try {
      await onSendMessage(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        className="chat-input-textarea"
        placeholder="Type a message... (Press Enter to send)"
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        rows={1}
        maxLength={2000}
        aria-label="Message input"
      />
      <button
        type="submit"
        className="chat-input-send-btn"
        disabled={disabled || sending || !text.trim()}
        aria-label="Send message"
      >
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}

