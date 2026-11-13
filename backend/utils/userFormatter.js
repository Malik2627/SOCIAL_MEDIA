export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture ?? '',
    bio: user.bio ?? '',
    followers: user.followers ?? [],
    following: user.following ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

