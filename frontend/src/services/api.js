import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'socialmedia_token';

const rawApiUrl = import.meta.env?.VITE_API_URL;
const baseURL =
  typeof rawApiUrl === 'string' && rawApiUrl.trim()
    ? rawApiUrl.trim().replace(/\/+$/, '')
    : import.meta.env.DEV
      ? 'http://localhost:5000/api'
      : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Endpoints where 401 is an expected credential validation error
    const isCredentialEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/profile/me/password') ||
      url.includes('/auth/change-password');

    if (status === 401 && !isCredentialEndpoint) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));

        // Prevent infinite redirect loops if already on login/register
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
          window.location.replace('/login');
        }
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Upload a profile avatar image to POST /api/profile/me/avatar using FormData (field: 'avatar').
 * Preserves the Authorization header interceptor and reports upload progress.
 */
export async function uploadProfileAvatar(file, onUploadProgress) {
  const formData = new FormData();
  formData.append('avatar', file);

  return api.post('/profile/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
}

/**
 * Fetch all posts sorted newest first.
 */
export async function getPosts() {
  return api.get('/posts');
}

/**
 * Fetch a single post by ID.
 */
export async function getPostById(id) {
  return api.get(`/posts/${id}`);
}

/**
 * Create a new post. Accepts FormData or object with text content and/or image.
 */
export async function createPost(postData) {
  if (postData instanceof FormData) {
    return api.post('/posts', postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  return api.post('/posts', postData);
}

/**
 * Update an existing post. Only the author can update their post.
 */
export async function updatePost(id, postData) {
  if (postData instanceof FormData) {
    return api.put(`/posts/${id}`, postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  return api.put(`/posts/${id}`, postData);
}

/**
 * Delete a post by ID. Only the author can delete their post.
 */
export async function deletePost(id) {
  return api.delete(`/posts/${id}`);
}

/**
 * Toggle like/unlike on a post by ID.
 */
export async function toggleLikePost(postId) {
  return api.post(`/posts/${postId}/like`);
}

/**
 * Fetch all comments for a post.
 */
export async function getPostComments(postId) {
  return api.get(`/posts/${postId}/comments`);
}

/**
 * Add a comment to a post.
 */
export async function createComment(postId, content) {
  return api.post(`/posts/${postId}/comments`, { content });
}

/**
 * Update an existing comment.
 */
export async function updateComment(commentId, content) {
  return api.put(`/comments/${commentId}`, { content });
}

/**
 * Delete a comment by ID.
 */
export async function deleteComment(commentId) {
  return api.delete(`/comments/${commentId}`);
}

/**
 * Follow a user by user ID.
 */
export async function followUser(userId) {
  return api.post(`/users/${userId}/follow`);
}

/**
 * Unfollow a user by user ID.
 */
export async function unfollowUser(userId) {
  return api.delete(`/users/${userId}/follow`);
}

/**
 * Get followers list of a user.
 */
export async function getUserFollowers(userId) {
  return api.get(`/users/${userId}/followers`);
}

/**
 * Get following list of a user.
 */
export async function getUserFollowing(userId) {
  return api.get(`/users/${userId}/following`);
}

/**
 * Search users by query string.
 */
export async function searchUsers(query) {
  const safeQuery = typeof query === 'string' ? query.trim() : '';
  return api.get(`/users/search?q=${encodeURIComponent(safeQuery)}`);
}

/**
 * Fetch public user profile by username.
 */
export async function getPublicProfile(username) {
  const safeUsername = typeof username === 'string' ? username.trim() : '';
  return api.get(`/profile/${encodeURIComponent(safeUsername)}`);
}

/**
 * Fetch posts authored by a user (by username or userId).
 */
export async function getUserPosts(usernameOrUserId) {
  const param = typeof usernameOrUserId === 'string' ? usernameOrUserId.trim() : '';
  if (/^[0-9a-fA-F]{24}$/.test(param)) {
    return api.get(`/posts/user/${param}`);
  }
  return api.get(`/users/${encodeURIComponent(param)}/posts`);
}

/**
 * Fetch all notifications for the authenticated user.
 */
export async function getNotifications() {
  return api.get('/notifications');
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId) {
  return api.put(`/notifications/${notificationId}/read`);
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead() {
  return api.put('/notifications/read-all');
}

/**
 * Fetch all conversations for the authenticated user.
 */
export async function getConversations() {
  return api.get('/messages/conversations');
}

/**
 * Get or create a 1-to-1 conversation with another user.
 */
export async function getOrCreateConversation(recipientId) {
  return api.post('/messages/conversations', { recipientId });
}

/**
 * Fetch message history for a conversation.
 */
export async function getMessages(conversationId) {
  return api.get(`/messages/conversations/${conversationId}/messages`);
}

export const getConversationMessages = getMessages;

/**
 * Send a message in a conversation or to a recipient.
 */
export async function sendMessage({ conversationId, recipientId, content }) {
  return api.post('/messages', { conversationId, recipientId, content });
}

/**
 * Mark all unread messages in a conversation as read.
 */
export async function markConversationRead(conversationId) {
  return api.put(`/messages/conversations/${conversationId}/read`);
}

/**
 * Update authenticated user's profile details.
 */
export async function updateProfile(profileData) {
  return api.put('/profile/me', profileData);
}

export const updateMyProfile = updateProfile;

/**
 * Fetch authenticated user's profile details.
 */
export async function getMyProfile() {
  return api.get('/profile/me');
}

/**
 * Change the authenticated user's password.
 */
export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  return api.put('/profile/me/password', { currentPassword, newPassword, confirmPassword });
}

/**
 * Permanently delete the authenticated user's account and data.
 */
export async function deleteAccount({ password }) {
  return api.delete('/profile/me', { data: { password } });
}

export default api;

