import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore, ConflictError } from '../lib/store.js';

let dir;
let file;
const initial = { projects: [{ id: 'a', title: 'A' }] };

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'admin-store-'));
  file = path.join(dir, 'projects.json');
  await writeFile(file, `${JSON.stringify(initial, null, 2)}\n`);
});

test('read returns the data and a sha256 version', async () => {
  const store = createStore(file);
  const { data, version } = await store.read();
  assert.deepEqual(data, initial);
  assert.match(version, /^[0-9a-f]{64}$/);
});

test('update writes pretty JSON with trailing newline and keeps a .bak of the previous version', async () => {
  const store = createStore(file);
  const before = await readFile(file, 'utf8');
  const { version } = await store.read();
  const result = await store.update(version, (data) => {
    data.projects.push({ id: 'b', title: 'B' });
    return data;
  });
  const after = await readFile(file, 'utf8');
  assert.equal(after, `${JSON.stringify(result.data, null, 2)}\n`);
  assert.equal(result.data.projects.length, 2);
  assert.notEqual(result.version, version);
  assert.equal(await readFile(`${file}.bak`, 'utf8'), before);
  const leftovers = (await readdir(dir)).filter((name) => name.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'no temp files left behind');
});

test('update rejects a stale version with ConflictError and does not write', async () => {
  const store = createStore(file);
  const before = await readFile(file, 'utf8');
  await assert.rejects(store.update('stale', (data) => data), ConflictError);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('two concurrent updates with the same version: one wins, one conflicts', async () => {
  const store = createStore(file);
  const { version } = await store.read();
  const add = (id) => store.update(version, (data) => {
    data.projects.push({ id });
    return data;
  });
  const results = await Promise.allSettled([add('x'), add('y')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(results.find((r) => r.status === 'rejected').reason instanceof ConflictError);
});

test('concurrent unconditional updates are serialized, none are lost', async () => {
  const store = createStore(file);
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.update(null, async (data) => {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
    data.projects.push({ id: `p${i}` });
    return data;
  })));
  const { data } = await store.read();
  assert.equal(data.projects.length, 21);
});

test('a failing mutator leaves the file untouched and the queue usable', async () => {
  const store = createStore(file);
  const before = await readFile(file, 'utf8');
  await assert.rejects(store.update(null, () => { throw new Error('boom'); }), /boom/);
  assert.equal(await readFile(file, 'utf8'), before);
  const { data } = await store.update(null, (d) => d);
  assert.deepEqual(data, initial);
});
