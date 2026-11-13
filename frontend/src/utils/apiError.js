export function getSafeErrorMessage(error, fallbackMessage) {
  const apiMessage = error?.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
    return apiMessage;
  }
  if (error?.code === 'ERR_NETWORK') {
    return 'Unable to reach the server. Please check your connection and try again.';
  }
  return fallbackMessage;
}

