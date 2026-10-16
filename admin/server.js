// Projects admin: JSON API + static admin UI. Node 22 built-ins only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ConflictError } from './lib/store.js';
import { verifyPassword, signSession, verifySession, createRateLimiter } from './lib/auth.js';
import { validateProject, validateSomeWords, uniqueSlug, isPermutation } from './lib/validation.js';
import { parseEnv, loadConfig } from './lib/config.js';
import { writePublic, prepareFiles, someWordsPaths, writeSomeWordsPublic, prepareSomeWords } from './lib/publish.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOTS = { '/tipos/': path.resolve(HERE, '../tipos'), '/': path.join(HERE, 'public') };
// The UI imports the same parser the server validates with; only these two files leave lib/.
const SHARED_FILES = {
  '/rich-text.js': path.join(HERE, 'lib/rich-text.js'),
  '/rich-text-dom.js': path.join(HERE, 'lib/rich-text-dom.js'),
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' https: data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};
const COOKIE = 'admin_session';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_BODY = 64 * 1024;

class HttpError extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, { error: 'request body too large' });
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) ?? {};
  } catch {
    throw new HttpError(400, { error: 'invalid JSON' });
  }
}

function getCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

// Blocks cross-site form posts and foreign origins: JSON only, and Origin (when sent) must match Host.
function checkCsrf(req) {
  const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, { error: 'expected application/json' });
  const { origin } = req.headers;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    host = null;
  }
  if (host !== req.headers.host) throw new HttpError(403, { error: 'cross-origin request rejected' });
}

async function sendFile(res, file, type) {
  const body = await readFile(file);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  return res.end(body);
}

