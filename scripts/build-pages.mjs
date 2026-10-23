// Generates the nine static pages (home, projects, projects (B.C.); ca at the root, en/ and es/) from the
// templates in src/pages/*.html and one dictionary per language (i18n/*.json). Node built-ins only.
// Usage: node scripts/build-pages.mjs   (scripts/build.sh runs it first)
//
// Template placeholders:
//   {{key}}    dictionary text or a build value, HTML-escaped
//   {{{key}}}  a build value inserted as is (generated HTML/JSON below), re-indented to the line
// Any placeholder without a value, or a dictionary missing a key another language has, fails the build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { richTextHtml } from '../admin/lib/rich-text-html.js';

const SITE = 'https://masellas.info';

// ca is the principal language: it lives at the root and is the x-default.
export const LANGUAGES = [
  { code: 'ca', prefix: '/', ogLocale: 'ca_ES', name: 'català' },
  { code: 'en', prefix: '/en/', ogLocale: 'en_GB', name: 'English' },
  { code: 'es', prefix: '/es/', ogLocale: 'es_ES', name: 'español' },
];
const DEFAULT = LANGUAGES[0];

// path: where the page sits under each language prefix. x: its place on the page-transition axis
// (<html data-page-x>; lower slides in from the left). template: src/pages/<template>.html (default:
// name). collection: the data the projects template loads (/projects/data/<collection>.<lang>.json).
// overrides: dictionary keys "<overrides>.<key>" replace "<key>" on this page only.
export const PAGES = [
  { name: 'home', path: '', x: 0 },
  { name: 'projects', path: 'projects/', x: -1, collection: 'projects' },
  { name: 'projects-ac', template: 'projects', path: 'projects-ac/', x: 1, collection: 'projects-ac', overrides: 'projects_ac' },
];

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderTemplate(template, values, name = 'template') {
  const missing = new Set();
  const lookup = (key) => {
    if (Object.hasOwn(values, key)) return String(values[key]);
    missing.add(key);
    return '';
  };
  // One pass, so inserted values are never scanned for placeholders themselves.
  const html = template.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (whole, rawKey, textKey, offset) => {
    if (textKey) return escapeHtml(lookup(textKey));
    const indent = /^[ \t]*/.exec(template.slice(template.lastIndexOf('\n', offset) + 1))[0];
    return lookup(rawKey).split('\n').join(`\n${indent}`);
  });
  if (missing.size) throw new Error(`${name}: no value for placeholder(s): ${[...missing].join(', ')}`);
  return html;
}

// Every language must have every key (union of all dictionaries), as non-empty text.
export function checkDictionaries(dicts) {
  const problems = [];
  const all = new Set();
  for (const { code } of LANGUAGES) {
    if (!dicts[code]) problems.push(`i18n/${code}.json is missing`);
    else Object.keys(dicts[code]).forEach((key) => all.add(key));
  }
  for (const { code } of LANGUAGES) {
    const dict = dicts[code];
    if (!dict) continue;
    const missing = [...all].filter((key) => !Object.hasOwn(dict, key));
    const bad = Object.keys(dict).filter((key) => typeof dict[key] !== 'string' || !dict[key].trim());
    if (missing.length) problems.push(`i18n/${code}.json: missing ${missing.join(', ')}`);
    if (bad.length) problems.push(`i18n/${code}.json: empty or not text: ${bad.join(', ')}`);
  }
  if (problems.length) throw new Error(`dictionaries are incomplete:\n  ${problems.join('\n  ')}`);
}

// The "some words" fallback, rendered by the admin's shared renderer (also used for the project pages).
export { richTextHtml };

const cube = (text) => `<span class="cube__inner"><span class="face face--front">${text}</span><span class="face face--before" aria-hidden="true">${text}</span><span class="face face--after" aria-hidden="true">${text}</span></span>`;

// The dictionary as one page sees it: "<page.overrides>.<key>" replaces "<key>". An override for a key
// the dictionary does not have is a typo: it fails the build.
export function pageDictionary(page, dict) {
  if (!page.overrides) return dict;
  const prefix = `${page.overrides}.`;
  const merged = { ...dict };
  for (const [key, value] of Object.entries(dict)) {
    if (!key.startsWith(prefix)) continue;
    const target = key.slice(prefix.length);
    if (!Object.hasOwn(dict, target)) throw new Error(`${key} overrides ${target}, which no dictionary has`);
    merged[target] = value;
  }
  return merged;
}

// A page's URL in every language, plus x-default (= ca): the <head> alternates and the sitemap.
const alternatesOf = (page) => [...LANGUAGES, { ...DEFAULT, code: 'x-default' }]
  .map((language) => ({ code: language.code, url: `${SITE}${language.prefix}${page.path}` }));

