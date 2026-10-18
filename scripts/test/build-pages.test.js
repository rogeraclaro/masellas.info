import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, checkDictionaries, richTextHtml, buildPages, LANGUAGES } from '../build-pages.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// A throwaway repo layout: src/pages/<page>.html + i18n/<lang>.json.
async function fixture(dicts, { home = '<p>{{home.title}}</p>', projects = '<p>{{projects.title}}</p>' } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'build-pages-'));
  await mkdir(path.join(root, 'src/pages'), { recursive: true });
  await mkdir(path.join(root, 'i18n'));
  await writeFile(path.join(root, 'src/pages/home.html'), home);
  await writeFile(path.join(root, 'src/pages/projects.html'), projects);
  for (const [lang, dict] of Object.entries(dicts)) {
    await writeFile(path.join(root, 'i18n', `${lang}.json`), JSON.stringify(dict));
  }
  return root;
}

const complete = () => ({ 'home.title': 'Home', 'projects.title': 'Projects', 'home.words': 'Hi.' });

test('renderTemplate escapes {{key}} and inserts {{{key}}} as is, re-indented', () => {
  const html = renderTemplate('<title>{{a}}</title>\n\t\t{{{b}}}', { a: 'R & D <"x">', b: '<i>1</i>\n<i>2</i>' });
  assert.equal(html, '<title>R &amp; D &lt;&quot;x&quot;&gt;</title>\n\t\t<i>1</i>\n\t\t<i>2</i>');
});

test('renderTemplate fails loudly on a placeholder with no value', () => {
  assert.throws(() => renderTemplate('{{a}} {{nope}} {{{gone}}}', { a: 'x' }, 'home.html'), /home\.html.*nope.*gone/s);
});

test('checkDictionaries fails when a language misses a key the others have', () => {
  assert.throws(
    () => checkDictionaries({ ca: { a: 'A', b: 'B' }, en: { a: 'A', b: 'B' }, es: { a: 'A' } }),
    /es.*missing.*\bb\b/s,
  );
});

test('checkDictionaries rejects empty or non-text values and missing languages', () => {
  assert.throws(() => checkDictionaries({ ca: { a: '' }, en: { a: 'A' }, es: { a: 'A' } }), /ca.*\ba\b/s);
  assert.throws(() => checkDictionaries({ ca: { a: 1 }, en: { a: 'A' }, es: { a: 'A' } }), /ca.*\ba\b/s);
  assert.throws(() => checkDictionaries({ ca: { a: 'A' }, en: { a: 'A' } }), /es/);
  assert.doesNotThrow(() => checkDictionaries({ ca: { a: 'A' }, en: { a: 'A' }, es: { a: 'A' } }));
});

test('buildPages fails when a language misses a key, naming the language and key', async () => {
  const es = complete();
  delete es['projects.title'];
  const root = await fixture({ ca: complete(), en: complete(), es });
  await assert.rejects(buildPages({ root, write: false }), /es.*projects\.title/s);
});

test('buildPages fails when a template uses a key no dictionary has', async () => {
  const root = await fixture({ ca: complete(), en: complete(), es: complete() }, { home: '{{home.typo}}' });
  await assert.rejects(buildPages({ root, write: false }), /home\.typo/);
});

test('richTextHtml renders paragraphs and links like the home does, and rejects bad links', () => {
  const html = richTextHtml('A [b](https://b.example) & c.\nnext\n\n[mail me](mailto:a@b.c)', { paragraphClass: 'home-animate' });
  assert.equal(html, [
    '<p class="home-animate">A <a class="wipe-link" href="https://b.example" target="_blank" rel="noopener">b</a> &amp; c.<br>next</p>',
    '<p class="home-animate"><a class="wipe-link" href="mailto:a@b.c">mail me</a></p>',
  ].join('\n'));
  assert.throws(() => richTextHtml('see [x](javascript:alert(1))'), /javascript/);
});

test('richTextHtml renders every style, escaped, with the block class on each block', () => {
  const html = richTextHtml('## Sub & co\n\n- one **<b>**\n- ~~two~~ `<i>`\n\n> quoted\n> [**bold** link](https://q.example)', { paragraphClass: 'home-animate' });
  assert.equal(html, [
    '<h3 class="home-animate">Sub &amp; co</h3>',
    '<ul class="home-animate"><li>one <strong>&lt;b&gt;</strong></li><li><s>two</s> <code>&lt;i&gt;</code></li></ul>',
    '<blockquote class="home-animate"><p>quoted<br><a class="wipe-link" href="https://q.example" target="_blank" rel="noopener"><strong>bold</strong> link</a></p></blockquote>',
  ].join('\n'));
  assert.throws(() => richTextHtml('a **b'), /unclosed/);
});

