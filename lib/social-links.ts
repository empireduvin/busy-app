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
