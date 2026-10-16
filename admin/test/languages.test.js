import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, localize, pick, migrateProjects, migrateSomeWords, localizedFile } from '../lib/languages.js';

test('languages: ca first (principal), then en and es', () => {
  assert.deepEqual(LANGS, ['ca', 'en', 'es']);
});

test('localize copies a legacy string to every language and completes partial objects', () => {
  assert.deepEqual(localize('tool'), { ca: 'tool', en: 'tool', es: 'tool' });
  assert.deepEqual(localize({ ca: 'eina', en: 'tool' }), { ca: 'eina', en: 'tool', es: '' });
  assert.deepEqual(localize({ ca: 'eina', en: 3, fr: 'x' }), { ca: 'eina', en: '', es: '' });
  assert.deepEqual(localize(undefined), { ca: '', en: '', es: '' });
  assert.deepEqual(localize(null), { ca: '', en: '', es: '' });
});

test('pick returns the language, falling back to ca when it is empty', () => {
  const value = { ca: 'eina', en: 'tool', es: '' };
  assert.equal(pick(value, 'en'), 'tool');
  assert.equal(pick(value, 'es'), 'eina');
  assert.equal(pick({ ca: 'eina', en: '   ', es: '' }, 'en'), 'eina', 'blank counts as empty');
  assert.equal(pick('legacy', 'es'), 'legacy');
});

test('migrateProjects turns legacy strings into { ca, en, es } and keeps everything else', () => {
  const legacy = {
    projects: [
      { id: 'a', title: 'A', category: 'tool', year: '2026', description: 'Desc.', url: 'https://a.example', visible: false, thumbs: [], ai: 'Notes.', tools: ['x'] },
      { id: 'b', title: 'B', category: 'web', year: 2015, url: 'https://b.example', thumbs: [] }, // older record: no description, ai
    ],
  };
  const copy = structuredClone(legacy);
  const { projects: [a, b] } = migrateProjects(legacy);
  assert.deepEqual(a, {
    id: 'a', title: 'A', category: { ca: 'tool', en: 'tool', es: 'tool' }, year: '2026',
    description: { ca: 'Desc.', en: 'Desc.', es: 'Desc.' }, url: 'https://a.example', visible: false, thumbs: [],
    ai: { ca: 'Notes.', en: 'Notes.', es: 'Notes.' }, tools: ['x'],
  });
  assert.deepEqual(b.description, { ca: '', en: '', es: '' });
  assert.deepEqual(b.ai, { ca: '', en: '', es: '' });
  assert.equal(b.year, 2015);
  assert.deepEqual(Object.keys(a), Object.keys(legacy.projects[0]), 'field order kept');
  assert.deepEqual(legacy, copy, 'input is not mutated');
});

test('migrateProjects leaves migrated data as it is (idempotent)', () => {
  const once = migrateProjects({ projects: [{ id: 'a', category: { ca: 'eina', en: 'tool', es: '' }, description: 'x', ai: '' }] });
  assert.deepEqual(migrateProjects(once), once);
  assert.deepEqual(once.projects[0].category, { ca: 'eina', en: 'tool', es: '' });
});

test('migrateProjects never fails on odd data', () => {
  assert.deepEqual(migrateProjects({}), { projects: [] });
  assert.deepEqual(migrateProjects({ projects: null }), { projects: [] });
});

test('migrateSomeWords turns { text } into { text: { ca, en, es } }', () => {
  assert.deepEqual(migrateSomeWords({ text: 'Hi.' }), { text: { ca: 'Hi.', en: 'Hi.', es: 'Hi.' } });
  const done = { text: { ca: 'Hola.', en: 'Hi.', es: '' } };
  assert.deepEqual(migrateSomeWords(done), done);
});

test('localizedFile puts the language before the extension, in the same directory', () => {
  assert.equal(localizedFile('/web/projects/data/projects.json', 'en'), '/web/projects/data/projects.en.json');
  assert.equal(localizedFile('/web/projects/data/some-words.json', 'ca'), '/web/projects/data/some-words.ca.json');
});
