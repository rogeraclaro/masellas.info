// Copies of the public projects for crawlers that do not run JS: the rows and a JSON-LD ItemList inside
// the markers of each projects page in the web root, plus /llms.txt. Rewritten after every publish of a
// projects collection (and at boot); the page script swaps the rows for its own once its data loads.
// Never throws: a missing page, a page without markers or a failed write is logged and skipped.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './store.js';
import { LANGS, DEFAULT_LANG, localizedFile } from './languages.js';
import { richTextPlain } from './rich-text.js';

// These mirror scripts/build-pages.mjs and i18n/en.json (checked by test/seo-pages.test.js): the admin is
// deployed without them.
export const SITE = 'https://masellas.info';
export const DESCRIPTION = 'Resumé site of Roger Masellas, frontend developer.'; // i18n/en.json home.description
const COLLECTIONS = [
  { name: 'projects', label: 'projects (IA)' },
  { name: 'projects-ac', label: 'projects (B.C.)' },
];
const prefix = (lang) => (lang === DEFAULT_LANG ? '/' : `/${lang}/`);
const pageUrl = (collection, lang) => `${SITE}${prefix(lang)}${collection}/`;
export const PAGES = [{ name: '', label: 'home' }, ...COLLECTIONS]
  .flatMap(({ name, label }) => LANGS.map((lang) => ({ label: `${label} (${lang})`, url: `${SITE}${prefix(lang)}${name ? `${name}/` : ''}` })));

const LIST = ['<!-- projects:start -->', '<!-- projects:end -->'];
const LD = ['<!-- projects-ld:start -->', '<!-- projects-ld:end -->'];

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const detailUrl = (url, id) => `${url}?p=${encodeURIComponent(id)}`;

// Same classes as the rows the page script builds; data-static lets the CSS hide them until it swaps them.
const row = (project) => `<li data-category="${escapeHtml(project.category)}"><a class="work-item" href="?p=${encodeURIComponent(project.id)}" data-static>`
  + `<span class="work-item__title">${escapeHtml(project.title)}</span> <span class="work-item__meta">${escapeHtml(project.category)} / ${escapeHtml(project.year)}</span> `
  + `<span class="work-item__desc">${escapeHtml(project.description)}</span></a></li>`;

function creativeWork(project, url) {
  const work = { '@type': 'CreativeWork', name: project.title, description: project.description, url: detailUrl(url, project.id) };
  if (project.year !== '' && project.year != null) work.dateCreated = String(project.year);
  if (project.tools?.length) work.keywords = project.tools.join(', ');
  if (project.thumbs?.length) work.image = new URL(project.thumbs[0], url).href;
  const text = richTextPlain(project.ai ?? '');
  if (text) work.text = text;
  return Object.fromEntries(Object.entries(work).filter(([, value]) => value !== ''));
}

const between = (html, [start, end], content) => html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => `${start}${content}${end}`);

// The page HTML with both marker pairs filled (any earlier content replaced), or null if one is missing.
export function injectProjects(html, projects, url) {
  if (![...LIST, ...LD].every((marker) => html.includes(marker))) return null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url,
    numberOfItems: projects.length,
    itemListElement: projects.map((project, index) => ({ '@type': 'ListItem', position: index + 1, item: creativeWork(project, url) })),
  };
  // "<" escaped so no text can close the <script>.
  const script = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  const rows = projects.map(row).join('\n');
  return between(between(html, LD, script), LIST, rows ? `\n${rows}\n` : '');
}

// /llms.txt (llmstxt.org): the site, its pages, then every project of each collection in en.
// byCollection: { <collection name>: public en projects }.
export function llmsText(byCollection) {
  const lines = ['# Roger Masellas', '', `> ${DESCRIPTION}`, '', '## Pages', '', ...PAGES.map(({ label, url }) => `- [${label}](${url})`)];
  for (const { name, label } of COLLECTIONS) {
    lines.push('', `## ${label}`);
    for (const project of byCollection[name] ?? []) {
      lines.push('', `### [${project.title}](${detailUrl(pageUrl(name, 'en'), project.id)})`, '', `${project.year} / ${project.category}`);
      if (project.description) lines.push('', project.description);
      if (project.tools?.length) lines.push('', `Tools: ${project.tools.join(', ')}`);
      if (project.url) lines.push('', `Link: ${project.url}`);
      const ai = richTextPlain(project.ai ?? '');
      if (ai) lines.push('', ai);
    }
  }
  return `${lines.join('\n')}\n`;
}

// PUBLIC_FILE is <web root>/projects/data/projects.json; anything else (e.g. a local scratch copy) has
// no pages next to it.
function webRootOf(publicFile) {
  const dataDir = path.dirname(publicFile);
  if (path.basename(dataDir) !== 'data' || path.basename(path.dirname(dataDir)) !== 'projects') return null;
  return path.dirname(path.dirname(dataDir));
}

async function readPublic(dataDir, collection, lang) {
  try {
    return JSON.parse(await readFile(localizedFile(path.join(dataDir, `${collection}.json`), lang), 'utf8')).projects;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeSeoFiles({ publicFile, log = console.error }) {
  const root = webRootOf(publicFile);
  if (!root || !existsSync(path.join(root, 'index.html'))) {
    log(`admin: crawler copies skipped: PUBLIC_FILE (${publicFile}) is not in <web root>/projects/data/`);
    return;
  }
  const dataDir = path.dirname(publicFile);
  const en = {};
  for (const { name } of COLLECTIONS) {
    for (const lang of LANGS) {
      const file = path.join(root, prefix(lang), name, 'index.html');
      try {
        const projects = await readPublic(dataDir, name, lang);
        if (lang === 'en') en[name] = projects;
        if (!projects) {
          log(`admin: ${file} not updated: no public ${name}.${lang}.json yet`);
          continue;
        }
        if (!existsSync(file)) {
          log(`admin: ${file} not updated: the page is missing`);
          continue;
        }
        const html = injectProjects(await readFile(file, 'utf8'), projects, pageUrl(name, lang));
        if (html === null) log(`admin: ${file} not updated: no projects markers`);
        else await writeAtomic(file, html, 0o644);
      } catch (err) {
        log(`admin: ${file} not updated: ${err.message}`);
      }
    }
  }
  try {
    await writeAtomic(path.join(root, 'llms.txt'), llmsText(en), 0o644);
  } catch (err) {
    log(`admin: ${path.join(root, 'llms.txt')} not updated: ${err.message}`);
  }
}