// sitemap.xml: every page in every language, each with its alternates.
export function sitemapXml() {
  const urls = PAGES.flatMap((page) => LANGUAGES.map((lang) => [
    '\t<url>',
    `\t\t<loc>${SITE}${lang.prefix}${page.path}</loc>`,
    ...alternatesOf(page).map(({ code, url }) => `\t\t<xhtml:link rel="alternate" hreflang="${code}" href="${url}"/>`),
    '\t</url>',
  ].join('\n')));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

// sitemap-projects.xml (one URL per project page) is written by the admin (admin/lib/seo-pages.js).
export const robotsTxt = () => `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/sitemap-projects.xml\n`;

// Values the build adds to the dictionary for one page in one language.
function buildValues(page, lang, dict) {
  const href = (language) => `${language.prefix}${page.path}`;
  const switcher = [
    `<nav class="lang-nav" aria-label="${escapeHtml(dict['nav.language_label'] ?? '')}">`,
    '\t<ul class="lang-menu">',
    ...LANGUAGES.map((language) => {
      const current = language.code === lang.code ? ' aria-current="page"' : '';
      return `\t\t<li><a class="menu__tab cube" href="${href(language)}" hreflang="${language.code}" lang="${language.code}" aria-label="${language.name}" data-lang-path="${href(language)}"${current}>${cube(language.code)}</a></li>`;
    }),
    '\t</ul>',
    '</nav>',
  ].join('\n');
  const alternates = alternatesOf(page).map(({ code, url }) => `<link rel="alternate" hreflang="${code}" href="${url}">`).join('\n');
  const ogLocale = [
    `<meta property="og:locale" content="${lang.ogLocale}">`,
    ...LANGUAGES.filter((language) => language !== lang).map((language) => `<meta property="og:locale:alternate" content="${language.ogLocale}">`),
  ].join('\n');
  // Strings the page scripts need (js.* keys, prefix dropped). "<" is escaped so the text can never close the <script>.
  const strings = Object.fromEntries(Object.entries(dict).filter(([key]) => key.startsWith('js.')).map(([key, value]) => [key.slice(3), value]));
  // The section tab of the page on show gets aria-current (the home's own tabs are set by its script).
  const current = (name) => (page.name === name ? ' aria-current="page"' : '');
  const values = {
    lang: lang.code,
    page_x: page.x,
    collection: page.collection ?? '',
    home_url: lang.prefix,
    projects_url: `${lang.prefix}projects/`,
    projects_ac_url: `${lang.prefix}projects-ac/`,
    page_path: href(lang),
    current_projects: current('projects'),
    current_projects_ac: current('projects-ac'),
    page_url: `${SITE}${href(lang)}`,
    alternates,
    og_locale: ogLocale,
    lang_switcher: switcher,
    i18n_json: JSON.stringify(strings).replace(/</g, '\\u003c'),
  };
  if (Object.hasOwn(dict, 'home.words')) {
    try {
      values.words_html = richTextHtml(dict['home.words'], { paragraphClass: 'home-animate' });
    } catch (err) {
      throw new Error(`i18n/${lang.code}.json home.words: ${err.message}`);
    }
  }
  return values;
}

async function readDictionaries(root) {
  const dicts = {};
  for (const { code } of LANGUAGES) {
    const file = path.join(root, 'i18n', `${code}.json`);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue; // reported by checkDictionaries
    }
    try {
      dicts[code] = JSON.parse(text);
    } catch (err) {
      throw new Error(`i18n/${code}.json is not valid JSON: ${err.message}`);
    }
  }
  return dicts;
}

// Returns [{ file, html, lang, page }]; writes them, sitemap.xml and robots.txt under root unless write is false.
export async function buildPages({ root, write = true }) {
  const dicts = await readDictionaries(root);
  checkDictionaries(dicts);
  const pages = [];
  for (const page of PAGES) {
    const source = `src/pages/${page.template ?? page.name}.html`;
    const template = await readFile(path.join(root, source), 'utf8');
    for (const lang of LANGUAGES) {
      let dict;
      try {
        dict = pageDictionary(page, dicts[lang.code]);
      } catch (err) {
        throw new Error(`i18n/${lang.code}.json: ${err.message}`);
      }
      const body = renderTemplate(template, { ...dict, ...buildValues(page, lang, dict) }, `${source} (${lang.code})`);
      const header = `<!-- generated by scripts/build-pages.mjs from ${source} + i18n/${lang.code}.json: edit src/pages and i18n, not this file -->\n`;
      const file = `${lang.prefix.slice(1)}${page.path}index.html`;
      pages.push({ file, html: header + body, lang: lang.code, page: page.name });
    }
  }
  if (write) {
    for (const { file, html } of pages) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), html);
    }
    await writeFile(path.join(root, 'sitemap.xml'), sitemapXml());
    await writeFile(path.join(root, 'robots.txt'), robotsTxt());
  }
  return pages;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const pages = await buildPages({ root });
    console.log(`pages: ${pages.map((p) => p.file).join(' ')} sitemap.xml robots.txt`);
  } catch (err) {
    console.error(`build-pages: ${err.message}`);
    process.exit(1);
  }
}
