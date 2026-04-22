const VALID_ID = /^[A-Za-z0-9_-]+$/;
const MAX_LEN = 40;

export function getInitialSelection(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("select");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LEN) return null;
  if (!VALID_ID.test(trimmed)) return null;
  return trimmed;
}
