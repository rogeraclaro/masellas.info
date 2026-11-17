import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePitches, newPitchId, pitchPage, writePitchPages, PITCH_PAGE_MARK } from '../lib/pitches.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pitch = (extra = {}) => ({ id: 'acme-k3x9q2', company: 'Acme', lang: 'en', intro: 'Hi! These are the **closest** projects.', projects: ['projects/ledger', 'projects-ac/old'], ...extra });
const project = (id, extra = {}) => ({ id, title: id.toUpperCase(), category: 'tool', year: 2026, description: `about ${id}`, url: `https://${id}.example.com`, thumbs: [], ai: '', tools: [], ...extra });

/* ---------- validation ---------- */

test('validatePitches keeps valid pitches and gives new ones an id from the company plus a random part', () => {
  const { value, errors } = validatePitches({ pitches: [pitch(), pitch({ id: '', company: 'Ça Va Bé, S.L.', lang: 'ca', intro: '' })] }, { makeId: (company) => `new-${company.length}` });
  assert.deepEqual(errors, {});
  assert.equal(value.pitches[0].id, 'acme-k3x9q2');
  assert.equal(value.pitches[1].id, 'new-14');
  assert.equal(value.pitches[1].intro, '');
  assert.match(newPitchId('Ça Va Bé, S.L.'), /^ca-va-be-s-l-[a-z0-9]{6}$/);
  assert.notEqual(newPitchId('Acme'), newPitchId('Acme'), 'not guessable from the company alone');
});

test('validatePitches rejects bad fields, keyed by position', () => {
  const { errors } = validatePitches({
    pitches: [
      pitch({ company: '' }),
      pitch({ id: 'b', lang: 'fr' }),
      pitch({ id: 'c', projects: [] }),
      pitch({ id: 'd', projects: ['projects/ledger', 'projects/ledger'] }),
      pitch({ id: 'e', projects: ['elsewhere/x'] }),
      pitch({ id: 'f', intro: '**unclosed' }),
      pitch({ id: 'Bad Id' }),
      pitch({ id: 'b' }),
    ],
  });
  assert.match(errors['pitches.0.company'], /required/);
  assert.match(errors['pitches.1.lang'], /ca, en or es/);
  assert.match(errors['pitches.2.projects'], /at least one/);
  assert.match(errors['pitches.3.projects'], /twice/);
  assert.match(errors['pitches.4.projects'], /unknown/);
  assert.match(errors['pitches.5.intro'], /intro/);
  assert.match(errors['pitches.6.id'], /id/);
  assert.match(errors['pitches.7.id'], /used twice/);
  assert.match(validatePitches({ pitches: 'no' }).errors._body, /pitches/);
});

/* ---------- the page ---------- */

const listPage = (file = 'en/projects/index.html') => readFile(path.join(REPO, file), 'utf8');
const aiHeadings = { projects: 'How I used AI', 'projects-ac': 'How it was made' };
const dataOf = (html) => JSON.parse(/<script type="application\/json" id="projects-data">(.*?)<\/script>/s.exec(html)[1]);
const stringsOf = (html) => JSON.parse(/<script type="application\/json" id="i18n">(.*?)<\/script>/s.exec(html)[1]);

