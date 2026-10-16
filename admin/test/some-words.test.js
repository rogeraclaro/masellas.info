import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateSomeWords } from '../lib/validation.js';
import { someWordsPaths, writeSomeWordsPublic, prepareSomeWords } from '../lib/publish.js';

const words = (ca, en = '', es = '') => ({ text: { ca, en, es } });

test('validateSomeWords trims and accepts valid text per language; en / es may be empty', () => {
  const { value, errors } = validateSomeWords(words('  Hola [aquí](https://example.com).  ', ' Hello. '));
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { text: { ca: 'Hola [aquí](https://example.com).', en: 'Hello.', es: '' } });
});

test('validateSomeWords rejects empty ca, too long, non-text, unknown fields and bad links, per language', () => {
  assert.match(validateSomeWords(words('   ', 'Hello.')).errors['text.ca'], /\(ca\) is required/);
  assert.match(validateSomeWords(words('ok', 'x'.repeat(4001))).errors['text.en'], /\(en\).*4000/);
  assert.deepEqual(validateSomeWords(words('x'.repeat(4000), 'x'.repeat(4000), 'x'.repeat(4000))).errors, {});
  assert.match(validateSomeWords({ text: 'legacy string' }).errors.text, /ca, en and es/);
  assert.match(validateSomeWords({ text: { ca: 'ok', en: 'ok', es: 42 } }).errors['text.es'], /text/);
  assert.match(validateSomeWords({ ...words('ok'), html: '<b>' }).errors._unknown, /html/);
  assert.ok(validateSomeWords(null).errors._body);
  const bad = validateSomeWords(words('ok', '', 'see [x](javascript:alert(1))'));
  assert.deepEqual(Object.keys(bad.errors), ['text.es']);
  assert.match(bad.errors['text.es'], /javascript:alert\(1\)/);
  assert.deepEqual(bad.value, {});
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

test('writeSomeWordsPublic writes { text } per language plus the legacy file, atomically, 0644, no backup or temp files', async () => {
  await writeSomeWordsPublic(paths.someWordsPublicFile, { text: { ca: 'Hola.', en: 'Hi.', es: '' }, extra: 'private' });
  const web = path.dirname(paths.someWordsPublicFile);
  assert.deepEqual((await readdir(web)).sort(), ['some-words.ca.json', 'some-words.en.json', 'some-words.es.json', 'some-words.json']);
  assert.deepEqual(await readJson(path.join(web, 'some-words.ca.json')), { text: 'Hola.' });
  assert.deepEqual(await readJson(path.join(web, 'some-words.en.json')), { text: 'Hi.' });
  assert.deepEqual(await readJson(path.join(web, 'some-words.es.json')), { text: 'Hola.' }, 'empty es falls back to ca');
  assert.deepEqual(await readJson(paths.someWordsPublicFile), { text: 'Hola.' }, 'legacy file = ca');
  for (const name of await readdir(web)) assert.equal((await stat(path.join(web, name))).mode & 0o777, 0o644, name);
});

test('prepareSomeWords republishes from an existing private file', async () => {
  await writeFile(paths.someWordsFile, JSON.stringify({ text: 'Private.' }));
  await writeFile(paths.someWordsPublicFile, JSON.stringify({ text: 'Stale.' }));
  const { seeded } = await prepareSomeWords(paths);
  assert.equal(seeded, null);
  assert.deepEqual(await readJson(paths.someWordsPublicFile), { text: 'Private.' });
  assert.deepEqual(await readJson(path.join(dir, 'web', 'some-words.en.json')), { text: 'Private.' }, 'legacy text published to every language');
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

test('validateSomeWords reports unclosed styles and mixed lists in the language they are in', () => {
  const { errors } = validateSomeWords(words('**Hola', 'Intro\n- item', ''));
  assert.match(errors['text.ca'], /text \(ca\).*unclosed "\*\*"/);
  assert.match(errors['text.en'], /text \(en\).*list/);
  assert.deepEqual(validateSomeWords(words('## Hola\n\n- **a**\n- ~~b~~\n\n> `c`')).errors, {});
});
