import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';
import { hashPassword } from '../lib/auth.js';
import { ENGINES } from '../lib/translate.js';

const PASSWORD = 'localdev';
const engineCalls = [];
let failEs = false;
// Never reaches the network: answers like the engines, "EN:" / "ES:" + the text sent.
async function fakeFetch(url, init) {
  const q = new URLSearchParams(init.body).get('q');
  engineCalls.push({ url, q });
  if (url === ENGINES.es.url && failEs) return { ok: false, status: 503, json: async () => ({}) };
  const prefix = url === ENGINES.en.url ? 'EN:' : 'ES:';
  return { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: `${prefix}${q}` } }) };
}

let server;
let base;
let cookie;

before(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admin-translate-'));
  await mkdir(path.join(dir, 'private'));
  await mkdir(path.join(dir, 'web'));
  const dataFile = path.join(dir, 'private', 'projects.json');
  await writeFile(dataFile, `${JSON.stringify({ projects: [] })}\n`);
  await writeFile(path.join(dir, 'private', 'some-words.json'), `${JSON.stringify({ text: 'Hola.' })}\n`);
  server = createApp({
    dataFile,
    publicFile: path.join(dir, 'web', 'projects.json'),
    passwordHash: hashPassword(PASSWORD),
    sessionSecret: 'f'.repeat(64),
    cookieSecure: false,
    publicUrl: 'http://localhost/projects/',
    log: () => {},
    translateFetch: fakeFetch,
    translateLimit: { max: 4, windowMs: 60_000 },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await post('/api/login', { password: PASSWORD });
  cookie = res.headers.get('set-cookie').split(';')[0];
});

after(() => server.close());

function post(pathname, body, { headers = {}, withCookie = true } = {}) {
  return fetch(base + pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(withCookie && cookie ? { cookie } : {}), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// Order matters: the limiter allows 4 translations per minute in this file.

test('translate needs a session', async () => {
  const res = await post('/api/translate', { text: 'hola', kind: 'plain' }, { withCookie: false });
  assert.equal(res.status, 401);
});

test('translate needs JSON and a same-origin request', async () => {
  let res = await post('/api/translate', 'text=hola', { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 415);
  res = await post('/api/translate', { text: 'hola' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('translate validates the text, the kind and the field limit', async () => {
  const cases = [
    [{ kind: 'plain' }, /text/],
    [{ text: '   ', kind: 'plain' }, /text/],
    [{ text: 'x'.repeat(5001), kind: 'plain' }, /5000/],
    [{ text: 'hola', kind: 'html' }, /kind/],
    [{ text: 'hola', kind: 'plain', max: 0 }, /max/],
    [{ text: 'una **negreta', kind: 'rich' }, /ca text/],
  ];
  for (const [body, message] of cases) {
    const res = await post('/api/translate', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match((await res.json()).error, message);
  }
  assert.equal(engineCalls.length, 0, 'nothing invalid reaches the translator');
});

test('translate returns en and es, without If-Match and without changing data', async () => {
  const res = await post('/api/translate', { text: 'una **API pròpia**', kind: 'rich' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    en: { text: 'EN:una **API pròpia**', warnings: [] },
    es: { text: 'ES:una **API pròpia**', warnings: [] },
  });
  assert.deepEqual(engineCalls.map((call) => call.url).sort(), [ENGINES.en.url, ENGINES.es.url].sort());
  assert.ok(engineCalls.every((call) => !call.q.includes('**')), 'markup is protected');
});

test('translate warns when a translation exceeds the field limit', async () => {
  const res = await post('/api/translate', { text: 'abcdefgh', kind: 'plain', max: 10 });
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.match(json.en.warnings[0], /allows 10/);
});

test('one failed engine still returns the other language', async () => {
  failEs = true;
  const res = await post('/api/translate', { text: 'hola', kind: 'plain' });
  failEs = false;
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.en, { text: 'EN:hola', warnings: [] });
  assert.match(json.es.error, /HTTP 503/);
});

test('translations are rate limited per client', async () => {
  // 3 translations so far; the 4th is allowed, the 5th is not.
  assert.equal((await post('/api/translate', { text: 'hola', kind: 'plain' })).status, 200);
  const res = await post('/api/translate', { text: 'hola', kind: 'plain' });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /too many translations/);
});
