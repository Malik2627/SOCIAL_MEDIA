import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_STORAGE_KEY } from '../services/api.js';
import { getSafeErrorMessage } from '../utils/apiError.js';

const AuthContext = createContext(null);

function readStoredToken() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function writeStoredToken(token) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function clearStoredToken() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()));

  const clearSession = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const getCurrentUser = useCallback(async () => {
    const activeToken = readStoredToken();

    if (!activeToken) {
      setUser(null);
      setToken(null);
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      const currentUser = response?.data?.user ?? null;

      if (!currentUser) {
        clearSession();
        return null;
      }

      setToken(activeToken);
      setUser(currentUser);
      return currentUser;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      if (!readStoredToken()) {
        if (isActive) {
          setLoading(false);
        }
        return;
      }

      await getCurrentUser();
      if (isActive) {
        setLoading(false);
      }
    }

    restoreSession();

    return () => {
      isActive = false;
    };
  }, [getCurrentUser]);

  useEffect(() => {
    function handleAuthExpired() {
      clearSession();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:expired', handleAuthExpired);
      return () => {
        window.removeEventListener('auth:expired', handleAuthExpired);
      };
    }
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: nextToken, user: nextUser } = response?.data ?? {};

      if (!nextToken || !nextUser) {
        throw new Error('Authentication response was incomplete');
      }

      writeStoredToken(nextToken);
      setToken(nextToken);
      setUser(nextUser);
      return response.data;
    } catch (error) {
      throw new Error(getSafeErrorMessage(error, 'Unable to log in'));
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token: nextToken, user: nextUser } = response?.data ?? {};

      if (!nextToken || !nextUser) {
        throw new Error('Registration response was incomplete');
      }

      writeStoredToken(nextToken);
      setToken(nextToken);
      setUser(nextUser);
      return response.data;
    } catch (error) {
      throw new Error(getSafeErrorMessage(error, 'Unable to register account'));
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback((nextUser) => {
    if (nextUser && typeof nextUser === 'object') {
      setUser(nextUser);
    }
  }, []);

  const updateFollowing = useCallback((targetUserId, isFollowing) => {
    if (!targetUserId) return;
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      const currentFollowing = Array.isArray(prevUser.following) ? prevUser.following : [];
      const targetIdStr = (targetUserId?._id || targetUserId?.id || targetUserId).toString();
      const exists = currentFollowing.some(
        (id) => (id?._id ? id._id.toString() : id.toString()) === targetIdStr
      );

      let nextFollowing;
      if (isFollowing && !exists) {
        nextFollowing = [...currentFollowing, targetUserId];
      } else if (!isFollowing && exists) {
        nextFollowing = currentFollowing.filter(
          (id) => (id?._id ? id._id.toString() : id.toString()) !== targetIdStr
        );
      } else {
        return prevUser;
      }

      return {
        ...prevUser,
        following: nextFollowing,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      getCurrentUser,
      updateUser,
      updateFollowing,
    }),
    [user, token, loading, login, register, logout, getCurrentUser, updateUser, updateFollowing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- Keep useAuth co-located with AuthProvider per STEP 5A contract.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
