import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateSomeWords } from '../lib/validation.js';
import { someWordsPaths, writeSomeWordsPublic, prepareSomeWords } from '../lib/publish.js';

test('validateSomeWords trims and accepts valid text', () => {
  const { value, errors } = validateSomeWords({ text: '  Hello [there](https://example.com).  ' });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { text: 'Hello [there](https://example.com).' });
});

test('validateSomeWords rejects empty, too long, non-text, unknown fields and bad links', () => {
  assert.match(validateSomeWords({ text: '   ' }).errors.text, /required/);
  assert.match(validateSomeWords({ text: 'x'.repeat(4001) }).errors.text, /4000/);
  assert.ok(validateSomeWords({ text: 'x'.repeat(4000) }).errors.text === undefined);
  assert.match(validateSomeWords({ text: 42 }).errors.text, /text/);
  assert.match(validateSomeWords({ text: 'ok', html: '<b>' }).errors._unknown, /html/);
  assert.ok(validateSomeWords(null).errors._body);
  assert.match(validateSomeWords({ text: 'see [x](javascript:alert(1))' }).errors.text, /javascript:alert\(1\)/);
});

test('someWordsPaths derives both files from the existing DATA_FILE / PUBLIC_FILE dirs', () => {
  assert.deepEqual(someWordsPaths({ dataFile: '/priv/data/projects.json', publicFile: '/web/projects/data/projects.json' }), {
    someWordsFile: '/priv/data/some-words.json',
    someWordsPublicFile: '/web/projects/data/some-words.json',
  });
});

let dir;
let paths;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'admin-words-'));
  await mkdir(path.join(dir, 'private'));
  await mkdir(path.join(dir, 'web'));
  paths = {
    someWordsFile: path.join(dir, 'private', 'some-words.json'),
    someWordsPublicFile: path.join(dir, 'web', 'some-words.json'),
    defaultFile: path.join(dir, 'repo-default.json'),
  };
});

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('writeSomeWordsPublic writes { text } atomically, 0644, no backup or temp files', async () => {
  await writeSomeWordsPublic(paths.someWordsPublicFile, { text: 'Hi.', extra: 'private' });
  assert.deepEqual(await readJson(paths.someWordsPublicFile), { text: 'Hi.' });
  assert.deepEqual(await readdir(path.dirname(paths.someWordsPublicFile)), ['some-words.json']);
  assert.equal((await stat(paths.someWordsPublicFile)).mode & 0o777, 0o644);
});

test('prepareSomeWords republishes from an existing private file', async () => {
  await writeFile(paths.someWordsFile, JSON.stringify({ text: 'Private.' }));
  await writeFile(paths.someWordsPublicFile, JSON.stringify({ text: 'Stale.' }));
  const { seeded } = await prepareSomeWords(paths);
  assert.equal(seeded, null);
  assert.deepEqual(await readJson(paths.someWordsPublicFile), { text: 'Private.' });
});

test('prepareSomeWords seeds the private file from the public one first', async () => {
  await writeFile(paths.someWordsPublicFile, JSON.stringify({ text: 'Public.' }));
  await writeFile(paths.defaultFile, JSON.stringify({ text: 'Default.' }));
  const { seeded } = await prepareSomeWords(paths);
  assert.equal(seeded, paths.someWordsPublicFile);
  assert.deepEqual(await readJson(paths.someWordsFile), { text: 'Public.' });
  assert.equal((await stat(paths.someWordsFile)).mode & 0o777, 0o600);
});

test('prepareSomeWords falls back to the repo default and publishes it', async () => {
  await writeFile(paths.defaultFile, JSON.stringify({ text: 'Default.' }));
  const { seeded } = await prepareSomeWords(paths);
  assert.equal(seeded, paths.defaultFile);
  assert.deepEqual(await readJson(paths.someWordsFile), { text: 'Default.' });
  assert.deepEqual(await readJson(paths.someWordsPublicFile), { text: 'Default.' });
});

test('prepareSomeWords fails when nothing is available', async () => {
  await assert.rejects(prepareSomeWords(paths), /some-words/);
});