test('pitchPage: the list page of the language, private, with the heading, the intro and only the chosen projects in order', async () => {
  const projects = [{ ...project('ledger', { thumbs: ['https://masellas.info/img/projects/ledger.webp'] }), collection: 'projects' }, { ...project('old'), collection: 'projects-ac' }];
  const html = pitchPage(await listPage(), { pitch: pitch(), projects, aiHeadings });
  assert.ok(html.startsWith(PITCH_PAGE_MARK));
  assert.match(html, /<title>For Acme — Roger Masellas<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/masellas\.info\/per-a\/acme-k3x9q2\/">/);
  assert.doesNotMatch(html, /hreflang=/, 'one language: no alternates and no language switcher');
  assert.doesNotMatch(html, /class="lang-nav"/);
  assert.doesNotMatch(html, /aria-current="page"/, 'not the projects page');
  assert.match(html, /<h1 class="page-title" data-split>For Acme<\/h1>/);
  assert.match(html, /<div class="page-intro rich-text"><p>Hi! These are the <strong>closest<\/strong> projects\.<\/p><\/div>/);
  assert.match(html, /<meta property="og:title" content="For Acme — Roger Masellas">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/masellas\.info\/per-a\/acme-k3x9q2\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/masellas\.info\/img\/projects\/ledger\.webp">/, 'the first project\'s screenshot');
  assert.match(html, /data-collection="" data-list-path="\/per-a\/acme-k3x9q2\/" data-list-title="For Acme — Roger Masellas" data-detail-links="query"/);
  assert.match(html, /<p class="detail__crumb">For Acme<\/p>/);
  const data = dataOf(html);
  assert.deepEqual(data.projects.map((p) => [p.id, p.aiHeading]), [['ledger', 'How I used AI'], ['old', 'How it was made']]);
  assert.equal(stringsOf(html).detail_title, '{title} — Roger Masellas');
  assert.match(html, /<!-- projects:start --><!-- projects:end -->/, 'no crawler rows');
});

test('pitchPage escapes the company and the intro, and keeps "<" out of the inline JSON', async () => {
  const html = pitchPage(await listPage('projects/index.html'), {
    pitch: pitch({ company: 'A&B <script>', lang: 'ca', intro: '' }),
    projects: [{ ...project('x', { title: '</script><b>' }), collection: 'projects' }],
    aiHeadings,
  });
  assert.match(html, /<h1 class="page-title" data-split>Per a A&amp;B &lt;script&gt;<\/h1>/);
  assert.doesNotMatch(html, /page-intro/, 'no intro, no block');
  assert.doesNotMatch(dataOf(html).projects[0].title, /x/);
  assert.equal((html.match(/<\/script><b>/g) || []).length, 0);
});

test('pitchPage returns null when the list page lacks a part it edits', () => {
  assert.equal(pitchPage('<html><title>x</title></html>', { pitch: pitch(), projects: [], aiHeadings }), null);
});

/* ---------- files ---------- */

async function webRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'admin-pitch-'));
  await mkdir(path.join(root, 'projects', 'data'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<html></html>');
  for (const file of ['projects/index.html', 'en/projects/index.html', 'es/projects/index.html', 'projects-ac/index.html', 'en/projects-ac/index.html', 'es/projects-ac/index.html']) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), await readFile(path.join(REPO, file), 'utf8'));
  }
  for (const lang of ['ca', 'en', 'es']) {
    await writeFile(path.join(root, 'projects', 'data', `projects.${lang}.json`), JSON.stringify({ projects: [project('ledger', { title: `LEDGER ${lang}` }), project('poi')] }));
    await writeFile(path.join(root, 'projects', 'data', `projects-ac.${lang}.json`), JSON.stringify({ projects: [project('old')] }));
  }
  return root;
}
const publicFileOf = (root) => path.join(root, 'projects', 'data', 'projects.json');

test('writePitchPages writes one private page per pitch in its language, with the a.C. heading from that page', async () => {
  const root = await webRoot();
  const logs = [];
  await writePitchPages({ publicFile: publicFileOf(root), pitches: [pitch(), pitch({ id: 'laie-aaaaaa', lang: 'es', projects: ['projects/poi', 'projects/gone'] })], log: (line) => logs.push(line) });
  const en = await readFile(path.join(root, 'per-a', 'acme-k3x9q2', 'index.html'), 'utf8');
  assert.deepEqual(dataOf(en).projects.map((p) => [p.title, p.aiHeading]), [['LEDGER en', 'How I used AI'], ['OLD', 'How it was made']]);
  assert.equal((await stat(path.join(root, 'per-a', 'acme-k3x9q2', 'index.html'))).mode & 0o777, 0o644);
  const es = await readFile(path.join(root, 'per-a', 'laie-aaaaaa', 'index.html'), 'utf8');
  assert.match(es, /<html lang="es"/);
  assert.deepEqual(dataOf(es).projects.map((p) => p.id), ['poi'], 'a project no longer public is left out');
  assert.ok(logs.some((line) => /projects\/gone/.test(line)));
});

test('writePitchPages removes its pages for pitches that are gone, and never touches a folder it does not own', async () => {
  const root = await webRoot();
  const publicFile = publicFileOf(root);
  await writePitchPages({ publicFile, pitches: [pitch(), pitch({ id: 'old-pitch' })], log: () => {} });
  await mkdir(path.join(root, 'per-a', 'mine-not'), { recursive: true });
  await writeFile(path.join(root, 'per-a', 'mine-not', 'index.html'), '<p>by hand</p>');
  const logs = [];
  await writePitchPages({ publicFile, pitches: [pitch(), pitch({ id: 'mine-not' })], log: (line) => logs.push(line) });
  assert.ok(existsSync(path.join(root, 'per-a', 'acme-k3x9q2', 'index.html')));
  assert.ok(!existsSync(path.join(root, 'per-a', 'old-pitch')), 'removed with its folder');
  assert.equal(await readFile(path.join(root, 'per-a', 'mine-not', 'index.html'), 'utf8'), '<p>by hand</p>');
  assert.ok(logs.some((line) => /mine-not/.test(line)));
  assert.deepEqual(await readdir(path.join(root, 'per-a', 'acme-k3x9q2')), ['index.html'], 'no temp files');
});

test('writePitchPages does nothing outside a web root', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admin-pitch-'));
  await writePitchPages({ publicFile: path.join(dir, 'projects.json'), pitches: [pitch()], log: () => {} });
  assert.deepEqual(await readdir(dir), []);
});
