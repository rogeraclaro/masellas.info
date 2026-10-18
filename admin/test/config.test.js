import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, loadConfig } from '../lib/config.js';

const good = {
  DATA_FILE: '/srv/projects.json',
  PUBLIC_FILE: '/var/www/projects/data/projects.json',
  ADMIN_PASSWORD_HASH: 'scrypt$16384$8$1$aa$bb',
  SESSION_SECRET: 'ab'.repeat(32),
};

test('parseEnv reads KEY=value lines, ignoring comments and blanks, stripping quotes', () => {
  const env = parseEnv('# comment\n\nPORT=9000\nHOST = "0.0.0.0"\nX=\'a=b\'\n  bad line\n');
  assert.deepEqual(env, { PORT: '9000', HOST: '0.0.0.0', X: 'a=b' });
});

test('loadConfig applies defaults', () => {
  const config = loadConfig(good);
  assert.equal(config.port, 8787);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.cookieSecure, true);
  assert.equal(config.publicUrl, 'https://masellas.info/projects/');
  assert.equal(config.cookiePath, '/');
  assert.equal(config.trustProxy, false);
});

test('loadConfig reads overrides', () => {
  const config = loadConfig({ ...good, PORT: '9000', COOKIE_SECURE: 'false', PUBLIC_URL: 'http://localhost:8765/projects/' });
  assert.equal(config.port, 9000);
  assert.equal(config.cookieSecure, false);
  assert.equal(config.publicUrl, 'http://localhost:8765/projects/');
});

test('loadConfig derives the some-words files from DATA_FILE / PUBLIC_FILE (no new required vars)', () => {
  const config = loadConfig(good);
  assert.equal(config.someWordsFile, '/srv/some-words.json');
  assert.equal(config.someWordsPublicFile, '/var/www/projects/data/some-words.json');
});

test('loadConfig accepts optional absolute overrides for the some-words files', () => {
  const config = loadConfig({ ...good, SOME_WORDS_FILE: '/x/words.json', SOME_WORDS_PUBLIC_FILE: '/y/words.json' });
  assert.equal(config.someWordsFile, '/x/words.json');
  assert.equal(config.someWordsPublicFile, '/y/words.json');
  assert.throws(() => loadConfig({ ...good, SOME_WORDS_FILE: 'words.json' }), /SOME_WORDS_FILE/);
});

test('loadConfig reads COOKIE_PATH and TRUST_PROXY', () => {
  const config = loadConfig({ ...good, COOKIE_PATH: '/admin/', TRUST_PROXY: 'true' });
  assert.equal(config.cookiePath, '/admin/');
  assert.equal(config.trustProxy, true);
  assert.equal(loadConfig({ ...good, TRUST_PROXY: 'yes' }).trustProxy, false, 'only the literal true enables it');
  assert.throws(() => loadConfig({ ...good, COOKIE_PATH: 'admin' }), /COOKIE_PATH/);
  assert.throws(() => loadConfig({ ...good, COOKIE_PATH: '/admin/; Domain=evil' }), /COOKIE_PATH/);
});

test('loadConfig fails fast listing every missing variable', () => {
  assert.throws(() => loadConfig({}), /DATA_FILE.*PUBLIC_FILE.*ADMIN_PASSWORD_HASH.*SESSION_SECRET/s);
});

test('loadConfig rejects a short or non-hex SESSION_SECRET and a relative DATA_FILE', () => {
  assert.throws(() => loadConfig({ ...good, SESSION_SECRET: 'abc' }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ ...good, SESSION_SECRET: 'z'.repeat(64) }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ ...good, DATA_FILE: 'data/projects.json' }), /DATA_FILE/);
  assert.throws(() => loadConfig({ ...good, PUBLIC_FILE: 'projects.json' }), /PUBLIC_FILE/);
  assert.throws(() => loadConfig({ ...good, PUBLIC_FILE: good.DATA_FILE }), /PUBLIC_FILE/);
});

test('loadConfig derives the projects (B.C.) files from DATA_FILE / PUBLIC_FILE (no new vars)', () => {
  const config = loadConfig(good);
  assert.equal(config.projectsAcFile, '/srv/projects-ac.json');
  assert.equal(config.projectsAcPublicFile, '/var/www/projects/data/projects-ac.json');
});
