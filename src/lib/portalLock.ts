import crypto from 'crypto';
import { cookies } from 'next/headers';

export const PORTAL_UNLOCK_COOKIE = 'student_portal_unlock';
const UNLOCK_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export function getPortalLockPassword(): string {
  return (
    process.env.STUDENT_PORTAL_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    'password123'
  );
}

export function isUsingDedicatedPortalPassword(): boolean {
  return Boolean(process.env.STUDENT_PORTAL_PASSWORD);
}

function getSigningSecret(): string {
  const baseSecret = process.env.NEXTAUTH_SECRET || 'leetcode-tracker-portal-lock-fallback';
  const passwordDigest = crypto
    .createHash('sha256')
    .update(getPortalLockPassword())
    .digest('hex');
  return `${baseSecret}:${passwordDigest}`;
}

export function verifyPortalLockPassword(input: string): boolean {
  const expected = getPortalLockPassword();
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createPortalUnlockToken(): string {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const payload = String(exp);
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifyPortalUnlockToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payload, sig] = parts;
  const exp = parseInt(payload, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');

  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isPortalUploadUnlocked(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_UNLOCK_COOKIE)?.value;
  return verifyPortalUnlockToken(token);
}

export function getUnlockCookieOptions() {
  const isProd =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXTAUTH_URL?.startsWith('https://'));

  return {
    name: PORTAL_UNLOCK_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isProd,
    maxAge: UNLOCK_TTL_SECONDS,
  };
}
