import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchHref } from '../../js/shared/lang-links.js';
import { format } from '../../js/shared/i18n.js';

test('switchHref keeps the home section hash', () => {
  assert.equal(switchHref('/en/', { search: '', hash: '#secondPage' }), '/en/#secondPage');
  assert.equal(switchHref('/', { search: '', hash: '' }), '/');
});

test('switchHref keeps an open project (?p=) and drops other query parameters', () => {
  assert.equal(switchHref('/es/projects/', { search: '?p=olive-mill', hash: '' }), '/es/projects/?p=olive-mill');
  assert.equal(switchHref('/projects/', { search: '?utm_source=x&p=a%20b', hash: '' }), '/projects/?p=a+b');
  assert.equal(switchHref('/projects/', { search: '?utm_source=x', hash: '' }), '/projects/');
});

test('format fills {name} placeholders and leaves unknown ones visible', () => {
  assert.equal(format('next project: {title}', { title: 'Ledger' }), 'next project: Ledger');
  assert.equal(format('{n} projects', { n: 3 }), '3 projects');
  assert.equal(format('{a} {b}', { a: 'x' }), 'x {b}');
});
