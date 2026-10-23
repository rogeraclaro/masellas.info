import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectProjects, llmsText, projectPage, sitemapProjectsXml, writeSeoFiles, SITE, PAGES, DESCRIPTION, PROJECT_PAGE_MARK } from '../lib/seo-pages.js';
import { PAGES as BUILD_PAGES, LANGUAGES } from '../../scripts/build-pages.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGE = '<html><head>\n<!-- projects-ld:start --><!-- projects-ld:end -->\n</head><body><ul id="projects-list"><!-- projects:start --><!-- projects:end --></ul></body></html>';
const URL_EN = 'https://masellas.info/en/projects/';

const project = (id, extra = {}) => ({
  id, title: id.toUpperCase(), category: 'tool', year: 2026, description: `about ${id}`, url: `https://${id}.example.com`, thumbs: [], ai: '', tools: [], ...extra,
});

const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);

test('injectProjects puts one escaped row per project between the list markers, linking to its page <list path><id>/', () => {
  const html = injectProjects(PAGE, [project('ledger'), project('r-d', { title: 'R & D <b>', category: 'a "b"' })], URL_EN);
  const list = /<!-- projects:start -->(.*?)<!-- projects:end -->/s.exec(html)[1];
  assert.equal((list.match(/<li /g) || []).length, 2);
  assert.match(list, /<li data-category="tool"><a class="work-item" href="\/en\/projects\/ledger\/" data-static>/);
  assert.match(list, /<span class="work-item__title">LEDGER<\/span>/);
  assert.match(list, /tool \/ 2026/);
  assert.match(list, /about ledger/);
  assert.match(list, /R &amp; D &lt;b&gt;/);
  assert.match(list, /data-category="a &quot;b&quot;"/);
  assert.doesNotMatch(list, /<b>/);
});

test('injectProjects is idempotent: running it again replaces the rows and the JSON-LD', () => {
  const once = injectProjects(PAGE, [project('a'), project('b')], URL_EN);
  assert.equal(injectProjects(once, [project('a'), project('b')], URL_EN), once);
  const changed = injectProjects(once, [project('c')], URL_EN);
  assert.equal((changed.match(/<li /g) || []).length, 1);
  assert.equal((changed.match(/application\/ld\+json/g) || []).length, 1);
  assert.deepEqual(ldOf(changed).itemListElement.map((entry) => entry.item.name), ['C']);
});

test('the JSON-LD is an ItemList of CreativeWork with absolute urls, keywords and the AI text as plain text', () => {
  const rich = project('ledger', {
    thumbs: ['/projects/img/ledger.webp', '/projects/img/ledger-2.webp'],
    tools: ['Claude Code', 'esbuild'],
    ai: '## How\n\n**Claude** wrote a {{PWA|web app}} with [docs](https://x.example.com).\n\n- one\n- two',
  });
  const ld = ldOf(injectProjects(PAGE, [rich, project('bare', { year: '', description: '' })], URL_EN));
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'ItemList');
  assert.equal(ld.url, URL_EN);
  assert.equal(ld.numberOfItems, 2);
  const [first, second] = ld.itemListElement;
  assert.equal(first['@type'], 'ListItem');
  assert.equal(first.position, 1);
  assert.deepEqual(first.item, {
    '@type': 'CreativeWork',
    name: 'LEDGER',
    description: 'about ledger',
    url: 'https://masellas.info/en/projects/ledger/',
    dateCreated: '2026',
    keywords: 'Claude Code, esbuild',
    image: 'https://masellas.info/projects/img/ledger.webp',
    text: 'How\n\nClaude wrote a PWA with docs.\n\n- one\n- two',
  });
  assert.deepEqual(second.item, { '@type': 'CreativeWork', name: 'BARE', url: 'https://masellas.info/en/projects/bare/' }, 'empty fields are left out');
});

test('a project without a page (hasPage false) links to the legacy <list path>?p=<id>', () => {
  const html = injectProjects(PAGE, [project('ledger'), project('data')], URL_EN, (id) => id !== 'data');
  assert.match(html, /href="\/en\/projects\/ledger\/"/);
  assert.match(html, /href="\/en\/projects\/\?p=data"/);
  assert.equal(ldOf(html).itemListElement[1].item.url, 'https://masellas.info/en/projects/?p=data');
});

