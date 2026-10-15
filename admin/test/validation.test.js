import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, slugify, uniqueSlug, isPermutation } from '../lib/validation.js';

const valid = () => ({
  title: '  Ledger  ',
  category: 'web app',
  year: 2026,
  description: 'Invoices and hours.',
  url: 'https://ledger.example.com',
  visible: true,
  thumbs: ['https://img.example.com/a.png'],
});

test('accepts a valid project and trims the title', () => {
  const { value, errors } = validateProject(valid());
  assert.deepEqual(errors, {});
  assert.equal(value.title, 'Ledger');
  assert.equal(value.year, '2026');
});

test('year is free text, trimmed', () => {
  const { value, errors } = validateProject({ ...valid(), year: '  (orig. 2015) 2026 ' });
  assert.deepEqual(errors, {});
  assert.equal(value.year, '(orig. 2015) 2026');
});

test('a whole-number year (older data) is stored as text', () => {
  assert.equal(validateProject({ ...valid(), year: 2015 }).value.year, '2015');
});

test('applies defaults for optional fields on create', () => {
  const input = valid();
  delete input.description;
  delete input.visible;
  delete input.thumbs;
  const { value, errors } = validateProject(input);
  assert.deepEqual(errors, {});
  assert.equal(value.description, '');
  assert.equal(value.visible, true);
  assert.deepEqual(value.thumbs, []);
  assert.equal(value.ai, '');
  assert.deepEqual(value.tools, []);
});

test('ai is trimmed text up to 5000 chars, keeping inner blank lines', () => {
  const ai = '  First paragraph.\n\nSecond one,\nwith a line break.  ';
  const { value, errors } = validateProject({ ...valid(), ai });
  assert.deepEqual(errors, {});
  assert.equal(value.ai, 'First paragraph.\n\nSecond one,\nwith a line break.');
  assert.deepEqual(validateProject({ ...valid(), ai: 'x'.repeat(5000) }).errors, {});
});

test('tools are trimmed, kept as entered, and limited to 12', () => {
  const { value, errors } = validateProject({ ...valid(), tools: [' Claude Code ', 'n8n'] });
  assert.deepEqual(errors, {});
  assert.deepEqual(value.tools, ['Claude Code', 'n8n']);
  assert.deepEqual(validateProject({ ...valid(), tools: Array.from({ length: 12 }, (_, i) => `t${i}`) }).errors, {});
});

test('partial updates accept ai and tools alone', () => {
  const { value, errors } = validateProject({ ai: 'Notes.', tools: ['Cursor'] }, { partial: true });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { ai: 'Notes.', tools: ['Cursor'] });
});

test('lowercases and trims the category', () => {
  const { value, errors } = validateProject({ ...valid(), category: ' Web App ' });
  assert.deepEqual(errors, {});
  assert.equal(value.category, 'web app');
});

const invalidCases = [
  ['title', ''],
  ['title', '   '],
  ['title', 'x'.repeat(81)],
  ['title', 42],
  ['category', ''],
  ['category', 'x'.repeat(31)],
  ['year', ''],
  ['year', '   '],
  ['year', 'x'.repeat(31)],
  ['year', 2025.5],
  ['year', null],
  ['description', 'x'.repeat(201)],
  ['description', 5],
  ['url', 'not a url'],
  ['url', 'javascript:alert(1)'],
  ['url', 'ftp://example.com'],
  ['visible', 'yes'],
  ['thumbs', 'https://a.example.com/x.png'],
  ['thumbs', ['https://a.example.com/1.png', 'https://a.example.com/2.png', 'https://a.example.com/3.png', 'https://a.example.com/4.png']],
  ['thumbs', ['data:image/png;base64,AAAA']],
  ['ai', 'x'.repeat(5001)],
  ['ai', 42],
  ['tools', 'Claude Code, Cursor'],
  ['tools', Array.from({ length: 13 }, (_, i) => `t${i}`)],
  ['tools', ['ok', '   ']],
  ['tools', ['x'.repeat(31)]],
  ['tools', ['Claude', ' claude ']],
  ['tools', [42]],
];

for (const [field, bad] of invalidCases) {
  test(`rejects ${field} = ${JSON.stringify(bad).slice(0, 40)}`, () => {
    const { errors } = validateProject({ ...valid(), [field]: bad });
    assert.equal(typeof errors[field], 'string', `expected an error for ${field}`);
    assert.equal(Object.keys(errors).length, 1);
  });
}

test('rejects missing required fields on create', () => {
  const { errors } = validateProject({});
  assert.deepEqual(Object.keys(errors).sort(), ['category', 'title', 'url', 'year']);
});

test('rejects unknown fields, including id', () => {
  const { errors } = validateProject({ ...valid(), id: 'x', admin: true });
  assert.match(errors._unknown, /id/);
  assert.match(errors._unknown, /admin/);
});

test('rejects a non-object body', () => {
  assert.ok(validateProject(null).errors._body);
  assert.ok(validateProject([]).errors._body);
});

test('partial mode validates only the given fields', () => {
  const { value, errors } = validateProject({ visible: false }, { partial: true });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { visible: false });
  assert.ok(validateProject({ year: '' }, { partial: true }).errors.year);
});

test('slugify makes a URL-safe slug', () => {
  assert.equal(slugify('Olive Mill'), 'olive-mill');
  assert.equal(slugify('  Café & Crème!  '), 'cafe-creme');
  assert.equal(slugify('***'), 'project');
  assert.ok(slugify('a'.repeat(200)).length <= 60);
});

test('uniqueSlug adds a numeric suffix on collisions', () => {
  assert.equal(uniqueSlug('Ledger', []), 'ledger');
  assert.equal(uniqueSlug('Ledger', ['ledger']), 'ledger-2');
  assert.equal(uniqueSlug('Ledger', ['ledger', 'ledger-2']), 'ledger-3');
});

test('isPermutation accepts only an exact permutation', () => {
  assert.equal(isPermutation(['b', 'a', 'c'], ['a', 'b', 'c']), true);
  assert.equal(isPermutation(['a', 'b'], ['a', 'b', 'c']), false);
  assert.equal(isPermutation(['a', 'b', 'b'], ['a', 'b', 'c']), false);
  assert.equal(isPermutation(['a', 'b', 'd'], ['a', 'b', 'c']), false);
  assert.equal(isPermutation(['a', 'b', 'c', 'c'], ['a', 'b', 'c']), false);
  assert.equal(isPermutation('abc', ['a', 'b', 'c']), false);
  assert.equal(isPermutation([1, 2], ['1', '2']), false);
});
