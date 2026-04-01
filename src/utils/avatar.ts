export function getCartoonAvatar(seed: string): string {
  const safeSeed = encodeURIComponent(seed || 'connect-user');
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${safeSeed}&backgroundType=gradientLinear`;
}

export function sanitizeImageUrl(photoURL: string | undefined | null): string | undefined {
  if (!photoURL) return undefined;
  const trimmed = photoURL.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  return undefined;
}

export function withImageVersion(url: string | undefined, version?: string | null): string | undefined {
  if (!url || !version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export function resolveAvatar(photoURL: string | undefined | null, seed: string): string {
  return sanitizeImageUrl(photoURL) || getCartoonAvatar(seed);
}