async function serveStatic(res, pathname) {
  if (Object.hasOwn(SHARED_FILES, pathname)) return sendFile(res, SHARED_FILES[pathname], MIME['.js']);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = null;
  }
  const prefix = decoded && !decoded.includes('\0') && Object.keys(STATIC_ROOTS).find((p) => decoded.startsWith(p));
  if (prefix) {
    const root = STATIC_ROOTS[prefix];
    const relative = decoded === '/' ? 'index.html' : decoded.slice(prefix.length);
    const file = path.resolve(root, relative);
    const type = MIME[path.extname(file)];
    if (type && file.startsWith(root + path.sep)) {
      try {
        return await sendFile(res, file, type);
      } catch { /* fall through to 404 */ }
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  return res.end('not found');
}

export function createApp({
  dataFile, publicFile, passwordHash, sessionSecret, cookieSecure, publicUrl, cookiePath = '/', trustProxy = false, log = console.log,
  someWordsFile = someWordsPaths({ dataFile, publicFile }).someWordsFile,
  someWordsPublicFile = someWordsPaths({ dataFile, publicFile }).someWordsPublicFile,
}) {
  const store = createStore(dataFile);
  const wordsStore = createStore(someWordsFile);
  const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
  const cookieAttrs = `HttpOnly; SameSite=Strict; Path=${cookiePath}${cookieSecure ? '; Secure' : ''}`;
  // A private file plus its public copy: mutations run under If-Match, then republish.
  // Public writes run one at a time, in mutation order, so an older copy can never land last.
  function resource(resourceStore, writeCopy, shape) {
    let publishQueue = Promise.resolve();
    const publish = (data) => {
      const run = publishQueue.then(() => writeCopy(data));
      publishQueue = run.catch(() => {});
      return run;
    };
    return async function mutate(req, res, status, fn) {
      const expected = req.headers['if-match'];
      if (!expected) throw new HttpError(428, { error: 'If-Match header required' });
      let data;
      let version;
      try {
        ({ data, version } = await resourceStore.update(expected.replace(/^"|"$/g, ''), fn));
      } catch (err) {
        if (err instanceof ConflictError) throw new HttpError(409, { error: 'data changed elsewhere', version: err.version });
        throw err;
      }
      try {
        await publish(data);
      } catch (err) {
        // The private file is the source of truth; the next change (or boot) rebuilds the public copy.
        console.error(`admin: public file write failed: ${err.message}`);
        throw new HttpError(500, { error: 'saved, but the public file could not be updated. it will be retried on the next change.', version });
      }
      sendJson(res, status, { ...shape(data), version });
    };
  }
  const mutate = resource(store, (data) => writePublic(publicFile, data), (data) => ({ projects: data.projects }));
  const mutateWords = resource(wordsStore, (data) => writeSomeWordsPublic(someWordsPublicFile, data), (data) => ({ text: data.text }));

  // Behind the proxy every socket is 127.0.0.1; only then trust its headers (otherwise they are spoofable).
  function clientIp(req) {
    if (trustProxy) {
      const forwarded = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0];
      if (forwarded && forwarded.trim()) return forwarded.trim();
    }
    return req.socket.remoteAddress;
  }

  const findIndex = (projects, id) => {
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) throw new HttpError(404, { error: 'project not found' });
    return index;
  };
  const invalid = (errors) => new HttpError(400, { error: 'validation failed', errors });

  async function api(req, res, pathname) {
    const { method } = req;
    const body = method === 'GET' ? null : (checkCsrf(req), await readJson(req));

    if (method === 'POST' && pathname === '/api/login') {
      const ip = clientIp(req);
      if (limiter.isBlocked(ip)) throw new HttpError(429, { error: 'too many attempts, try again later' });
      // Always run scrypt so a wrong password costs the same as a right one.
      const ok = verifyPassword(typeof body.password === 'string' ? body.password : '', passwordHash);
      if (!ok) {
        limiter.fail(ip);
        throw new HttpError(401, { error: 'wrong password' });
      }
      limiter.reset(ip);
      const token = signSession(sessionSecret, Date.now(), SESSION_TTL);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=${token}; Max-Age=${SESSION_TTL / 1000}; ${cookieAttrs}` });
    }
    if (method === 'POST' && pathname === '/api/logout') {
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Max-Age=0; ${cookieAttrs}` });
    }

    const loggedIn = verifySession(getCookie(req, COOKIE), sessionSecret);
    if (method === 'GET' && pathname === '/api/session') return sendJson(res, 200, { loggedIn });
    if (!loggedIn) throw new HttpError(401, { error: 'not logged in' });

    if (method === 'GET' && pathname === '/api/config') return sendJson(res, 200, { publicUrl });
    if (method === 'GET' && pathname === '/api/projects') {
      const { data, version } = await store.read();
      return sendJson(res, 200, { projects: data.projects, version });
    }
    if (method === 'POST' && pathname === '/api/projects') {
      const { position, ...fields } = body;
      const { value, errors } = validateProject(fields);
      if (Object.keys(errors).length) throw invalid(errors);
      return mutate(req, res, 201, (data) => {
        const project = { id: uniqueSlug(value.title, data.projects.map((p) => p.id)), ...value };
        if (position === 'top') data.projects.unshift(project);
        else data.projects.push(project);
        return data;
      });
    }
    if (method === 'PUT' && pathname === '/api/order') {
      return mutate(req, res, 200, (data) => {
        if (!isPermutation(body.ids, data.projects.map((p) => p.id))) {
          throw new HttpError(400, { error: 'ids must be an exact permutation of the current ids' });
        }
        const byId = new Map(data.projects.map((p) => [p.id, p]));
        data.projects = body.ids.map((id) => byId.get(id));
        return data;
      });
    }
    if (method === 'GET' && pathname === '/api/some-words') {
      const { data, version } = await wordsStore.read();
      return sendJson(res, 200, { text: data.text, version });
    }
    if (method === 'PUT' && pathname === '/api/some-words') {
      const { value, errors } = validateSomeWords(body);
      if (Object.keys(errors).length) throw invalid(errors);
      return mutateWords(req, res, 200, () => ({ text: value.text }));
    }
    const match = /^\/api\/projects\/([^/]+)$/.exec(pathname);
    if (match && (method === 'PUT' || method === 'DELETE')) {
      const id = decodeURIComponent(match[1]);
      if (method === 'DELETE') {
        return mutate(req, res, 200, (data) => {
          data.projects.splice(findIndex(data.projects, id), 1);
          return data;
        });
      }
      const { value, errors } = validateProject(body, { partial: true });
      if (Object.keys(errors).length) throw invalid(errors);
      return mutate(req, res, 200, (data) => {
        const index = findIndex(data.projects, id);
        data.projects[index] = { ...data.projects[index], ...value };
        return data;
      });
    }
    throw new HttpError(404, { error: 'not found' });
  }

  return http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const { pathname } = new URL(req.url, 'http://localhost');
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log(`${req.method} ${pathname} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
    try {
      if (pathname.startsWith('/api/')) await api(req, res, pathname);
      else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(res, pathname);
      else sendJson(res, 405, { error: 'method not allowed' });
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, err.body);
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    }
  });
}

// Boot only when run directly (tests import createApp).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envFile = path.join(HERE, '.env');
  const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  let config;
  try {
    config = loadConfig({ ...fileEnv, ...process.env });
  } catch (err) {
    console.error(`admin: ${err.message}. See admin/README.md.`);
    process.exit(1);
  }
  try {
    const { seeded } = await prepareFiles(config);
    if (seeded) console.log(`admin: seeded DATA_FILE from PUBLIC_FILE (${config.dataFile})`);
    // Last resort for "some words": the default committed in the repo (absent on the server,
    // where the deploy seeds the public copy instead).
    const defaultFile = path.resolve(HERE, '../projects/data/some-words.json');
    const words = await prepareSomeWords({ ...config, defaultFile });
    if (words.seeded) console.log(`admin: seeded ${config.someWordsFile} from ${words.seeded}`);
  } catch (err) {
    console.error(`admin: ${err.message}`);
    process.exit(1);
  }
  createApp(config).listen(config.port, config.host, () => {
    console.log(`admin listening on http://${config.host}:${config.port}`);
  });
}
