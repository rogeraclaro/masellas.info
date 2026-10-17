import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toPublic, writePublic, prepareFiles, writeSomeWordsPublic } from '../lib/publish.js';

const project = (id, visible) => ({
  id, title: id.toUpperCase(), category: 'tool', year: 2026, description: '', url: `https://${id}.example.com`, visible, thumbs: [],
});

let dir;
let dataFile;
let publicFile;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'admin-publish-'));
  await mkdir(path.join(dir, 'private'));
  await mkdir(path.join(dir, 'web'));
  dataFile = path.join(dir, 'private', 'projects.json');
  publicFile = path.join(dir, 'web', 'projects.json');
});

test('toPublic keeps only visible projects, in order, without the visible field', () => {
  const data = { projects: [project('a', true), project('b', false), project('c', true), { ...project('d', true), visible: undefined }] };
  const result = toPublic(data);
  assert.deepEqual(result.projects.map((p) => p.id), ['a', 'c', 'd']);
  for (const p of result.projects) {
    assert.deepEqual(Object.keys(p), ['id', 'title', 'category', 'year', 'description', 'url', 'thumbs', 'ai', 'tools']);
  }
  assert.equal(data.projects.length, 4, 'input is not mutated');
  assert.equal(data.projects[0].visible, true);
});

test('toPublic fills ai and tools defaults for older records and keeps given values', () => {
  const old = project('old', true);
  const rich = { ...project('rich', true), ai: 'Claude drafted it.', tools: ['Claude Code'] };
  const [first, second] = toPublic({ projects: [old, rich] }).projects;
  assert.equal(first.ai, '');
  assert.deepEqual(first.tools, []);
  assert.equal(second.ai, 'Claude drafted it.');
  assert.deepEqual(second.tools, ['Claude Code']);
});

test('writePublic writes one file per language plus the legacy one, atomically, mode 0644, no backup or temp files', async () => {
  await writeFile(publicFile, '{"projects":[]}\n');
  await writePublic(publicFile, { projects: [project('a', true), project('b', false)] });
  const files = ['projects.ca.json', 'projects.en.json', 'projects.es.json', 'projects.json'];
  assert.deepEqual((await readdir(path.dirname(publicFile))).sort(), files);
  for (const name of files) {
    const file = path.join(path.dirname(publicFile), name);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).projects.map((p) => p.id), ['a'], name);
    assert.equal((await stat(file)).mode & 0o777, 0o644, name);
  }
});

const localized = {
  ...project('loc', true),
  category: { ca: 'eina', en: 'tool', es: '' },
  description: { ca: 'Descripció.', en: '', es: 'Descripción.' },
  ai: { ca: 'Notes ca.', en: 'Notes en.', es: '' },
};

test('toPublic flattens per-language fields for the language, falling back to ca when empty', () => {
  const [en] = toPublic({ projects: [localized] }, 'en').projects;
  assert.equal(en.category, 'tool');
  assert.equal(en.description, 'Descripció.', 'empty en description falls back to ca');
  assert.equal(en.ai, 'Notes en.');
  const [es] = toPublic({ projects: [localized] }, 'es').projects;
  assert.equal(es.category, 'eina', 'empty es category falls back to ca');
  assert.equal(es.description, 'Descripción.');
  assert.equal(es.ai, 'Notes ca.');
  const [ca] = toPublic({ projects: [localized] }).projects;
  assert.deepEqual([ca.category, ca.description, ca.ai], ['eina', 'Descripció.', 'Notes ca.'], 'default is ca');
  assert.deepEqual(Object.keys(en), ['id', 'title', 'category', 'year', 'description', 'url', 'thumbs', 'ai', 'tools']);
});

