import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchHref } from '../../js/shared/lang-links.js';
import { projectHref, projectIdFrom } from '../../js/shared/project-url.js';
import { format } from '../../js/shared/i18n.js';

test('switchHref keeps the home section hash', () => {
  assert.equal(switchHref('/en/', { pathname: '/', search: '', hash: '#secondPage' }), '/en/#secondPage');
  assert.equal(switchHref('/', { pathname: '/en/', search: '', hash: '' }), '/');
});

test('switchHref keeps an open project as <list path><id>/ and drops query parameters', () => {
  assert.equal(switchHref('/es/projects/', { pathname: '/projects/olive-mill/', search: '' }, '/projects/'), '/es/projects/olive-mill/');
  assert.equal(switchHref('/projects-ac/', { pathname: '/en/projects-ac/ruc/', search: '?utm_source=x' }, '/en/projects-ac/'), '/projects-ac/ruc/');
  assert.equal(switchHref('/projects/', { pathname: '/en/projects/', search: '?utm_source=x' }, '/en/projects/'), '/projects/');
});

test('switchHref turns a legacy ?p=<id> into the path form', () => {
  assert.equal(switchHref('/es/projects/', { pathname: '/projects/', search: '?utm_source=x&p=olive-mill' }, '/projects/'), '/es/projects/olive-mill/');
});

test('switchHref without a list path (the home) keeps no project', () => {
  assert.equal(switchHref('/en/', { pathname: '/', search: '?p=x', hash: '' }), '/en/');
});

test('projectHref / projectIdFrom: <list path><id>/, the legacy ?p=<id>, nothing else', () => {
  assert.equal(projectHref('/en/projects/', 'ledger'), '/en/projects/ledger/');
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/ledger/', search: '' }), 'ledger');
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/ledger', search: '' }), 'ledger', 'no trailing slash');
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/', search: '?p=old' }), 'old');
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/', search: '' }), null);
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/a/b/', search: '' }), null);
  assert.equal(projectIdFrom('/en/projects/', { pathname: '/en/projects/%E0%A4%A/', search: '' }), null, 'malformed escape');
});

test('format fills {name} placeholders and leaves unknown ones visible', () => {
  assert.equal(format('next project: {title}', { title: 'Ledger' }), 'next project: Ledger');
  assert.equal(format('{n} projects', { n: 3 }), '3 projects');
  assert.equal(format('{a} {b}', { a: 'x' }), 'x {b}');
});
