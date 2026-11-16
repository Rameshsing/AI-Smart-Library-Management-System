import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { DbUser } from './types.ts';

export const SESSION_COOKIE_NAME = 'library_sid';
const DEFAULT_DEV_SECRET = 'ai-smart-library-dev-session-secret-change-in-production';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || DEFAULT_DEV_SECRET;
}

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(plainPassword, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function signSessionToken(sessionId: string): string {
  const hmac = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('base64url');
  return `${sessionId}.${hmac}`;
}

export function verifySignedSessionToken(rawCookieValue: string | undefined): string | null {
  if (!rawCookieValue) return null;
  const dotIdx = rawCookieValue.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const sessionId = rawCookieValue.slice(0, dotIdx);
  const providedSig = rawCookieValue.slice(dotIdx + 1);
  if (!sessionId || !providedSig) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionId)
    .digest('base64url');
  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length) return null;
  return crypto.timingSafeEqual(bufA, bufB) ? sessionId : null;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = value;
  }
  return out;
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string' && forwardedProto.includes('https')) {
    return true;
  }
  return req.secure || req.protocol === 'https';
}

export function setSessionCookie(
  req: Request,
  res: Response,
  sessionId: string,
  maxAgeMs: number
): void {
  const secure = isSecureRequest(req);
  const signed = signSessionToken(sessionId);
  res.cookie(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
  });
}

/**
 * Strips script/style tags and arbitrary HTML markup for safe plain-text persistence.
 */
export function sanitizePlainText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function sanitizeAuditDetails(details: string): string {
  return sanitizePlainText(details)
    .replace(/(password|password_hash|token|secret|cookie)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .slice(0, 400);
}

/**
 * Never expose password hashes or internal secret keys in any user DTO.
 */
export function sanitizeUserPublicSummary(user: DbUser) {
  return {
    user_id: user.user_id,
    role: user.role,
    full_name: user.full_name,
    email: user.email,
    code: user.code,
    account_status: user.account_status,
    avatar_url: user.avatar_url,
    department: user.department ?? null,
    program: user.program ?? null,
    academic_year: user.academic_year ?? null,
    branch: user.branch ?? null,
    designation: user.designation ?? null,
  };
}

/**
 * Lightweight async per-resource mutex to serialize concurrent circulation & reservation updates.
 */
const activeLocks = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = activeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  activeLocks.set(
    key,
    previous.then(() => next)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (activeLocks.get(key) === next) {
      activeLocks.delete(key);
    }
  }
}
