import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateEnvText } from '../lib/envfile.js';
import { parseEnv } from '../lib/config.js';

const HASH = 'scrypt$16384$8$1$aa$bb';
const SECRET = 'c'.repeat(64);

test('creates both keys in an empty file', () => {
  const text = updateEnvText('', { passwordHash: HASH, newSecret: SECRET });
  assert.deepEqual(parseEnv(text), { ADMIN_PASSWORD_HASH: HASH, SESSION_SECRET: SECRET });
  assert.ok(text.endsWith('\n'));
});

test('replaces an existing hash in place and keeps every other line', () => {
  const before = '# admin\nPORT=8787\nADMIN_PASSWORD_HASH=old\n\nSESSION_SECRET=' + 'd'.repeat(64) + '\nHOST=127.0.0.1\n';
  const text = updateEnvText(before, { passwordHash: HASH, newSecret: SECRET });
  assert.equal(text, before.replace('ADMIN_PASSWORD_HASH=old', `ADMIN_PASSWORD_HASH=${HASH}`));
});

test('keeps a non-empty SESSION_SECRET and fills an empty one', () => {
  const kept = updateEnvText(`SESSION_SECRET=${'d'.repeat(64)}`, { passwordHash: HASH, newSecret: SECRET });
  assert.equal(parseEnv(kept).SESSION_SECRET, 'd'.repeat(64));
  const filled = updateEnvText('SESSION_SECRET=\nPORT=1\n', { passwordHash: HASH, newSecret: SECRET });
  assert.deepEqual(parseEnv(filled), { SESSION_SECRET: SECRET, PORT: '1', ADMIN_PASSWORD_HASH: HASH });
  assert.equal(filled.match(/SESSION_SECRET=/g).length, 1, 'no duplicate key');
});

test('does not touch commented-out keys and handles a file without trailing newline', () => {
  const text = updateEnvText('# ADMIN_PASSWORD_HASH=example\nPORT=1', { passwordHash: HASH, newSecret: SECRET });
  assert.match(text, /^# ADMIN_PASSWORD_HASH=example\nPORT=1\nADMIN_PASSWORD_HASH=/);
  assert.equal(parseEnv(text).ADMIN_PASSWORD_HASH, HASH);
});
