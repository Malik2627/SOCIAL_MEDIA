import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import ConversationList from '../components/chat/ConversationList.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import {
  getConversations,
  getMessages,
  getOrCreateConversation,
  markConversationRead,
  sendMessage,
} from '../services/api.js';
import '../styles/messages.css';

export default function Messages() {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const params = useParams();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingState, setTypingState] = useState({ isTyping: false, username: '' });

  // Mobile responsiveness: 'list' or 'chat' view
  const [mobileView, setMobileView] = useState('list');

  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Broadcast unread messages count to Navbar
  const broadcastUnreadCount = useCallback((convList) => {
    const total = convList.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    window.dispatchEvent(
      new CustomEvent('messages-count-change', { detail: { unreadCount: total } })
    );
  }, []);

  // Fetch initial conversations list
  useEffect(() => {
    let isMounted = true;
    async function loadConversations() {
      try {
        const res = await getConversations();
        const list = res?.data?.conversations || [];
        if (isMounted) {
          setConversations(list);
          broadcastUnreadCount(list);
        }
      } catch (err) {
        console.warn('[Messages] Failed to fetch conversations:', err?.message);
      } finally {
        if (isMounted) {
          setLoadingConversations(false);
        }
      }
    }

    loadConversations();
    return () => {
      isMounted = false;
    };
  }, [broadcastUnreadCount]);

  // Handle URL query ?user=<userId> or param :userId to open/create conversation directly
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const targetUserId = params.userId || queryParams.get('user');

    if (!targetUserId || loadingConversations) return;

    let isMounted = true;
    async function openConversationWithUser() {
      try {
        const res = await getOrCreateConversation(targetUserId);
        const conv = res?.data?.conversation;
        if (conv && isMounted) {
          setConversations((prev) => {
            const exists = prev.some((c) => c._id === conv._id);
            const next = exists
              ? prev.map((c) => (c._id === conv._id ? { ...c, ...conv } : c))
              : [conv, ...prev];
            return next;
          });
          setActiveConversation(conv);
          setMobileView('chat');
        }
      } catch (err) {
        console.warn('[Messages] Failed to open conversation with user:', err?.message);
      }
    }

    openConversationWithUser();
    return () => {
      isMounted = false;
    };
  }, [location.search, params.userId, loadingConversations]);

  // Load messages when activeConversation changes
  useEffect(() => {
    if (!activeConversation?._id) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setTypingState({ isTyping: false, username: '' });

    async function loadMessages() {
      try {
        const res = await getMessages(activeConversation._id);
        if (isMounted) {
          setMessages(res?.data?.messages || []);
        }

        // Mark conversation read if it has unread messages
        if (activeConversation.unreadCount > 0) {
          await markConversationRead(activeConversation._id);
          if (isMounted) {
            setConversations((prev) => {
              const updated = prev.map((c) =>
                c._id === activeConversation._id ? { ...c, unreadCount: 0 } : c
              );
              broadcastUnreadCount(updated);
              return updated;
            });
            setActiveConversation((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
          }
        }
      } catch (err) {
        console.warn('[Messages] Failed to load messages:', err?.message);
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [activeConversation?._id, activeConversation?.unreadCount, broadcastUnreadCount]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    function handleNewMessage({ message, conversationId }) {
      if (!message || !conversationId) return;

      const currentActive = activeConversationRef.current;
      const isForActiveConversation = currentActive?._id === conversationId;

      if (isForActiveConversation) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // Automatically mark as read if message is from the other user
        const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
        const senderId = (message.sender?._id || message.sender?.id || message.sender)?.toString();

        if (senderId !== currentUserId) {
          markConversationRead(conversationId).catch(() => {});
        }
      }

      setConversations((prev) => {
        let exists = false;
        const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
        const senderId = (message.sender?._id || message.sender?.id || message.sender)?.toString();
        const isFromOther = senderId !== currentUserId;

        const updated = prev.map((conv) => {
          if (conv._id === conversationId) {
            exists = true;
            const nextUnread =
              isForActiveConversation || !isFromOther
                ? 0
                : (conv.unreadCount || 0) + 1;

            return {
              ...conv,
              lastMessage: message,
              unreadCount: nextUnread,
              updatedAt: message.createdAt || new Date().toISOString(),
            };
          }
          return conv;
        });

        if (!exists) {
          getConversations()
            .then((res) => {
              const list = res?.data?.conversations || [];
              setConversations(list);
              broadcastUnreadCount(list);
            })
            .catch(() => {});
        }

        // Sort conversations by newest activity
        const sorted = [...updated].sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );

        broadcastUnreadCount(sorted);
        return sorted;
      });

      // Clear typing indicator on message arrival
      setTypingState({ isTyping: false, username: '' });
    }

    function handleMessagesRead({ conversationId, readAt }) {
      if (activeConversationRef.current?._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (!m.read ? { ...m, read: true, readAt } : m))
        );
      }
    }

    function handleUserTyping({ conversationId, username }) {
      if (activeConversationRef.current?._id === conversationId) {
        setTypingState({ isTyping: true, username: username || '' });
      }
    }

    function handleUserStopTyping({ conversationId }) {
      if (activeConversationRef.current?._id === conversationId) {
        setTypingState({ isTyping: false, username: '' });
      }
    }

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, currentUser, broadcastUnreadCount]);

  function handleSelectConversation(conv) {
    setActiveConversation(conv);
    setMobileView('chat');
  }

  async function handleStartConversationWithUser(targetUser) {
    const targetId = targetUser?._id || targetUser?.id;
    if (!targetId) return;

    try {
      const res = await getOrCreateConversation(targetId);
      const conv = res?.data?.conversation;
      if (conv) {
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === conv._id);
          return exists ? prev : [conv, ...prev];
        });
        setActiveConversation(conv);
        setMobileView('chat');
      }
    } catch (err) {
      console.warn('[Messages] Failed to start conversation:', err?.message);
    }
  }

  const otherParticipant = activeConversation?.participants?.find(
    (p) =>
      (p?._id || p?.id || p).toString() !==
      (currentUser?._id || currentUser?.id)?.toString()
  );
  const otherUserId = otherParticipant?._id || otherParticipant?.id;

  function handleTypingStart() {
    if (socket && activeConversation?._id && otherUserId) {
      socket.emit('typing', {
        conversationId: activeConversation._id,
        recipientId: otherUserId,
      });
    }
  }

  function handleTypingStop() {
    if (socket && activeConversation?._id && otherUserId) {
      socket.emit('stopTyping', {
        conversationId: activeConversation._id,
        recipientId: otherUserId,
      });
    }
  }

  async function handleSendMessage(content) {
    if (!activeConversation?._id || !otherUserId) return;

    try {
      const res = await sendMessage({
        conversationId: activeConversation._id,
        recipientId: otherUserId,
        content,
      });

      const sentMsg = res?.data?.message;
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === sentMsg._id)) return prev;
          return [...prev, sentMsg];
        });

        setConversations((prev) => {
          const updated = prev.map((c) =>
            c._id === activeConversation._id
              ? {
                  ...c,
                  lastMessage: sentMsg,
                  updatedAt: sentMsg.createdAt || new Date().toISOString(),
                }
              : c
          );
          return [...updated].sort(
            (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
          );
        });
      }
    } catch (err) {
      console.warn('[Messages] Failed to send message:', err?.message);
      throw err;
    }
  }

  return (
    <div className={`chat-layout ${mobileView === 'chat' ? 'chat-layout--mobile-chat' : 'chat-layout--mobile-list'}`}>
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversation?._id}
        currentUser={currentUser}
        onSelectConversation={handleSelectConversation}
        onStartConversationWithUser={handleStartConversationWithUser}
        loading={loadingConversations}
      />
      <ChatWindow
        conversation={activeConversation}
        currentUser={currentUser}
        messages={messages}
        isTyping={typingState.isTyping}
        typingUser={typingState.username}
        loadingMessages={loadingMessages}
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        onBack={() => setMobileView('list')}
      />
    </div>
  );
}
