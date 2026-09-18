export function isValidLeetCodeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Strict host allowlist to prevent SSRF (Security Spec §4.4)
    return ['leetcode.com', 'www.leetcode.com'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function extractUsername(urlStr: string): string | null {
  if (!isValidLeetCodeUrl(urlStr)) return null;
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    // Handle both /username/ and /u/username/
    if (parts[0] === 'u' && parts.length >= 2) {
      return parts[1];
    }
    return parts[0];
  } catch {
    return null;
  }
}