test('the JSON-LD can never close its <script>', () => {
  const html = injectProjects(PAGE, [project('x', { title: '</script><script>alert(1)</script>' })], URL_EN);
  const head = /<!-- projects-ld:start -->(.*?)<!-- projects-ld:end -->/s.exec(html)[1];
  assert.equal((head.match(/<\/script/gi) || []).length, 1, 'only the real closing tag');
  assert.equal(ldOf(html).itemListElement[0].item.name, '</script><script>alert(1)</script>');
});

test('injectProjects returns null when a marker pair is missing', () => {
  assert.equal(injectProjects('<ul></ul>', [project('a')], URL_EN), null);
  assert.equal(injectProjects(PAGE.replace('<!-- projects-ld:end -->', ''), [project('a')], URL_EN), null);
});

test('the committed projects pages have both marker pairs', async () => {
  for (const file of ['projects/index.html', 'en/projects-ac/index.html']) {
    const html = await readFile(path.join(REPO, file), 'utf8');
    assert.notEqual(injectProjects(html, [project('a')], URL_EN), null, file);
  }
});

test('PAGES and DESCRIPTION mirror the site build (scripts/build-pages.mjs, i18n/en.json)', async () => {
  const expected = BUILD_PAGES.flatMap((page) => LANGUAGES.map((lang) => `${SITE}${lang.prefix}${page.path}`));
  assert.deepEqual(PAGES.map((page) => page.url).sort(), expected.sort());
  const en = JSON.parse(await readFile(path.join(REPO, 'i18n/en.json'), 'utf8'));
  assert.equal(DESCRIPTION, en['home.description']);
});

