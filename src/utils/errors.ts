export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = 'message' in error ? String((error as { message?: unknown }).message || '').trim() : '';
    if (maybeMessage) {
      if (maybeMessage.toLowerCase().includes('network') || maybeMessage.toLowerCase().includes('fetch')) {
        return 'Network issue detected. Please check your internet connection and try again.';
      }
      return maybeMessage;
    }
  }

  return fallback;
}
