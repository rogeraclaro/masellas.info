import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'localdev';
const seed = {
  projects: [
    { id: 'ledger', title: 'Ledger', category: 'web app', year: 2026, description: '', url: 'https://ledger.example.com', visible: true, thumbs: [] },
    { id: 'rollcall', title: 'Rollcall', category: 'tool', year: 2026, description: '', url: 'https://rollcall.example.com', visible: true, thumbs: [] },
  ],
};

let dataFile;
let passwordHash;

async function boot() {
  const app = createApp({
    dataFile,
    passwordHash,
    sessionSecret: 'f'.repeat(64),
    cookieSecure: false,
    publicUrl: 'http://localhost:8765/projects/',
    log: () => {},
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  return { app, base };
}

function call(base, method, pathname, { body, cookie, version, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined || method !== 'GET') h['content-type'] ??= 'application/json';
  if (cookie) h.cookie = cookie;
  if (version) h['if-match'] = version;
  return fetch(base + pathname, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

let server;
let base;
let cookie;

before(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admin-http-'));
  dataFile = path.join(dir, 'projects.json');
  await writeFile(dataFile, `${JSON.stringify(seed, null, 2)}\n`);
  passwordHash = hashPassword(PASSWORD);
  ({ app: server, base } = await boot());
});

after(() => server.close());

test('security headers are sent', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'same-origin');
});

test('API requires a session', async () => {
  const res = await call(base, 'GET', '/api/projects');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('session endpoint reports login state without a 401', async () => {
  const res = await call(base, 'GET', '/api/session');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { loggedIn: false });
});

test('wrong password is rejected with 401', async () => {
  const res = await call(base, 'POST', '/api/login', { body: { password: 'nope' } });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('right password sets a hardened session cookie', async () => {
  const res = await call(base, 'POST', '/api/login', { body: { password: PASSWORD } });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\//);
  assert.doesNotMatch(setCookie, /Secure/, 'COOKIE_SECURE=false omits Secure');
  cookie = setCookie.split(';')[0];
});

test('config exposes the public URL', async () => {
  const res = await call(base, 'GET', '/api/config', { cookie });
  assert.deepEqual(await res.json(), { publicUrl: 'http://localhost:8765/projects/' });
});

test('CRUD round-trip with versions', async () => {
  let res = await call(base, 'GET', '/api/projects', { cookie });
  assert.equal(res.status, 200);
  let json = await res.json();
  assert.equal(json.projects.length, 2);
  let { version } = json;

  res = await call(base, 'POST', '/api/projects', { cookie, version, body: { title: 'Ledger', category: 'Tool', year: 2025, url: 'https://x.example.com', position: 'top' } });
  assert.equal(res.status, 201);
  json = await res.json();
  assert.equal(json.projects[0].id, 'ledger-2', 'unique slug, inserted at top');
  assert.equal(json.projects[0].category, 'tool');
  assert.equal(json.projects[0].visible, true);
  version = json.version;

  res = await call(base, 'POST', '/api/projects', { cookie, version, body: { title: 'Seat Map', category: 'web app', year: 2025, url: 'https://seat.example.com' } });
  json = await res.json();
  assert.equal(json.projects.at(-1).id, 'seat-map', 'appended at the end by default');
  version = json.version;

  res = await call(base, 'PUT', '/api/projects/ledger-2', { cookie, version, body: { visible: false, title: 'Ledger two' } });
  assert.equal(res.status, 200);
  json = await res.json();
  assert.equal(json.projects[0].visible, false);
  assert.equal(json.projects[0].title, 'Ledger two');
  assert.equal(json.projects[0].id, 'ledger-2', 'id is stable on edit');
  version = json.version;

  res = await call(base, 'PUT', '/api/projects/ledger-2', { cookie, version, body: { year: 1900 } });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.year);

  res = await call(base, 'PUT', '/api/order', { cookie, version, body: { ids: ['seat-map', 'rollcall'] } });
  assert.equal(res.status, 400, 'not a permutation');

  res = await call(base, 'PUT', '/api/order', { cookie, version, body: { ids: ['seat-map', 'rollcall', 'ledger', 'ledger-2'] } });
  assert.equal(res.status, 200);
  json = await res.json();
  assert.deepEqual(json.projects.map((p) => p.id), ['seat-map', 'rollcall', 'ledger', 'ledger-2']);
  version = json.version;

  res = await call(base, 'DELETE', '/api/projects/ledger-2', { cookie, version });
  assert.equal(res.status, 200);
  json = await res.json();
  assert.equal(json.projects.length, 3);

  res = await call(base, 'DELETE', '/api/projects/ledger-2', { cookie, version: json.version });
  assert.equal(res.status, 404);

  const onDisk = JSON.parse(await readFile(dataFile, 'utf8'));
  assert.deepEqual(Object.keys(onDisk), ['projects']);
  assert.equal(onDisk.projects.length, 3);
});

test('stale If-Match returns 409 with the current version', async () => {
  const res = await call(base, 'PUT', '/api/projects/ledger', { cookie, version: 'stale', body: { visible: false } });
  assert.equal(res.status, 409);
  assert.match((await res.json()).version, /^[0-9a-f]{64}$/);
});

test('missing If-Match returns 428', async () => {
  const res = await call(base, 'PUT', '/api/projects/ledger', { cookie, body: { visible: false } });
  assert.equal(res.status, 428);
});

test('cross-origin state-changing requests are rejected', async () => {
  const res = await call(base, 'POST', '/api/login', { body: { password: PASSWORD }, headers: { origin: 'https://evil.example.com' } });
  assert.equal(res.status, 403);
});

test('non-JSON state-changing requests are rejected', async () => {
  const res = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'password=localdev' });
  assert.equal(res.status, 415);
});

test('oversized bodies are rejected', async () => {
  const res = await call(base, 'POST', '/api/login', { body: { password: 'x'.repeat(70 * 1024) } });
  assert.equal(res.status, 413);
});

test('static serving is path-traversal safe', async () => {
  for (const p of ['/../server.js', '/..%2fserver.js', '/%2e%2e/%2e%2e/etc/passwd', '/tipos/..%2f..%2fadmin%2fserver.js', '/tipos/%00.woff2']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 404, p);
  }
});

test('fonts are served from the repo tipos/ directory', async () => {
  const res = await fetch(`${base}/tipos/aglt-bold-webfont.woff2`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'font/woff2');
});

test('logout clears the cookie', async () => {
  const res = await call(base, 'POST', '/api/logout', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('login is rate limited after 5 failures per IP', async () => {
  const { app, base: other } = await boot();
  try {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await call(other, 'POST', '/api/login', { body: { password: 'bad' } })).status, 401);
    }
    const res = await call(other, 'POST', '/api/login', { body: { password: PASSWORD } });
    assert.equal(res.status, 429);
  } finally {
    app.close();
  }
});