test('llmsText: title, description, the nine pages and the projects sitemap, then every en project with its details', () => {
  const text = llmsText({
    projects: [project('ledger', { tools: ['Claude Code'], ai: 'Made with **Claude**.' })],
    'projects-ac': [project('old', { url: '' })],
  });
  assert.match(text, /^# Roger Masellas\n\n> Resumé site of Roger Masellas, frontend developer\.\n/);
  assert.equal((text.match(/^- \[.*\]\(https:\/\/masellas\.info\/.*\)$/gm) || []).length, 10);
  assert.match(text, /^- \[.*\]\(https:\/\/masellas\.info\/sitemap-projects\.xml\)$/m);
  assert.match(text, /- \[projects \(B\.C\.\) \(es\)\]\(https:\/\/masellas\.info\/es\/projects-ac\/\)/);
  assert.match(text, /## projects \(IA\)\n\n### \[LEDGER\]\(https:\/\/masellas\.info\/en\/projects\/ledger\/\)\n\n2026 \/ tool\n\nabout ledger\n\nTools: Claude Code\n\nLink: https:\/\/ledger\.example\.com\n\nMade with Claude\.\n/);
  assert.match(text, /## projects \(B\.C\.\)\n\n### \[OLD\]\(https:\/\/masellas\.info\/en\/projects-ac\/old\/\)\n\n2026 \/ tool\n\nabout old\n/);
  assert.doesNotMatch(text, /Link: \n|Tools: \n/, 'empty fields are left out');
  assert.ok(text.endsWith('\n'));
});

// A web root laid out like the server: projects/data/<collection>.<lang>.json and the pages.
async function webRoot({ pages = {}, collections = { projects: [project('ledger')], 'projects-ac': [project('old')] } } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'admin-seo-'));
  await mkdir(path.join(root, 'projects', 'data'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<html></html>');
  for (const [name, list] of Object.entries(collections)) {
    for (const lang of ['ca', 'en', 'es']) {
      await writeFile(path.join(root, 'projects', 'data', `${name}.${lang}.json`), JSON.stringify({ projects: list.map((p) => ({ ...p, title: `${p.title} ${lang}` })) }));
    }
  }
  for (const [file, html] of Object.entries(pages)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), html);
  }
  return root;
}

test('writeSeoFiles rewrites each projects page in its language, skips missing or marker-less pages, and writes llms.txt', async () => {
  const root = await webRoot({ pages: { 'projects/index.html': PAGE, 'es/projects-ac/index.html': PAGE, 'en/projects/index.html': '<p>old</p>' } });
  const logs = [];
  await writeSeoFiles({ publicFile: path.join(root, 'projects', 'data', 'projects.json'), log: (line) => logs.push(line) });

  const ca = await readFile(path.join(root, 'projects/index.html'), 'utf8');
  assert.match(ca, /LEDGER ca/);
  assert.equal(ldOf(ca).itemListElement[0].item.url, 'https://masellas.info/projects/?p=ledger', 'a page without the detail markup: no project pages, legacy links');
  const es = await readFile(path.join(root, 'es/projects-ac/index.html'), 'utf8');
  assert.match(es, /OLD es/);
  assert.equal(ldOf(es).url, 'https://masellas.info/es/projects-ac/');
  assert.equal(await readFile(path.join(root, 'en/projects/index.html'), 'utf8'), '<p>old</p>', 'no markers: left alone');
  assert.ok(logs.some((line) => /en\/projects\/index\.html.*markers/.test(line)), 'logs the page without markers');
  assert.ok(logs.some((line) => /es\/projects\/index\.html/.test(line)), 'logs the missing page');
  assert.equal((await stat(path.join(root, 'projects/index.html'))).mode & 0o777, 0o644);

  const llms = await readFile(path.join(root, 'llms.txt'), 'utf8');
  assert.match(llms, /### \[LEDGER en\]\(https:\/\/masellas\.info\/en\/projects\/\?p=ledger\)/, 'no en project page written: the legacy link');
  assert.match(llms, /### \[OLD en\]/);
  assert.equal((await stat(path.join(root, 'llms.txt'))).mode & 0o777, 0o644);
  for (const dir of [root, path.join(root, 'projects')]) {
    assert.deepEqual((await readdir(dir)).filter((name) => name.startsWith('.')), [], `no temp files in ${dir}`);
  }
});

test('writeSeoFiles skips a collection whose public file is missing (llms.txt lists it as empty)', async () => {
  const root = await webRoot({ pages: { 'projects-ac/index.html': PAGE }, collections: { projects: [project('ledger')] } });
  const logs = [];
  await writeSeoFiles({ publicFile: path.join(root, 'projects', 'data', 'projects.json'), log: (line) => logs.push(line) });
  assert.equal(await readFile(path.join(root, 'projects-ac/index.html'), 'utf8'), PAGE);
  assert.match(await readFile(path.join(root, 'llms.txt'), 'utf8'), /LEDGER en/);
});

test('writeSeoFiles writes nothing, and never throws, when PUBLIC_FILE is not <web root>/projects/data/*', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admin-seo-elsewhere-'));
  await writeFile(path.join(dir, 'index.html'), '<html></html>');
  const logs = [];
  await writeSeoFiles({ publicFile: path.join(dir, 'web', 'projects.json'), log: (line) => logs.push(line) });
  assert.deepEqual((await readdir(dir)).sort(), ['index.html']);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /projects\/data/);
});

test('writeSeoFiles never throws when a write fails', async () => {
  const root = await webRoot({ pages: { 'projects/index.html': PAGE } });
  // A directory where llms.txt should go makes its rename fail.
  await mkdir(path.join(root, 'llms.txt'));
  await mkdir(path.join(root, 'llms.txt', 'x'));
  const logs = [];
  await writeSeoFiles({ publicFile: path.join(root, 'projects', 'data', 'projects.json'), log: (line) => logs.push(line) });
  assert.ok(logs.some((line) => /llms\.txt/.test(line)));
  assert.match(await readFile(path.join(root, 'projects/index.html'), 'utf8'), /LEDGER ca/, 'the pages are still written');
});

/* ---------- project pages: <collection dir>/<id>/index.html ---------- */

// The committed en projects page, as the admin finds it in the web root (rows injected).
const listPage = async (projects, file = 'en/projects/index.html', url = URL_EN) => injectProjects(await readFile(path.join(REPO, file), 'utf8'), projects, url);
const detailOf = (html) => /<div class="detail" id="detail"[\s\S]*?<\/article>/.exec(html)[0];

test('projectPage: the list page with the project head (title, description, canonical, hreflang, og, JSON-LD) and a marker', async () => {
  const ledger = project('ledger', { thumbs: ['/projects/img/ledger.webp'], tools: ['Claude Code'] });
  const html = projectPage(await listPage([ledger, project('next')]), { collection: 'projects', lang: 'en', project: ledger, next: project('next'), langs: ['ca', 'en'] });
  assert.ok(html.startsWith(PROJECT_PAGE_MARK));
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.match(html, /<title>LEDGER — Projects \(IA\) — Roger Masellas<\/title>/, 'the detail_title format of the page');
  assert.match(html, /<meta name="description" content="about ledger">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/masellas\.info\/en\/projects\/ledger\/">/);
  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(([, code, href]) => `${code} ${href}`);
  assert.deepEqual(alternates, [
    'ca https://masellas.info/projects/ledger/',
    'en https://masellas.info/en/projects/ledger/',
    'x-default https://masellas.info/projects/ledger/',
  ], 'only the languages that have the project');
  assert.match(html, /<meta property="og:title" content="LEDGER">/);
  assert.match(html, /<meta property="og:description" content="about ledger">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/masellas\.info\/en\/projects\/ledger\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/masellas\.info\/projects\/img\/ledger\.webp">/);
  const ld = ldOf(html);
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'CreativeWork');
  assert.equal(ld.url, 'https://masellas.info/en/projects/ledger/');
  assert.equal(ld.keywords, 'Claude Code');
  assert.match(html, /<ul class="work-list" id="projects-list"[^>]*><!-- projects:start -->\n<li [^>]*><a class="work-item" href="\/en\/projects\/ledger\/" data-static>/, 'keeps the rows');
});

test('projectPage: the switcher links to the sibling pages that exist, and keeps data-lang-path (the list) for the script', async () => {
  const ledger = project('ledger');
  const html = projectPage(await listPage([ledger]), { collection: 'projects', lang: 'en', project: ledger, next: null, langs: ['ca', 'en'] });
  const nav = /<nav class="lang-nav"[\s\S]*?<\/nav>/.exec(html)[0];
  assert.match(nav, /href="\/projects\/ledger\/" hreflang="ca"[^>]* data-lang-path="\/projects\/"/);
  assert.match(nav, /href="\/en\/projects\/ledger\/" hreflang="en"[^>]* data-lang-path="\/en\/projects\/"/);
  assert.match(nav, /href="\/es\/projects\/" hreflang="es"[^>]* data-lang-path="\/es\/projects\/"/, 'no es page: the list');
});

test('projectPage pre-fills the detail (still hidden: the script opens it) with escaped text and the AI text as HTML', async () => {
  const ledger = project('ledger', {
    title: 'R & D <b>', url: 'https://ledger.example.com', tools: ['Claude Code', 'esbuild'],
    ai: '## How\n\n**Claude** wrote a {{PWA|web app}} with [docs](https://x.example.com).',
  });
  const next = project('next', { title: 'Next one' });
  const html = projectPage(await listPage([ledger, next]), { collection: 'projects', lang: 'en', project: ledger, next, langs: ['en'] });
  const detail = detailOf(html);
  assert.match(detail, /<div class="detail" id="detail" [^>]*hidden>/);
  assert.match(detail, /<h2 class="page-title detail__title" id="detail-title" tabindex="-1">R &amp; D &lt;b&gt;<\/h2>/);
  assert.match(detail, /<p class="detail__meta" data-reveal>tool \/ 2026<\/p>/);
  assert.match(detail, /<p class="detail__lead" data-reveal>about ledger<\/p>/);
  assert.match(detail, /<section class="detail__ai" data-reveal aria-labelledby="detail-ai-heading">/);
  assert.match(detail, /<div class="detail__body rich-text"><h4>How<\/h4>\n<p><strong>Claude<\/strong> wrote a <button type="button" class="term" aria-describedby="term-static-1">PWA<\/button><span id="term-static-1" hidden>web app<\/span> with <a class="detail-link detail-link--inline" href="https:\/\/x\.example\.com" target="_blank" rel="noopener">docs<\/a>\.<\/p><\/div>/);
  assert.match(detail, /<ul class="detail__tools" data-reveal aria-label="Tools"><li>Claude Code<\/li><li>esbuild<\/li><\/ul>/);
  assert.match(detail, /<p class="detail__visit" data-reveal><a class="detail-link" target="_blank" rel="noopener" href="https:\/\/ledger\.example\.com\/" aria-label="visit site: R &amp; D &lt;b&gt; \(opens in a new tab\)">visit site<\/a><\/p>/);
  assert.match(detail, /<nav class="detail__next" data-reveal aria-label="Next project"><a class="detail-link detail-link--big" href="\/en\/projects\/next\/">next project: Next one<\/a><\/nav>/);
  assert.doesNotMatch(detail, /<b>/);
});

test('projectPage hides the empty parts like the script does (no lead, AI text, tools, link or next project)', async () => {
  const bare = project('bare', { description: '', url: '', ai: '', tools: [] });
  const detail = detailOf(projectPage(await listPage([bare]), { collection: 'projects', lang: 'en', project: bare, next: null, langs: ['en'] }));
  assert.match(detail, /<p class="detail__lead" data-reveal hidden><\/p>/);
  assert.match(detail, /<section class="detail__ai" data-reveal aria-labelledby="detail-ai-heading" hidden>/);
  assert.match(detail, /<ul class="detail__tools" data-reveal aria-label="Tools" hidden><\/ul>/);
  assert.match(detail, /<p class="detail__visit" data-reveal hidden>/);
  assert.match(detail, /<nav class="detail__next" data-reveal aria-label="Next project" hidden>/);
});

test('projectPage keeps a non-http visit link out and returns null for a page that is not a projects page', async () => {
  const odd = project('odd', { url: 'javascript:alert(1)' });
  const detail = detailOf(projectPage(await listPage([odd]), { collection: 'projects', lang: 'en', project: odd, next: null, langs: ['en'] }));
  assert.doesNotMatch(detail, /javascript:/);
  assert.match(detail, /<p class="detail__visit" data-reveal hidden>/);
  assert.equal(projectPage(PAGE, { collection: 'projects', lang: 'en', project: odd, next: null, langs: ['en'] }), null);
});

test('projectPage uses the strings of the page it is built from (projects (B.C.) in es)', async () => {
  const old = project('old');
  const html = projectPage(await listPage([old], 'es/projects-ac/index.html', 'https://masellas.info/es/projects-ac/'), { collection: 'projects-ac', lang: 'es', project: old, next: null, langs: ['ca', 'en', 'es'] });
  assert.match(html, /<title>OLD — Proyectos \(a\.C\.\) — Roger Masellas<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/masellas\.info\/es\/projects-ac\/old\/">/);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/masellas\.info\/projects-ac\/old\/">/);
});

test('sitemapProjectsXml: one <url> per project page, with its alternates and x-default (ca)', () => {
  const xml = sitemapProjectsXml({ projects: { ca: ['ledger'], en: ['ledger', 'only-en'], es: [] }, 'projects-ac': { ca: ['old'] } });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml">\n/);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc), [
    'https://masellas.info/projects/ledger/',
    'https://masellas.info/en/projects/ledger/',
    'https://masellas.info/en/projects/only-en/',
    'https://masellas.info/projects-ac/old/',
  ]);
  const ledger = /<loc>https:\/\/masellas\.info\/en\/projects\/ledger\/<\/loc>([\s\S]*?)<\/url>/.exec(xml)[1];
  assert.deepEqual([...ledger.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([, code, href]) => `${code} ${href}`), [
    'ca https://masellas.info/projects/ledger/',
    'en https://masellas.info/en/projects/ledger/',
    'x-default https://masellas.info/projects/ledger/',
  ]);
  const onlyEn = /<loc>https:\/\/masellas\.info\/en\/projects\/only-en\/<\/loc>([\s\S]*?)<\/url>/.exec(xml)[1];
  assert.doesNotMatch(onlyEn, /x-default/, 'no ca page, no x-default');
  assert.ok(xml.endsWith('</urlset>\n'));
});

