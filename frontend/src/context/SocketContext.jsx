import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { TOKEN_STORAGE_KEY } from '../services/api.js';

const SocketContext = createContext(null);

const DEFAULT_SOCKET_STATE = {
  socket: null,
  isConnected: false,
  onlineUsers: [],
  isUserOnline: () => false,
};

/**
 * Derives the backend Socket.io server URL from VITE_API_URL or defaults to http://localhost:5000 in dev.
 * Strips trailing `/api` or `/api/` and trailing slashes safely so socket.io connects to the HTTP root.
 */
function getSocketUrl() {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    const stripped = trimmed.replace(/\/api$/, '');
    return stripped || (typeof window !== 'undefined' ? window.location.origin : '/');
  }

  // Fallback to http://localhost:5000 only in local development
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }

  // In production without VITE_API_URL, fallback to current window origin
  return typeof window !== 'undefined' ? window.location.origin : '/';
}

export function SocketProvider({ children }) {
  const { user, token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const activeToken =
      token ||
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null);

    // Only connect if the user is authenticated with a valid token
    if (!user || !activeToken || !isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, {
      auth: {
        token: activeToken,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleConnectError(err) {
      console.warn('[Socket] Connection error:', err?.message);
      setIsConnected(false);
    }

    function handleOnlineUsers(users) {
      if (Array.isArray(users)) {
        setOnlineUsers(users.map((id) => (id?._id || id?.id || id).toString()));
      }
    }

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('connect_error', handleConnectError);
    newSocket.on('onlineUsers', handleOnlineUsers);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('connect_error', handleConnectError);
      newSocket.off('onlineUsers', handleOnlineUsers);
      newSocket.disconnect();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
    };
  }, [user, token, isAuthenticated]);

  const isUserOnline = useCallback(
    (targetUserId) => {
      if (!targetUserId) return false;
      const targetIdStr = (targetUserId?._id || targetUserId?.id || targetUserId).toString();
      return onlineUsers.includes(targetIdStr);
    },
    [onlineUsers]
  );

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      onlineUsers,
      isUserOnline,
    }),
    [socket, isConnected, onlineUsers, isUserOnline]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useSocket() {
  const context = useContext(SocketContext);
  return context || DEFAULT_SOCKET_STATE;
}

export default SocketContext;

