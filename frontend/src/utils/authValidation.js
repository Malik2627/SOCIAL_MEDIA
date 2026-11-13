const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_BIO_LENGTH = 250;

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateLoginForm({ email, password }) {
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  const rawPassword = typeof password === 'string' ? password : '';
  const errors = {};

  if (!trimmedEmail) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address';
  }

  if (rawPassword.trim().length === 0) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      email: trimmedEmail,
      password: rawPassword,
    },
  };
}

export function validateRegisterForm({
  name,
  username,
  email,
  password,
  confirmPassword,
  bio,
}) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  const trimmedBio = typeof bio === 'string' ? bio.trim() : '';
  const rawPassword = typeof password === 'string' ? password : '';
  const rawConfirmPassword = typeof confirmPassword === 'string' ? confirmPassword : '';
  const errors = {};

  if (!trimmedName) {
    errors.name = 'Name is required';
  }

  if (!trimmedUsername) {
    errors.username = 'Username is required';
  } else if (/\s/.test(trimmedUsername)) {
    errors.username = 'Username cannot contain spaces';
  }

  if (!trimmedEmail) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address';
  }

  if (rawPassword.trim().length === 0) {
    errors.password = 'Password is required';
  } else if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (rawConfirmPassword.length === 0) {
    errors.confirmPassword = 'Confirm password is required';
  } else if (rawPassword !== rawConfirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (trimmedBio.length > MAX_BIO_LENGTH) {
    errors.bio = `Bio cannot exceed ${MAX_BIO_LENGTH} characters`;
  }

  const userData = {
    name: trimmedName,
    username: trimmedUsername,
    email: trimmedEmail,
    password: rawPassword,
    ...(trimmedBio ? { bio: trimmedBio } : {}),
  };

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    userData,
  };
}

export function validateProfileForm({ name, username, bio, profilePicture }) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const trimmedBio = typeof bio === 'string' ? bio.trim() : '';
  const trimmedPicture = typeof profilePicture === 'string' ? profilePicture.trim() : '';
  const errors = {};

  if (!trimmedName) {
    errors.name = 'Name is required';
  }

  if (!trimmedUsername) {
    errors.username = 'Username is required';
  } else if (/\s/.test(trimmedUsername)) {
    errors.username = 'Username cannot contain spaces';
  }

  if (trimmedBio.length > MAX_BIO_LENGTH) {
    errors.bio = `Bio cannot exceed ${MAX_BIO_LENGTH} characters`;
  }

  if (trimmedPicture && !isValidHttpUrl(trimmedPicture)) {
    errors.profilePicture = 'Enter a valid http or https image URL';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    payload: {
      name: trimmedName,
      username: trimmedUsername,
      bio: trimmedBio,
      profilePicture: trimmedPicture,
    },
  };
}

export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validate a profile avatar image file before upload.
 * Rejects unsupported file types and files larger than 5 MB.
 */
export function validateAvatarFile(file) {
  if (!file) {
    return {
      isValid: false,
      error: 'Please select an image file to upload.',
    };
  }

  const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';

  const hasValidExt = ALLOWED_AVATAR_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidType = ALLOWED_AVATAR_TYPES.includes(type);

  if (!hasValidType && !hasValidExt) {
    return {
      isValid: false,
      error: 'Only JPEG, JPG, PNG, and WEBP image formats are supported.',
    };
  }

  if (typeof file.size === 'number' && file.size > MAX_AVATAR_FILE_SIZE) {
    return {
      isValid: false,
      error: 'File size exceeds the 5 MB limit. Please select a smaller image.',
    };
  }

  return {
    isValid: true,
    error: '',
  };
}

export const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_POST_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_POST_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validate an attached post image file.
 * Rejects unsupported file types and files larger than 5 MB.
 */
export function validatePostImageFile(file) {
  if (!file) {
    return {
      isValid: false,
      error: 'Please select an image file to attach.',
    };
  }

  const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
  const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';

  const hasValidExt = ALLOWED_POST_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidType = ALLOWED_POST_IMAGE_TYPES.includes(type);

  if (!hasValidType && !hasValidExt) {
    return {
      isValid: false,
      error: 'Only JPEG, JPG, PNG, and WEBP image formats are supported.',
    };
  }

  if (typeof file.size === 'number' && file.size > MAX_POST_IMAGE_SIZE) {
    return {
      isValid: false,
      error: 'Image file size exceeds the 5 MB limit. Please select a smaller image.',
    };
  }

  return {
    isValid: true,
    error: '',
  };
}

