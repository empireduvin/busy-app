export function normalizeInstagramUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const withoutAt = trimmed.replace(/^@+/, '');
  const handle = withoutAt.split(/[/?#]/)[0]?.trim();

  if (!handle) return null;

  return `https://www.instagram.com/${handle}/`;
}

export function normalizeInstagramHandle(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!url.hostname.toLowerCase().includes('instagram.com')) return null;
    const handle = url.pathname.split('/').filter(Boolean)[0]?.trim();
    return handle ? `@${handle.replace(/^@+/, '')}` : null;
  } catch {
    const handle = trimmed.replace(/^@+/, '').split(/[/?#]/)[0]?.trim();
    return handle ? `@${handle}` : null;
  }
}

export function normalizeInstagramContentUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith('instagram.com')) return null;
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}
