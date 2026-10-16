// Generates the six static pages (ca at the root, en/ and es/) from one template per page
// (src/pages/*.html) and one dictionary per language (i18n/*.json). Node built-ins only.
// Usage: node scripts/build-pages.mjs   (scripts/build.sh runs it first)
//
// Template placeholders:
//   {{key}}    dictionary text or a build value, HTML-escaped
//   {{{key}}}  a build value inserted as is (generated HTML/JSON below), re-indented to the line
// Any placeholder without a value, or a dictionary missing a key another language has, fails the build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseRichText } from '../admin/lib/rich-text.js';

const SITE = 'https://masellas.info';

// ca is the principal language: it lives at the root and is the x-default.
export const LANGUAGES = [
  { code: 'ca', prefix: '/', ogLocale: 'ca_ES', name: 'català' },
  { code: 'en', prefix: '/en/', ogLocale: 'en_GB', name: 'English' },
  { code: 'es', prefix: '/es/', ogLocale: 'es_ES', name: 'español' },
];
const DEFAULT = LANGUAGES[0];

// path: where the page sits under each language prefix.
export const PAGES = [
  { name: 'home', path: '' },
  { name: 'projects', path: 'projects/' },
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

// The "some words" fallback, rendered with the same parser and markup as the home's runtime text.
export function richTextHtml(text, { paragraphClass = '', linkClass = 'wipe-link' } = {}) {
  const { blocks, errors } = parseRichText(text);
  if (errors.length) throw new Error(errors.join(' '));
  return blocks.map((block) => {
    const linkOnly = block.parts.length === 1 && block.parts[0].type === 'link';
    const classes = [paragraphClass, linkOnly ? 'link-only' : ''].filter(Boolean).join(' ');
    const inner = block.parts.map((part) => {
      if (part.type === 'br') return '<br>';
      if (part.type === 'text') return escapeHtml(part.value);
      const external = /^https?:/i.test(part.href) ? ' target="_blank" rel="noopener"' : '';
      return `<a class="${linkClass}" href="${escapeHtml(part.href)}"${external}>${escapeHtml(part.label)}</a>`;
    }).join('');
    return `<p${classes ? ` class="${classes}"` : ''}>${inner}</p>`;
  }).join('\n');
}

const cube = (text) => `<span class="cube__inner"><span class="face face--front">${text}</span><span class="face face--before" aria-hidden="true">${text}</span><span class="face face--after" aria-hidden="true">${text}</span></span>`;

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
  const alternates = [...LANGUAGES, { ...DEFAULT, code: 'x-default' }]
    .map((language) => `<link rel="alternate" hreflang="${language.code}" href="${SITE}${href(language)}">`)
    .join('\n');
  const ogLocale = [
    `<meta property="og:locale" content="${lang.ogLocale}">`,
    ...LANGUAGES.filter((language) => language !== lang).map((language) => `<meta property="og:locale:alternate" content="${language.ogLocale}">`),
  ].join('\n');
  // Strings the page scripts need (js.* keys, prefix dropped). "<" is escaped so the text can never close the <script>.
  const strings = Object.fromEntries(Object.entries(dict).filter(([key]) => key.startsWith('js.')).map(([key, value]) => [key.slice(3), value]));
  const values = {
    lang: lang.code,
    home_url: lang.prefix,
    projects_url: `${lang.prefix}projects/`,
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

// Returns [{ file, html, lang, page }]; writes them under root unless write is false.
export async function buildPages({ root, write = true }) {
  const dicts = await readDictionaries(root);
  checkDictionaries(dicts);
  const pages = [];
  for (const page of PAGES) {
    const source = `src/pages/${page.name}.html`;
    const template = await readFile(path.join(root, source), 'utf8');
    for (const lang of LANGUAGES) {
      const dict = dicts[lang.code];
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
  }
  return pages;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const pages = await buildPages({ root });
    console.log(`pages: ${pages.map((p) => p.file).join(' ')}`);
  } catch (err) {
    console.error(`build-pages: ${err.message}`);
    process.exit(1);
  }
}
