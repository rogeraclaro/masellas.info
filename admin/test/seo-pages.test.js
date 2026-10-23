import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectProjects, llmsText, writeSeoFiles, SITE, PAGES, DESCRIPTION } from '../lib/seo-pages.js';
import { PAGES as BUILD_PAGES, LANGUAGES } from '../../scripts/build-pages.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGE = '<html><head>\n<!-- projects-ld:start --><!-- projects-ld:end -->\n</head><body><ul id="projects-list"><!-- projects:start --><!-- projects:end --></ul></body></html>';
const URL_EN = 'https://masellas.info/en/projects/';

const project = (id, extra = {}) => ({
  id, title: id.toUpperCase(), category: 'tool', year: 2026, description: `about ${id}`, url: `https://${id}.example.com`, thumbs: [], ai: '', tools: [], ...extra,
});

const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);

test('injectProjects puts one escaped row per project between the list markers, linking to ?p=<id>', () => {
  const html = injectProjects(PAGE, [project('ledger'), project('r-d', { title: 'R & D <b>', category: 'a "b"' })], URL_EN);
  const list = /<!-- projects:start -->(.*?)<!-- projects:end -->/s.exec(html)[1];
  assert.equal((list.match(/<li /g) || []).length, 2);
  assert.match(list, /<li data-category="tool"><a class="work-item" href="\?p=ledger" data-static>/);
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
    url: 'https://masellas.info/en/projects/?p=ledger',
    dateCreated: '2026',
    keywords: 'Claude Code, esbuild',
    image: 'https://masellas.info/projects/img/ledger.webp',
    text: 'How\n\nClaude wrote a PWA with docs.\n\n- one\n- two',
  });
  assert.deepEqual(second.item, { '@type': 'CreativeWork', name: 'BARE', url: 'https://masellas.info/en/projects/?p=bare' }, 'empty fields are left out');
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

test('llmsText: title, description, the nine pages, then every en project with its details', () => {
  const text = llmsText({
    projects: [project('ledger', { tools: ['Claude Code'], ai: 'Made with **Claude**.' })],
    'projects-ac': [project('old', { url: '' })],
  });
  assert.match(text, /^# Roger Masellas\n\n> Resumé site of Roger Masellas, frontend developer\.\n/);
  assert.equal((text.match(/^- \[.*\]\(https:\/\/masellas\.info\/.*\)$/gm) || []).length, 9);
  assert.match(text, /- \[projects \(B\.C\.\) \(es\)\]\(https:\/\/masellas\.info\/es\/projects-ac\/\)/);
  assert.match(text, /## projects \(IA\)\n\n### \[LEDGER\]\(https:\/\/masellas\.info\/en\/projects\/\?p=ledger\)\n\n2026 \/ tool\n\nabout ledger\n\nTools: Claude Code\n\nLink: https:\/\/ledger\.example\.com\n\nMade with Claude\.\n/);
  assert.match(text, /## projects \(B\.C\.\)\n\n### \[OLD\]\(https:\/\/masellas\.info\/en\/projects-ac\/\?p=old\)\n\n2026 \/ tool\n\nabout old\n/);
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
  assert.equal(ldOf(ca).itemListElement[0].item.url, 'https://masellas.info/projects/?p=ledger');
  const es = await readFile(path.join(root, 'es/projects-ac/index.html'), 'utf8');
  assert.match(es, /OLD es/);
  assert.equal(ldOf(es).url, 'https://masellas.info/es/projects-ac/');
  assert.equal(await readFile(path.join(root, 'en/projects/index.html'), 'utf8'), '<p>old</p>', 'no markers: left alone');
  assert.ok(logs.some((line) => /en\/projects\/index\.html.*markers/.test(line)), 'logs the page without markers');
  assert.ok(logs.some((line) => /es\/projects\/index\.html/.test(line)), 'logs the missing page');
  assert.equal((await stat(path.join(root, 'projects/index.html'))).mode & 0o777, 0o644);

  const llms = await readFile(path.join(root, 'llms.txt'), 'utf8');
  assert.match(llms, /### \[LEDGER en\]\(https:\/\/masellas\.info\/en\/projects\/\?p=ledger\)/);
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
