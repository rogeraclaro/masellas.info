// Password hashing (scrypt), signed session tokens (HMAC-SHA256) and a login rate limiter.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT = { N: 16384, r: 8, p: 1 };

// Format: scrypt$N$r$p$saltHex$hashHex
export function hashPassword(password, { N, r, p } = SCRYPT) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, KEY_LENGTH, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('hex'), hash.toString('hex')].join('$');
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (![N, r, p].every(Number.isInteger) || !salt.length || !expected.length) return false;
  try {
    const actual = scryptSync(String(password), salt, expected.length, { N, r, p, maxmem: 256 * N * r });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const sign = (secret, payload) => createHmac('sha256', Buffer.from(secret, 'hex')).update(payload).digest('base64url');

// Token: "<expiresAtMs>.<nonce>.<hmac>"
export function signSession(secret, now = Date.now(), ttlMs = 12 * 60 * 60 * 1000) {
  const payload = `${now + ttlMs}.${randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  return Number(parts[0]) > now;
}

// In-memory, per IP: at most `max` failures inside a sliding `windowMs`.
export function createRateLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const failures = new Map();
  const recent = (ip, now) => {
    const list = (failures.get(ip) || []).filter((t) => now - t < windowMs);
    if (list.length) failures.set(ip, list);
    else failures.delete(ip);
    return list;
  };
  return {
    isBlocked: (ip, now = Date.now()) => recent(ip, now).length >= max,
    fail: (ip, now = Date.now()) => failures.set(ip, [...recent(ip, now), now]),
    reset: (ip) => failures.delete(ip),
  };
}