test('writePublic writes each language its own text; the legacy projects.json is ca', async () => {
  await writePublic(publicFile, { projects: [localized] });
  const read = async (name) => JSON.parse(await readFile(path.join(path.dirname(publicFile), name), 'utf8')).projects[0];
  assert.equal((await read('projects.en.json')).category, 'tool');
  assert.equal((await read('projects.es.json')).category, 'eina');
  assert.equal((await read('projects.ca.json')).category, 'eina');
  assert.deepEqual(await read('projects.json'), await read('projects.ca.json'));
});

test('writePublic fails loudly when the target directory is missing', async () => {
  await assert.rejects(writePublic(path.join(dir, 'missing', 'projects.json'), { projects: [] }));
});

test('prepareFiles regenerates a stale public file from the private data', async () => {
  await writeFile(dataFile, JSON.stringify({ projects: [project('a', false), project('b', true)] }));
  await writeFile(publicFile, JSON.stringify({ projects: [project('stale', true)] }));
  const result = await prepareFiles({ dataFile, publicFile });
  assert.equal(result.seeded, false);
  const pub = JSON.parse(await readFile(publicFile, 'utf8'));
  assert.deepEqual(pub.projects.map((p) => p.id), ['b']);
  const es = JSON.parse(await readFile(path.join(path.dirname(publicFile), 'projects.es.json'), 'utf8'));
  assert.deepEqual(es.projects.map((p) => p.category), ['tool'], 'legacy private data is published per language');
});

test('prepareFiles seeds the private file from the public one when it is missing', async () => {
  const { visible, ...publicA } = project('a', true);
  await writeFile(publicFile, JSON.stringify({ projects: [publicA] }));
  const result = await prepareFiles({ dataFile, publicFile });
  assert.equal(result.seeded, true);
  const data = JSON.parse(await readFile(dataFile, 'utf8'));
  assert.deepEqual(data.projects, [{ ...publicA, visible: true }]);
  assert.deepEqual(JSON.parse(await readFile(publicFile, 'utf8')).projects, [{ ...publicA, ai: '', tools: [] }]);
});

test('prepareFiles fails when neither file exists', async () => {
  await assert.rejects(prepareFiles({ dataFile, publicFile }), /DATA_FILE/);
});

const glossary = { terms: [{ term: 'RAG', explanation: { ca: 'generació augmentada', en: 'retrieval-augmented generation', es: '' } }] };

test('publishing resolves glossary terms per language (fallback ca) and keeps inline explanations', async () => {
  const data = { projects: [{ ...project('t', true), ai: { ca: 'Amb {{RAG}}.', en: 'With {{RAG}} and {{LLM|large language model}}.', es: 'Con {{rag}}.' } }] };
  assert.equal(toPublic(data, 'en', glossary).projects[0].ai, 'With {{RAG|retrieval-augmented generation}} and {{LLM|large language model}}.');
  assert.equal(toPublic(data, 'es', glossary).projects[0].ai, 'Con {{rag|generació augmentada}}.');
  assert.equal(toPublic(data, 'ca').projects[0].ai, 'Amb {{RAG}}.', 'no glossary: left as written');
  await writePublic(publicFile, data, glossary);
  const read = async (name) => JSON.parse(await readFile(path.join(path.dirname(publicFile), name), 'utf8')).projects[0].ai;
  assert.equal(await read('projects.ca.json'), 'Amb {{RAG|generació augmentada}}.');
  assert.equal(await read('projects.json'), 'Amb {{RAG|generació augmentada}}.');
  const words = path.join(path.dirname(publicFile), 'some-words.json');
  await writeSomeWordsPublic(words, { text: { ca: '{{RAG}}', en: '{{RAG}}', es: '' } }, glossary);
  const text = async (lang) => JSON.parse(await readFile(path.join(path.dirname(publicFile), `some-words.${lang}.json`), 'utf8')).text;
  assert.equal(await text('en'), '{{RAG|retrieval-augmented generation}}');
  assert.equal(await text('es'), '{{RAG|generació augmentada}}', 'empty es text falls back to ca, then resolves for es (ca explanation)');
});
