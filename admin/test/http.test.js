import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'localdev';
const all = (text) => ({ ca: text, en: text, es: text });
const only = (ca, en = '', es = '') => ({ ca, en, es });
const seed = {
  projects: [
    { id: 'ledger', title: 'Ledger', category: 'web app', year: 2026, description: '', url: 'https://ledger.example.com', visible: true, thumbs: [] },
    { id: 'rollcall', title: 'Rollcall', category: 'tool', year: 2026, description: '', url: 'https://rollcall.example.com', visible: true, thumbs: [] },
  ],
};

let dataFile;
let publicFile;
let passwordHash;

async function boot(overrides = {}) {
  const app = createApp({
    dataFile,
    publicFile,
    passwordHash,
    sessionSecret: 'f'.repeat(64),
    cookieSecure: false,
    publicUrl: 'http://localhost:8765/projects/',
    log: () => {},
    ...overrides,
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
  await mkdir(path.join(dir, 'private'));
  await mkdir(path.join(dir, 'web'));
  dataFile = path.join(dir, 'private', 'projects.json');
  publicFile = path.join(dir, 'web', 'projects.json');
  await writeFile(dataFile, `${JSON.stringify(seed, null, 2)}\n`);
  // "some words" files sit next to the projects files (derived, no extra config).
  await writeFile(path.join(dir, 'private', 'some-words.json'), `${JSON.stringify({ text: 'Hello.' }, null, 2)}\n`);
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
  assert.deepEqual(json.projects[0].category, all('web app'), 'legacy strings are read as { ca, en, es }');
  assert.deepEqual(json.projects[0].description, all(''));
  let { version } = json;

  res = await call(base, 'POST', '/api/projects', { cookie, version, body: { title: 'Ledger', category: 'Tool', year: 2025, url: 'https://x.example.com' } });
  assert.equal(res.status, 400, 'a plain string is not accepted for a per-language field');

  res = await call(base, 'POST', '/api/projects', { cookie, version, body: { title: 'Ledger', category: only('Tool'), year: 2025, url: 'https://x.example.com', position: 'top' } });
  assert.equal(res.status, 201);
  json = await res.json();
  assert.equal(json.projects[0].id, 'ledger-2', 'unique slug, inserted at top');
  assert.deepEqual(json.projects[0].category, only('tool'));
  assert.equal(json.projects[0].visible, true);
  version = json.version;

  res = await call(base, 'POST', '/api/projects', { cookie, version, body: { title: 'Seat Map', category: only('web app'), year: 2025, url: 'https://seat.example.com' } });
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

  res = await call(base, 'PUT', '/api/projects/ledger-2', { cookie, version, body: { year: '' } });
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
  assert.deepEqual(onDisk.projects.find((p) => p.id === 'ledger').category, all('web app'), 'the write stored the migrated shape');
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

// fetch cannot set Host, so this goes through node:http.
function rawLogin(base, headers, password) {
  const { port } = new URL(base);
  const body = JSON.stringify({ password });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/login', method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('origin check passes when Origin matches the Host sent by the proxy', async () => {
  const ok = await rawLogin(base, { host: 'masellas.info', origin: 'https://masellas.info' }, 'wrong');
  assert.equal(ok.statusCode, 401, 'reaches the password check');
  const bad = await rawLogin(base, { host: 'masellas.info', origin: 'https://evil.example.com' }, 'wrong');
  assert.equal(bad.statusCode, 403);
});

test('COOKIE_PATH scopes the session cookie', async () => {
  const { app, base: other } = await boot({ cookiePath: '/admin/' });
  try {
    const login = await call(other, 'POST', '/api/login', { body: { password: PASSWORD } });
    assert.match(login.headers.get('set-cookie'), /Path=\/admin\/(;|$)/);
    const logout = await call(other, 'POST', '/api/logout');
    assert.match(logout.headers.get('set-cookie'), /Path=\/admin\/(;|$)/);
  } finally {
    app.close();
  }
});

const failLogins = async (target, headers, times = 5) => {
  for (let i = 0; i < times; i += 1) {
    assert.equal((await call(target, 'POST', '/api/login', { body: { password: 'bad' }, headers })).status, 401);
  }
};

test('TRUST_PROXY=true rate-limits per X-Real-IP / first X-Forwarded-For entry', async () => {
  const { app, base: other } = await boot({ trustProxy: true });
  try {
    await failLogins(other, { 'x-real-ip': '203.0.113.1' });
    assert.equal((await call(other, 'POST', '/api/login', { body: { password: PASSWORD }, headers: { 'x-real-ip': '203.0.113.1' } })).status, 429, 'attacker blocked');
    assert.equal((await call(other, 'POST', '/api/login', { body: { password: PASSWORD }, headers: { 'x-real-ip': '203.0.113.2' } })).status, 200, 'other client unaffected');

    await failLogins(other, { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' });
    assert.equal((await call(other, 'POST', '/api/login', { body: { password: PASSWORD }, headers: { 'x-forwarded-for': '198.51.100.7' } })).status, 429, 'falls back to X-Forwarded-For');
  } finally {
    app.close();
  }
});

test('TRUST_PROXY=false ignores forwarding headers (they are spoofable)', async () => {
  const { app, base: other } = await boot({ trustProxy: false });
  try {
    for (let i = 0; i < 5; i += 1) await failLogins(other, { 'x-real-ip': `203.0.113.${i}` }, 1);
    const res = await call(other, 'POST', '/api/login', { body: { password: PASSWORD }, headers: { 'x-real-ip': '203.0.113.99' } });
    assert.equal(res.status, 429, 'rotating X-Real-IP does not escape the limit');
  } finally {
    app.close();
  }
});

const publicIds = async (file = publicFile) => JSON.parse(await readFile(file, 'utf8')).projects.map((p) => p.id);

test('public file is regenerated after every mutation, without hidden projects', async () => {
  let { version } = await (await call(base, 'GET', '/api/projects', { cookie })).json();
  const step = async (method, pathname, body) => {
    const res = await call(base, method, pathname, { cookie, version, body });
    assert.ok(res.ok, `${method} ${pathname} -> ${res.status}`);
    ({ version } = await res.json());
  };

  await step('POST', '/api/projects', { title: 'Public Check', category: only('tool'), year: 2026, url: 'https://pc.example.com' });
  assert.ok((await publicIds()).includes('public-check'), 'create');

  await step('PUT', '/api/projects/public-check', { visible: false });
  assert.ok(!(await publicIds()).includes('public-check'), 'toggle hidden');
  const pub = JSON.parse(await readFile(publicFile, 'utf8'));
  assert.ok(pub.projects.every((p) => !('visible' in p)), 'no visible field in public file');

  await step('PUT', '/api/projects/public-check', { visible: true, title: 'Public Two' });
  assert.equal(JSON.parse(await readFile(publicFile, 'utf8')).projects.find((p) => p.id === 'public-check').title, 'Public Two', 'update');

  const ids = (await (await call(base, 'GET', '/api/projects', { cookie })).json()).projects.map((p) => p.id).reverse();
  await step('PUT', '/api/order', { ids });
  assert.deepEqual(await publicIds(), ids, 'reorder');

  await step('DELETE', '/api/projects/public-check');
  assert.ok(!(await publicIds()).includes('public-check'), 'delete');

  assert.deepEqual(
    (await readdir(path.dirname(publicFile))).sort(),
    ['projects.ca.json', 'projects.en.json', 'projects.es.json', 'projects.json'],
    'no .bak or temp files in the public dir',
  );
});

test('editing one language publishes it only there; other languages keep (or fall back to) ca', async () => {
  const web = path.dirname(publicFile);
  const published = async (lang) => JSON.parse(await readFile(path.join(web, `projects.${lang}.json`), 'utf8')).projects.find((p) => p.id === 'rollcall');
  let { version } = await (await call(base, 'GET', '/api/projects', { cookie })).json();
  let res = await call(base, 'PUT', '/api/projects/rollcall', { cookie, version, body: { description: only('Text en català.', 'English only.', ''), category: only('eina', 'tool', '') } });
  assert.equal(res.status, 200);
  ({ version } = await res.json());
  assert.equal((await published('en')).description, 'English only.');
  assert.equal((await published('ca')).description, 'Text en català.');
  assert.equal((await published('es')).description, 'Text en català.', 'empty es falls back to ca');
  assert.equal((await published('es')).category, 'eina', 'empty es category falls back to ca');
  assert.equal((await published('en')).category, 'tool');

  res = await call(base, 'PUT', '/api/projects/rollcall', { cookie, version, body: { category: only('', 'tool', '') } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).errors['category.ca'], /category \(ca\) is required/);
});

test('public write failure returns 500, keeps the private change, and is retried on the next mutation', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admin-pubfail-'));
  const privateFile = path.join(dir, 'projects.json');
  const brokenPublic = path.join(dir, 'web-missing', 'projects.json');
  await writeFile(privateFile, `${JSON.stringify(seed, null, 2)}\n`);
  const { app, base: other } = await boot({ dataFile: privateFile, publicFile: brokenPublic, log: () => {} });
  try {
    const login = await call(other, 'POST', '/api/login', { body: { password: PASSWORD } });
    const session = login.headers.get('set-cookie').split(';')[0];
    let { version } = await (await call(other, 'GET', '/api/projects', { cookie: session })).json();

    let res = await call(other, 'PUT', '/api/projects/ledger', { cookie: session, version, body: { visible: false } });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /public file/);
    assert.match(body.version, /^[0-9a-f]{64}$/, 'reports the new private version');
    const onDisk = JSON.parse(await readFile(privateFile, 'utf8'));
    assert.equal(onDisk.projects[0].visible, false, 'private change is kept');

    await mkdir(path.dirname(brokenPublic));
    version = body.version;
    res = await call(other, 'PUT', '/api/projects/rollcall', { cookie: session, version, body: { title: 'Rollcall' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await publicIds(brokenPublic), ['rollcall'], 'retry regenerates the whole public file');
  } finally {
    app.close();
  }
});

test('some words: GET requires a session', async () => {
  assert.equal((await call(base, 'GET', '/api/some-words')).status, 401);
  assert.equal((await call(base, 'PUT', '/api/some-words', { body: { text: 'x' }, version: 'v' })).status, 401);
});

test('some words: GET returns text and version; PUT validates, saves, publishes and versions', async () => {
  let res = await call(base, 'GET', '/api/some-words', { cookie });
  assert.equal(res.status, 200);
  let json = await res.json();
  assert.deepEqual(json.text, all('Hello.'), 'legacy { text } is read per language');
  assert.match(json.version, /^[0-9a-f]{64}$/);
  const { version } = json;

  res = await call(base, 'PUT', '/api/some-words', { cookie, body: { text: all('No version.') } });
  assert.equal(res.status, 428);

  res = await call(base, 'PUT', '/api/some-words', { cookie, version, body: { text: only('Ok.', 'Bad [x](javascript:alert(1)).') } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).errors['text.en'], /javascript:alert\(1\)/);

  const text = 'First paragraph with [a link](https://example.com).\n\n[roger at lamosca.com](mailto:roger@lamosca.com)';
  res = await call(base, 'PUT', '/api/some-words', { cookie, version, body: { text: only(`  ${text}  `, 'English words.', '') } });
  assert.equal(res.status, 200);
  json = await res.json();
  assert.deepEqual(json.text, only(text, 'English words.', ''));
  assert.notEqual(json.version, version);

  const web = path.dirname(publicFile);
  const pub = async (name) => JSON.parse(await readFile(path.join(web, name), 'utf8'));
  assert.deepEqual(await pub('some-words.json'), { text }, 'legacy file = ca');
  assert.deepEqual(await pub('some-words.ca.json'), { text });
  assert.deepEqual(await pub('some-words.en.json'), { text: 'English words.' });
  assert.deepEqual(await pub('some-words.es.json'), { text }, 'empty es falls back to ca');
  const priv = path.dirname(dataFile);
  assert.deepEqual(JSON.parse(await readFile(path.join(priv, 'some-words.json'), 'utf8')).text, only(text, 'English words.', ''));
  assert.equal(JSON.parse(await readFile(path.join(priv, 'some-words.json.bak'), 'utf8')).text, 'Hello.');
  assert.ok(!(await readdir(web)).some((name) => name.endsWith('.bak')), 'no backup in the public dir');

  res = await call(base, 'PUT', '/api/some-words', { cookie, version, body: { text: all('Stale tab.') } });
  assert.equal(res.status, 409, 'old version is rejected');
  assert.equal((await res.json()).version, json.version);
});

test('some words: rejects foreign origins and non-JSON like the rest of the API', async () => {
  const res = await call(base, 'PUT', '/api/some-words', { cookie, version: 'v', body: { text: 'x' }, headers: { origin: 'https://evil.example.com' } });
  assert.equal(res.status, 403);
});

test('the shared rich-text modules are served for the UI, nothing else from lib/', async () => {
  for (const name of ['rich-text.js', 'rich-text-dom.js']) {
    const res = await fetch(`${base}/${name}`);
    assert.equal(res.status, 200, name);
    assert.match(res.headers.get('content-type'), /javascript/);
  }
  for (const p of ['/lib/store.js', '/store.js', '/lib/rich-text.js', '/config.js']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});