// A web root with the committed projects pages (so the detail markup is the real one).
async function siteRoot(collections) {
  const pages = {};
  for (const file of ['projects/index.html', 'en/projects/index.html', 'es/projects/index.html', 'projects-ac/index.html', 'en/projects-ac/index.html', 'es/projects-ac/index.html']) {
    pages[file] = await readFile(path.join(REPO, file), 'utf8');
  }
  return webRoot({ pages, collections });
}
const publicFileOf = (root) => path.join(root, 'projects', 'data', 'projects.json');

test('writeSeoFiles writes a page per public project and language, the projects sitemap, and llms.txt links to the pages', async () => {
  const root = await siteRoot({ projects: [project('ledger'), project('poi')], 'projects-ac': [project('old')] });
  const logs = [];
  await writeSeoFiles({ publicFile: publicFileOf(root), log: (line) => logs.push(line) });
  for (const file of ['projects/ledger', 'projects/poi', 'en/projects/ledger', 'es/projects/poi', 'projects-ac/old', 'es/projects-ac/old']) {
    const html = await readFile(path.join(root, file, 'index.html'), 'utf8');
    assert.ok(html.startsWith(PROJECT_PAGE_MARK), file);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://masellas\\.info/${file}/">`), file);
    assert.equal((await stat(path.join(root, file, 'index.html'))).mode & 0o777, 0o644);
  }
  assert.match(await readFile(path.join(root, 'es/projects/ledger/index.html'), 'utf8'), /LEDGER es/, 'each in its language');
  assert.match(await readFile(path.join(root, 'projects/ledger/index.html'), 'utf8'), /href="\/projects\/poi\/">[^<]*POI ca</, 'next project');
  const sitemap = await readFile(path.join(root, 'sitemap-projects.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 9);
  assert.equal((await stat(path.join(root, 'sitemap-projects.xml'))).mode & 0o777, 0o644);
  assert.match(await readFile(path.join(root, 'llms.txt'), 'utf8'), /### \[LEDGER en\]\(https:\/\/masellas\.info\/en\/projects\/ledger\/\)/);
  assert.deepEqual(logs, []);
  assert.deepEqual((await readdir(path.join(root, 'projects', 'ledger'))), ['index.html'], 'no temp files');
});

test('writeSeoFiles skips ids that are not slugs (reserved names included) and ids taken by a directory it does not own', async () => {
  const root = await siteRoot({ projects: [project('data'), project('images'), project('Bad_Id'), project('..'), project('ok')] });
  await mkdir(path.join(root, 'projects', 'images'));
  await writeFile(path.join(root, 'projects', 'images', 'index.html'), '<p>not mine</p>');
  const logs = [];
  await writeSeoFiles({ publicFile: publicFileOf(root), log: (line) => logs.push(line) });
  assert.equal(await readFile(path.join(root, 'projects', 'images', 'index.html'), 'utf8'), '<p>not mine</p>');
  assert.ok(!existsSync(path.join(root, 'projects', 'data', 'index.html')));
  assert.ok(!existsSync(path.join(root, 'en', 'projects', 'data')), 'reserved in every language');
  assert.ok(!existsSync(path.join(root, 'projects', 'Bad_Id')));
  assert.ok(existsSync(path.join(root, 'projects', 'ok', 'index.html')));
  assert.ok(existsSync(path.join(root, 'en', 'projects', 'images', 'index.html')), 'free in en');
  assert.ok(logs.some((line) => /projects\/images.*not .*admin/.test(line)));
  assert.ok(logs.some((line) => /\bdata\b/.test(line)));
  assert.ok(logs.some((line) => /Bad_Id/.test(line)));
  const ca = await readFile(path.join(root, 'projects', 'index.html'), 'utf8');
  assert.match(ca, /href="\/projects\/\?p=images"/, 'a row without a page keeps the legacy link');
  assert.match(ca, /href="\/projects\/ok\/"/);
  const sitemap = await readFile(path.join(root, 'sitemap-projects.xml'), 'utf8');
  assert.doesNotMatch(sitemap, /<loc>https:\/\/masellas\.info\/projects\/(data|images)\//);
  assert.doesNotMatch(sitemap, /\/projects\/data\//);
  assert.match(sitemap, /<loc>https:\/\/masellas\.info\/en\/projects\/images\/<\/loc>/);
});

test('writeSeoFiles rewrites its own pages and removes them once the project is no longer public, never anything else', async () => {
  const root = await siteRoot({ projects: [project('ledger'), project('gone')] });
  const publicFile = publicFileOf(root);
  await writeSeoFiles({ publicFile, log: () => {} });
  assert.ok(existsSync(path.join(root, 'en', 'projects', 'gone', 'index.html')));
  // Not the admin's: a directory without a marked index.html, one with other files, a symlink.
  await mkdir(path.join(root, 'projects', 'mine-not'));
  await writeFile(path.join(root, 'projects', 'mine-not', 'index.html'), '<p>hand-made</p>');
  await mkdir(path.join(root, 'projects', 'stuff'));
  await writeFile(path.join(root, 'projects', 'stuff', 'notes.txt'), 'x');
  const outside = await mkdtemp(path.join(tmpdir(), 'admin-seo-outside-'));
  await writeFile(path.join(outside, 'index.html'), `${PROJECT_PAGE_MARK} -->`);
  await symlink(outside, path.join(root, 'projects', 'linked'));
  // A marked page in the dir with another file next to it: the page goes, the dir and the file stay.
  await writeFile(path.join(root, 'projects', 'gone', 'keep.txt'), 'x');

  for (const lang of ['ca', 'en', 'es']) {
    await writeFile(path.join(root, 'projects', 'data', `projects.${lang}.json`), JSON.stringify({ projects: [{ ...project('ledger'), title: `LEDGER2 ${lang}` }] }));
  }
  const logs = [];
  await writeSeoFiles({ publicFile, log: (line) => logs.push(line) });
  assert.match(await readFile(path.join(root, 'projects', 'ledger', 'index.html'), 'utf8'), /LEDGER2 ca/);
  assert.ok(!existsSync(path.join(root, 'en', 'projects', 'gone')), 'removed with its directory');
  assert.ok(!existsSync(path.join(root, 'es', 'projects', 'gone')));
  assert.ok(!existsSync(path.join(root, 'projects', 'gone', 'index.html')));
  assert.ok(existsSync(path.join(root, 'projects', 'gone', 'keep.txt')));
  assert.equal(await readFile(path.join(root, 'projects', 'mine-not', 'index.html'), 'utf8'), '<p>hand-made</p>');
  assert.ok(existsSync(path.join(root, 'projects', 'stuff', 'notes.txt')));
  assert.ok(existsSync(path.join(outside, 'index.html')), 'never follows a symlink');
  assert.ok(existsSync(path.join(root, 'projects', 'data', 'projects.ca.json')));
  assert.doesNotMatch(await readFile(path.join(root, 'sitemap-projects.xml'), 'utf8'), /gone/);
});

test('writeSeoFiles keeps the project pages of a collection whose public file cannot be read', async () => {
  const root = await siteRoot({ projects: [project('ledger')], 'projects-ac': [project('old')] });
  const publicFile = publicFileOf(root);
  await writeSeoFiles({ publicFile, log: () => {} });
  await writeFile(path.join(root, 'projects', 'data', 'projects-ac.en.json'), '{ broken');
  const logs = [];
  await writeSeoFiles({ publicFile, log: (line) => logs.push(line) });
  assert.ok(existsSync(path.join(root, 'en', 'projects-ac', 'old', 'index.html')));
  assert.ok(logs.some((line) => /projects-ac/.test(line)));
});

test('writeSeoFiles never throws when a project page cannot be written', async () => {
  const root = await siteRoot({ projects: [project('ledger'), project('poi')] });
  await writeFile(path.join(root, 'projects', 'ledger'), 'a file where the directory should be');
  const logs = [];
  await writeSeoFiles({ publicFile: publicFileOf(root), log: (line) => logs.push(line) });
  assert.ok(logs.some((line) => /projects\/ledger/.test(line)));
  assert.ok(existsSync(path.join(root, 'projects', 'poi', 'index.html')));
  assert.ok(existsSync(path.join(root, 'sitemap-projects.xml')));
});