test('richTextHtml: {{term|…}} becomes a tooltip term; a bare {{term}} is just its text (no glossary at build time)', () => {
  const html = richTextHtml('Uses {{RAG|retrieval & generation}} and {{LLM}}. **{{x|<y>}}**');
  assert.equal(html, '<p>Uses <button type="button" class="term" aria-describedby="term-static-1">RAG</button><span id="term-static-1" hidden>retrieval &amp; generation</span> and LLM. <strong><button type="button" class="term" aria-describedby="term-static-2">x</button><span id="term-static-2" hidden>&lt;y&gt;</span></strong></p>');
});

test('the repo sources build nine pages with lang, hreflang, og:locale and the switcher', async () => {
  const pages = await buildPages({ root: REPO, write: false });
  assert.deepEqual(pages.map((p) => p.file).sort(), [
    'en/index.html', 'en/projects-ac/index.html', 'en/projects/index.html',
    'es/index.html', 'es/projects-ac/index.html', 'es/projects/index.html',
    'index.html', 'projects-ac/index.html', 'projects/index.html',
  ]);
  const locales = { ca: 'ca_ES', en: 'en_GB', es: 'es_ES' };
  for (const { file, html, lang, page } of pages) {
    assert.match(html, /^<!-- generated by scripts\/build-pages\.mjs .*edit src\/pages/, file);
    assert.match(html, new RegExp(`<html[^>]* lang="${lang}"`), file);
    const sub = page === 'home' ? '' : `${page}/`;
    for (const [code, prefix] of [['ca', ''], ['en', 'en/'], ['es', 'es/'], ['x-default', '']]) {
      assert.ok(html.includes(`<link rel="alternate" hreflang="${code}" href="https://masellas.info/${prefix}${sub}">`), `${file} hreflang ${code}`);
    }
    assert.ok(html.includes(`<meta property="og:locale" content="${locales[lang]}">`), `${file} og:locale`);
    const current = [...html.matchAll(/<a [^>]*hreflang="(\w+)"[^>]*aria-current="page"/g)].map((m) => m[1]);
    assert.deepEqual(current, [lang], `${file}: switcher marks only the page language`);
    assert.doesNotMatch(html, /\{\{|\}\}/, `${file}: no placeholder left`);
    assert.doesNotMatch(html, /(href|src)="(?!\/|https?:|mailto:|#|data:)/, `${file}: asset and page URLs are root-absolute`);
  }
  const projects = pages.find((p) => p.file === 'es/projects/index.html').html;
  const strings = JSON.parse(/<script type="application\/json" id="i18n">(.*?)<\/script>/s.exec(projects)[1]);
  assert.equal(typeof strings.filter_all, 'string');
  assert.match(projects, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(pages.find((p) => p.file === 'projects-ac/index.html').html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(pages.find((p) => p.file === 'en/index.html').html, /name="robots"/, 'home stays indexable');
});

test('every page has the burger toggle, labelled in its language, wrapping both menus', async () => {
  const pages = await buildPages({ root: REPO, write: false });
  for (const { file, html, lang } of pages) {
    const dict = JSON.parse(await readFile(path.join(REPO, 'i18n', `${lang}.json`), 'utf8'));
    const toggle = /<button class="menu-toggle"[^>]*>/.exec(html)?.[0];
    assert.ok(toggle, `${file}: toggle`);
    assert.match(toggle, /aria-expanded="false"/, file);
    assert.match(toggle, /aria-controls="site-menu"/, file);
    assert.ok(toggle.includes(`aria-label="${dict['nav.menu_open']}"`), `${file}: open label`);
    assert.ok(toggle.includes(`data-label-close="${dict['nav.menu_close']}"`), `${file}: close label`);
    const panel = /<div class="site-menu" id="site-menu">([\s\S]*?)\n<\/div>/.exec(html)?.[1] ?? '';
    assert.match(panel, /<ul class="menu">/, `${file}: section tabs in the panel`);
    assert.match(panel, /<ul class="lang-menu">/, `${file}: language tabs in the panel`);
  }
});

test('the strings block cannot close its <script> early', async () => {
  const dict = { ...complete(), 'js.x': '</script><b>' };
  const root = await fixture({ ca: dict, en: dict, es: dict }, { projects: '{{{i18n_json}}}' });
  const pages = await buildPages({ root, write: false });
  const html = pages.find((p) => p.file === 'projects/index.html').html;
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /\\u003c\/script>/);
});

test('buildPages writes the files when asked', async () => {
  const root = await fixture({ ca: complete(), en: complete(), es: complete() });
  await buildPages({ root });
  assert.match(await readFile(path.join(root, 'es/projects/index.html'), 'utf8'), /<p>Projects<\/p>/);
  assert.match(await readFile(path.join(root, 'index.html'), 'utf8'), /^<!-- generated/);
});

const dictOf = async (lang) => JSON.parse(await readFile(path.join(REPO, 'i18n', `${lang}.json`), 'utf8'));
const menuTabs = (html) => {
  const menu = /<ul class="menu">([\s\S]*?)<\/ul>/.exec(html)[1];
  return [...menu.matchAll(/<a class="menu__tab cube" href="([^"]*)"([^>]*)><span class="cube__inner"><span class="face face--front">([^<]*)</g)]
    .map(([, href, attrs, label]) => ({ href, label, current: /aria-current="page"/.test(attrs) }));
};

test('every page has the four section tabs in order; aria-current marks the projects page on show', async () => {
  const pages = await buildPages({ root: REPO, write: false });
  for (const { file, html, lang, page } of pages) {
    const dict = await dictOf(lang);
    const prefix = lang === 'ca' ? '/' : `/${lang}/`;
    const tabs = menuTabs(html);
    assert.deepEqual(tabs.map((tab) => tab.label), [dict['nav.the_point'], dict['nav.some_words'], dict['nav.projects'], dict['nav.projects_ac']], file);
    assert.deepEqual(tabs.map((tab) => tab.href), [`${prefix}#firstPage`, `${prefix}#secondPage`, `${prefix}projects/`, `${prefix}projects-ac/`], file);
    const current = { home: [], projects: [`${prefix}projects/`], 'projects-ac': [`${prefix}projects-ac/`] }[page];
    assert.deepEqual(tabs.filter((tab) => tab.current).map((tab) => tab.href), current, `${file}: aria-current`);
  }
});

test('the menu labels keep their values and projects (B.C.) is labelled per language', async () => {
  const labels = {
    ca: ['al gra', 'unes paraules', 'projectes (IA)', 'projectes (a.C.)'],
    es: ['al grano', 'unas palabras', 'proyectos (IA)', 'proyectos (a.C.)'],
    en: ['the point', 'some words', 'projects (IA)', 'projects (B.C.)'],
  };
  for (const [lang, expected] of Object.entries(labels)) {
    const dict = await dictOf(lang);
    assert.deepEqual(['nav.the_point', 'nav.some_words', 'nav.projects', 'nav.projects_ac'].map((key) => dict[key]), expected, lang);
  }
});

test('page positions: home 0, projects -1, projects (B.C.) +1; each projects page names its data', async () => {
  const pages = await buildPages({ root: REPO, write: false });
  const x = { home: '0', projects: '-1', 'projects-ac': '1' };
  for (const { file, html, page } of pages) {
    assert.match(html, new RegExp(`<html[^>]* data-page-x="${x[page]}"`), file);
    if (page !== 'home') assert.match(html, new RegExp(`<ul class="work-list" id="projects-list"[^>]* data-collection="${page}"`), file);
  }
});

test('projects (B.C.) reuses the projects template and bundles with its own title, heading and detail strings', async () => {
  const pages = await buildPages({ root: REPO, write: false });
  const expected = {
    ca: ['Projectes (a.C.) — Roger Masellas', 'Projectes (a.C.)', 'Com es va fer', '{title} — Projectes (a.C.) — Roger Masellas'],
    es: ['Proyectos (a.C.) — Roger Masellas', 'Proyectos (a.C.)', 'Cómo se hizo', '{title} — Proyectos (a.C.) — Roger Masellas'],
    en: ['Projects (B.C.) — Roger Masellas', 'Projects (B.C.)', 'How it was made', '{title} — Projects (B.C.) — Roger Masellas'],
  };
  for (const [lang, [title, heading, made, detailTitle]] of Object.entries(expected)) {
    const prefix = lang === 'ca' ? '' : `${lang}/`;
    const html = pages.find((p) => p.file === `${prefix}projects-ac/index.html`).html;
    assert.ok(html.includes(`<title>${title}</title>`), `${lang} title`);
    assert.ok(html.includes(`<h1 class="page-title" data-split>${heading}</h1>`), `${lang} heading`);
    assert.ok(html.includes(`<p class="detail__crumb">${heading}</p>`), `${lang} crumb`);
    assert.ok(html.includes(`id="detail-ai-heading">${made}</h3>`), `${lang} detail section`);
    const strings = JSON.parse(/<script type="application\/json" id="i18n">(.*?)<\/script>/s.exec(html)[1]);
    assert.equal(strings.detail_title, detailTitle, `${lang} detail title`);
    assert.ok(html.includes('<script defer src="/projects/js/projects.min.js"></script>'), `${lang}: shared bundle`);
    assert.ok(html.includes('<link rel="stylesheet" href="/projects/css/projects.min.css">'), `${lang}: shared styles`);
    const ia = pages.find((p) => p.file === `${prefix}projects/index.html`).html;
    assert.ok(!ia.includes(made), `${lang}: the AI page keeps its own detail heading`);
  }
});

test('an override for a key no dictionary has fails the build', async () => {
  const dict = { ...complete(), 'projects_ac.projects.typo': 'x' };
  const root = await fixture({ ca: dict, en: dict, es: dict });
  await assert.rejects(buildPages({ root, write: false }), /projects_ac\.projects\.typo/);
});
