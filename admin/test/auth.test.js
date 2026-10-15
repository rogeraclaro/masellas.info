import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signSession, verifySession, createRateLimiter } from '../lib/auth.js';

const SECRET = 'a'.repeat(64);

test('hashPassword produces a self-describing scrypt string', () => {
  const hash = hashPassword('localdev');
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(hashPassword('localdev'), hash, 'salt must be random');
});

test('verifyPassword accepts the right password and rejects the wrong one', () => {
  const hash = hashPassword('localdev');
  assert.equal(verifyPassword('localdev', hash), true);
  assert.equal(verifyPassword('localdeV', hash), false);
  assert.equal(verifyPassword('', hash), false);
});

test('verifyPassword returns false for malformed hashes', () => {
  assert.equal(verifyPassword('x', ''), false);
  assert.equal(verifyPassword('x', 'scrypt$1$2'), false);
  assert.equal(verifyPassword('x', 'bcrypt$16384$8$1$00$00'), false);
});

test('session token round-trips before expiry', () => {
  const now = 1_000_000;
  const token = signSession(SECRET, now, 60_000);
  assert.equal(verifySession(token, SECRET, now + 59_000), true);
});

test('session token is rejected after expiry', () => {
  const token = signSession(SECRET, 0, 60_000);
  assert.equal(verifySession(token, SECRET, 60_001), false);
});

test('session token is rejected when tampered or signed with another secret', () => {
  const now = Date.now();
  const token = signSession(SECRET, now, 60_000);
  const [exp, nonce, sig] = token.split('.');
  assert.equal(verifySession(`${Number(exp) + 1000}.${nonce}.${sig}`, SECRET, now), false);
  assert.equal(verifySession(`${exp}.${nonce}.${sig.slice(0, -2)}xx`, SECRET, now), false);
  assert.equal(verifySession(token, 'b'.repeat(64), now), false);
  assert.equal(verifySession('', SECRET, now), false);
  assert.equal(verifySession(undefined, SECRET, now), false);
  assert.equal(verifySession('a.b', SECRET, now), false);
});

test('rate limiter blocks after 5 failures within the window and frees up later', () => {
  const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60_000 });
  const ip = '1.2.3.4';
  for (let i = 0; i < 5; i += 1) {
    assert.equal(limiter.isBlocked(ip, i), false);
    limiter.fail(ip, i);
  }
  assert.equal(limiter.isBlocked(ip, 10), true);
  assert.equal(limiter.isBlocked('5.6.7.8', 10), false, 'other IPs are not affected');
  assert.equal(limiter.isBlocked(ip, 15 * 60_000 + 5), false, 'old failures expire');
});

test('rate limiter reset clears failures for an IP', () => {
  const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
  limiter.fail('ip', 0);
  limiter.fail('ip', 0);
  assert.equal(limiter.isBlocked('ip', 1), true);
  limiter.reset('ip');
  assert.equal(limiter.isBlocked('ip', 1), false);
});
