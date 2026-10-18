// Projects admin: JSON API + static admin UI. Node 22 built-ins only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ConflictError } from './lib/store.js';
import { verifyPassword, signSession, verifySession, createRateLimiter } from './lib/auth.js';
import { validateProject, validateSomeWords, validateGlossary, uniqueSlug, isPermutation, slugOwner } from './lib/validation.js';
import { glossaryPath, prepareGlossary, missingTerms, termUsage, withPendingTerms } from './lib/glossary.js';
import { termKey, parseRichText } from './lib/rich-text.js';
import { translateAll } from './lib/translate.js';
import { LANGS } from './lib/languages.js';
import { parseEnv, loadConfig } from './lib/config.js';
import {
  writePublic, prepareFiles, someWordsPaths, writeSomeWordsPublic, prepareSomeWords, projectsAcPaths, writeProjectsAcPublic, prepareProjectsAc,
} from './lib/publish.js';
import { migrateProjects, migrateSomeWords } from './lib/languages.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOTS = { '/tipos/': path.resolve(HERE, '../tipos'), '/': path.join(HERE, 'public') };
// The UI imports the same parser the server validates with, and the styles the site bundles;
// only these files leave lib/.
const SHARED_FILES = {
  '/rich-text.js': path.join(HERE, 'lib/rich-text.js'),
  '/rich-text-dom.js': path.join(HERE, 'lib/rich-text-dom.js'),
  '/rich-text.css': path.join(HERE, 'lib/rich-text.css'),
  '/slug.js': path.join(HERE, 'lib/slug.js'),
  '/term-tooltip.js': path.join(HERE, 'lib/term-tooltip.js'),
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
// The longest translated field ("how I used AI", lib/validation.js).
const TRANSLATE_MAX = 5000;

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
  if (Object.hasOwn(SHARED_FILES, pathname)) return sendFile(res, SHARED_FILES[pathname], MIME[path.extname(pathname)]);
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
  glossaryFile = glossaryPath(dataFile),
  projectsAcFile = projectsAcPaths({ dataFile, publicFile }).projectsAcFile,
  projectsAcPublicFile = projectsAcPaths({ dataFile, publicFile }).projectsAcPublicFile,
  translateFetch = globalThis.fetch, translateLimit = { max: 30, windowMs: 60 * 1000 },
}) {
  // Older files (plain strings) are read as { ca, en, es } and stored that way on the next write.
  const store = createStore(dataFile, { migrate: migrateProjects });
  const wordsStore = createStore(someWordsFile, { migrate: migrateSomeWords });
  const acStore = createStore(projectsAcFile, { migrate: migrateProjects }); // projects (B.C.)
  const glossaryStore = createStore(glossaryFile);
  // Before the first boot creates them, a missing glossary or projects (B.C.) file reads as empty.
  const readOrEmpty = (fileStore, empty) => fileStore.read().then(({ data }) => data, (err) => {
    if (err.code === 'ENOENT') return empty;
    throw err;
  });
  const readGlossary = () => readOrEmpty(glossaryStore, { terms: [] });
  const readProjectsAc = () => readOrEmpty(acStore, { projects: [] });
  const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
  // Translations per client and minute, to go easy on the third-party translator. Every call is
  // recorded as a "failure" of this limiter, so the window counts calls.
  const translateLimiter = createRateLimiter(translateLimit);
  const cookieAttrs = `HttpOnly; SameSite=Strict; Path=${cookiePath}${cookieSecure ? '; Secure' : ''}`;
  // A private file plus its public copies: mutations run under If-Match, then republish.
  // Public writes (of every resource: the glossary republishes the others) run one at a time, in
  // mutation order, and each reads the current private data, so an older copy can never land last.
  let publishQueue = Promise.resolve();
  function resource(resourceStore, writeCopy, shape) {
    const publish = (data) => {
      const run = publishQueue.then(() => writeCopy(data));
      publishQueue = run.catch(() => {});
      return run;
    };
    // termTexts: the saved rich texts whose unknown {{term}}s join the glossary as pending (content
    // saves only; the response then carries addedTerms). Done after the content is saved and before
    // publishing, so the public files are built with the updated glossary.
    return async function mutate(req, res, status, fn, { termTexts = null } = {}) {
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
      const terms = termTexts ? await addPendingTerms(termTexts) : {};
      try {
        await publish(data);
      } catch (err) {
        // The private file is the source of truth; the next change (or boot) rebuilds the public copy.
        console.error(`admin: public file write failed: ${err.message}`);
        throw new HttpError(500, { error: 'saved, but the public file could not be updated. it will be retried on the next change.', version, ...terms });
      }
      sendJson(res, status, { ...shape(data), version, ...terms });
    };
  }
  const projectsShape = (data) => ({ projects: data.projects });
  // The two project collections share every rule; each has its own files, versions and slugs.
  // aiLabel: what the collection calls the rich-text field (in validation messages).
  const collections = [
    {
      path: '/api/projects', order: '/api/order', store, aiLabel: 'how I used AI',
      mutate: resource(store, async (data) => writePublic(publicFile, data, await readGlossary()), projectsShape),
    },
    {
      path: '/api/projects-ac', order: '/api/order-ac', store: acStore, aiLabel: 'how it was made',
      mutate: resource(acStore, async (data) => writeProjectsAcPublic(projectsAcPublicFile, data, await readGlossary()), projectsShape),
    },
  ].map((collection) => ({ ...collection, item: new RegExp(`^${collection.path}/([^/]+)$`) }));
  const mutateWords = resource(wordsStore, async (data) => writeSomeWordsPublic(someWordsPublicFile, data, await readGlossary()), (data) => ({ text: data.text }));
  const mutateGlossary = resource(glossaryStore, async (glossary) => {
    const [{ data: projects }, { data: words }, projectsAc] = await Promise.all([store.read(), wordsStore.read(), readProjectsAc()]);
    await writePublic(publicFile, projects, glossary);
    await writeSomeWordsPublic(someWordsPublicFile, words, glossary);
    await writeProjectsAcPublic(projectsAcPublicFile, projectsAc, glossary);
  }, (data) => ({ terms: data.terms }));

  // {{term}}s (without their own explanation) the glossary lacks are added to it on save, so they must
  // be valid glossary terms (no { or }, see validateGlossary). value: { ca, en, es } or undefined.
  async function assertTermsAddable(field, label, value) {
    if (!value) return;
    const keys = new Set((await readGlossary()).terms.map((entry) => termKey(entry.term)));
    const errors = {};
    for (const lang of LANGS) {
      const bad = missingTerms(value[lang], keys).filter((term) => /[{}]/.test(term));
      if (bad.length) {
        errors[`${field}.${lang}`] = bad.map((term) => `${label} (${lang}): "${term}" cannot be a glossary term ({ and } are not allowed): rename it or write {{${term}|explanation}}`).join(' ');
      }
    }
    if (Object.keys(errors).length) throw invalid(errors);
  }

  // Appends the texts' unknown {{term}}s to the glossary as pending. Runs after the content is saved:
  // a failure here never undoes that save; it is reported as glossaryError (status stays 2xx) and the
  // terms are added on the next save of a text that uses them. No write when nothing is new, so the
  // glossary version (and an open glossary view) only changes when a term was added.
  async function addPendingTerms(texts) {
    let wanted;
    try {
      wanted = withPendingTerms(await readGlossary(), texts).added;
      if (!wanted.length) return { addedTerms: [] };
      let added = [];
      // Recomputed on the current file, inside the store's queue (the glossary may have changed).
      await glossaryStore.update(null, (current) => {
        const next = withPendingTerms(current, texts);
        added = next.added;
        return next.glossary;
      });
      return { addedTerms: added };
    } catch (err) {
      console.error(`admin: glossary write failed: ${err.message}`);
      const names = (wanted ?? []).map((term) => `"${term}"`).join(', ') || 'the new terms';
      return { addedTerms: [], glossaryError: `saved, but ${names} could not be added to the glossary (shown as plain words until then). save again to retry.` };
    }
  }

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
  // A per-language value in language order (ca first, so a term keeps its ca spelling), or none.
  const textsOf = (value) => (value ? LANGS.map((lang) => value[lang]) : []);
  const invalid = (errors) => new HttpError(400, { error: 'validation failed', errors });
  // Checked inside the mutation, against the data it is about to change.
  const assertSlugFree = (projects, slug, exceptId) => {
    const owner = slugOwner(projects, slug, exceptId);
    if (owner) throw invalid({ id: `already used by ${owner.title}` });
  };

  // Routes of one project collection. Returns true when it handled the request.
  async function projectRoutes({ path: base, order, store: collectionStore, aiLabel, mutate, item }, req, res, pathname, body) {
    const { method } = req;
    if (method === 'GET' && pathname === base) {
      const { data, version } = await collectionStore.read();
      sendJson(res, 200, { projects: data.projects, version });
      return true;
    }
    if (method === 'POST' && pathname === base) {
      const { position, ...fields } = body;
      const { value, errors } = validateProject(fields, { aiLabel });
      if (Object.keys(errors).length) throw invalid(errors);
      await assertTermsAddable('ai', aiLabel, value.ai);
      await mutate(req, res, 201, (data) => {
        if (value.id) assertSlugFree(data.projects, value.id);
        const project = { id: value.id || uniqueSlug(value.title, data.projects.map((p) => p.id)), ...value };
        if (position === 'top') data.projects.unshift(project);
        else data.projects.push(project);
        return data;
      }, { termTexts: textsOf(value.ai) });
      return true;
    }
    if (method === 'PUT' && pathname === order) {
      await mutate(req, res, 200, (data) => {
        if (!isPermutation(body.ids, data.projects.map((p) => p.id))) {
          throw new HttpError(400, { error: 'ids must be an exact permutation of the current ids' });
        }
        const byId = new Map(data.projects.map((p) => [p.id, p]));
        data.projects = body.ids.map((id) => byId.get(id));
        return data;
      });
      return true;
    }
    const match = item.exec(pathname);
    if (!match || (method !== 'PUT' && method !== 'DELETE')) return false;
    const id = decodeURIComponent(match[1]);
    if (method === 'DELETE') {
      await mutate(req, res, 200, (data) => {
        data.projects.splice(findIndex(data.projects, id), 1);
        return data;
      });
      return true;
    }
    const { value, errors } = validateProject(body, { partial: true, aiLabel });
    if (Object.keys(errors).length) throw invalid(errors);
    await assertTermsAddable('ai', aiLabel, value.ai);
    await mutate(req, res, 200, (data) => {
      const index = findIndex(data.projects, id);
      if (value.id) assertSlugFree(data.projects, value.id, id);
      // A new id replaces the old one in place: same position, no alias for the old address.
      data.projects[index] = { ...data.projects[index], ...value };
      return data;
    }, { termTexts: textsOf(value.ai) });
    return true;
  }

  // { text, kind: 'rich' | 'plain', max? } (ca) -> { en: { text, warnings } | { error }, es: … }. Changes
  // nothing, so no If-Match; the form fills en / es and the user saves as usual.
  async function translate(req, res, body) {
    const ip = clientIp(req);
    if (translateLimiter.isBlocked(ip)) throw new HttpError(429, { error: 'too many translations, wait a minute and try again' });
    const { text, kind, max } = body;
    if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, { error: 'text is required' });
    if (text.length > TRANSLATE_MAX) throw new HttpError(400, { error: `text must be ${TRANSLATE_MAX} characters or fewer` });
    if (kind !== 'rich' && kind !== 'plain') throw new HttpError(400, { error: 'kind must be rich or plain' });
    if (max !== undefined && !(Number.isInteger(max) && max >= 1 && max <= TRANSLATE_MAX)) {
      throw new HttpError(400, { error: `max must be a whole number from 1 to ${TRANSLATE_MAX}` });
    }
    if (kind === 'rich') {
      const { errors } = parseRichText(text);
      if (errors.length) throw new HttpError(400, { error: `fix the ca text first: ${errors.join(' ')}` });
    }
    translateLimiter.fail(ip);
    const result = await translateAll(text.trim(), { kind, max, fetch: translateFetch });
    const failed = Object.values(result).every((item) => item.error);
    sendJson(res, failed ? 502 : 200, failed ? { error: `could not translate: ${result.en.error}`, ...result } : result);
  }

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
    for (const collection of collections) {
      if (await projectRoutes(collection, req, res, pathname, body)) return;
    }
    if (method === 'POST' && pathname === '/api/translate') return translate(req, res, body);
    if (method === 'GET' && pathname === '/api/some-words') {
      const { data, version } = await wordsStore.read();
      return sendJson(res, 200, { text: data.text, version });
    }
    if (method === 'PUT' && pathname === '/api/some-words') {
      const { value, errors } = validateSomeWords(body);
      if (Object.keys(errors).length) throw invalid(errors);
      await assertTermsAddable('text', 'text', value.text);
      return mutateWords(req, res, 200, () => ({ text: value.text }), { termTexts: textsOf(value.text) });
    }
    if (method === 'GET' && pathname === '/api/glossary') {
      const { data, version } = await glossaryStore.read();
      return sendJson(res, 200, { terms: data.terms, version });
    }
    if (method === 'PUT' && pathname === '/api/glossary') {
      const { value, errors } = validateGlossary(body);
      if (Object.keys(errors).length) throw invalid(errors);
      return mutateGlossary(req, res, 200, async (current) => {
        // Removing (or renaming) a term is refused while a text still uses it without its own explanation.
        const kept = new Set(value.terms.map((entry) => termKey(entry.term)));
        const removed = (current.terms ?? []).filter((entry) => !kept.has(termKey(entry.term)));
        if (removed.length) {
          const [{ data: projects }, { data: words }, projectsAc] = await Promise.all([store.read(), wordsStore.read(), readProjectsAc()]);
          const blocked = removed
            .map((entry) => [entry.term, termUsage({ projects, projectsAc, words }, termKey(entry.term))])
            .filter(([, places]) => places.length);
          if (blocked.length) {
            throw invalid({ _usage: blocked.map(([term, places]) => `"${term}" is still used in ${places.join(', ')}: remove it there, or give it its own explanation there ({{${term}|…}}).`).join(' ') });
          }
        }
        return { terms: value.terms };
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
    const { created } = await prepareGlossary(config);
    if (created) console.log(`admin: created an empty glossary (${config.glossaryFile})`);
    const glossary = JSON.parse(readFileSync(config.glossaryFile, 'utf8'));
    const { seeded } = await prepareFiles({ ...config, glossary });
    if (seeded) console.log(`admin: seeded DATA_FILE from PUBLIC_FILE (${config.dataFile})`);
    // Last resort for "some words": the default committed in the repo (absent on the server,
    // where the deploy seeds the public copy instead).
    const defaultFile = path.resolve(HERE, '../projects/data/some-words.json');
    const words = await prepareSomeWords({ ...config, defaultFile, glossary });
    if (words.seeded) console.log(`admin: seeded ${config.someWordsFile} from ${words.seeded}`);
    const { created: acCreated } = await prepareProjectsAc({ ...config, glossary });
    if (acCreated) console.log(`admin: created an empty projects (B.C.) list (${config.projectsAcFile})`);
  } catch (err) {
    console.error(`admin: ${err.message}`);
    process.exit(1);
  }
  createApp(config).listen(config.port, config.host, () => {
    console.log(`admin listening on http://${config.host}:${config.port}`);
  });
}
