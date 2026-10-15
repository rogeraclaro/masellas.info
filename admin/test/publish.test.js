import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { toPublic, writePublic, prepareFiles } from '../lib/publish.js';

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

test('writePublic writes atomically, mode 0644, with no backup or temp files left', async () => {
  await writeFile(publicFile, '{"projects":[]}\n');
  await writePublic(publicFile, { projects: [project('a', true), project('b', false)] });
  const written = JSON.parse(await readFile(publicFile, 'utf8'));
  assert.deepEqual(written.projects.map((p) => p.id), ['a']);
  assert.deepEqual(await readdir(path.dirname(publicFile)), ['projects.json']);
  assert.equal((await stat(publicFile)).mode & 0o777, 0o644);
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
