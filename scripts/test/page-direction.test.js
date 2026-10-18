import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionType, readHandoff } from '../../js/shared/page-direction.js';

test('a page further left enters from the left', () => {
  assert.equal(transitionType(0, -1), 'slide-from-left'); // home -> projects
  assert.equal(transitionType('1', '-1'), 'slide-from-left');
});

test('a page further right enters from the right', () => {
  assert.equal(transitionType(-1, 0), 'slide-from-right'); // projects -> home
  assert.equal(transitionType('0', '1'), 'slide-from-right'); // home -> a future right-hand page
});

test('projects (B.C.) at +1 enters from the right from home and projects (IA), and leaves to the left', () => {
  assert.equal(transitionType('0', '1'), 'slide-from-right'); // home -> projects (B.C.)
  assert.equal(transitionType('-1', '1'), 'slide-from-right'); // projects (IA) -> projects (B.C.)
  assert.equal(transitionType('1', '-1'), 'slide-from-left'); // and back
  assert.equal(transitionType('1', '0'), 'slide-from-left'); // projects (B.C.) -> home
  assert.equal(transitionType('1', '1'), 'fade'); // /projects-ac/ -> /en/projects-ac/
});

test('same position crossfades (e.g. a language switch: same page, other language)', () => {
  assert.equal(transitionType(0, 0), 'fade'); // /  -> /en/
  assert.equal(transitionType('-1', '-1'), 'fade'); // /projects/ -> /es/projects/
  assert.equal(transitionType('0', 0), 'fade');
});

test('unknown positions give no transition', () => {
  assert.equal(transitionType(undefined, 0), null);
  assert.equal(transitionType(null, 0), null);
  assert.equal(transitionType('', '0'), null);
  assert.equal(transitionType('left', '0'), null);
  assert.equal(transitionType(0, '   '), null);
});

test('readHandoff returns the previous page position when fresh', () => {
  const raw = JSON.stringify({ x: '0', at: 1000 });
  assert.equal(readHandoff(raw, 1500), '0');
});

test('readHandoff ignores stale, malformed or missing handoffs', () => {
  assert.equal(readHandoff(JSON.stringify({ x: '0', at: 1000 }), 1000 + 60_001), null);
  assert.equal(readHandoff(JSON.stringify({ x: '0', at: 5000 }), 1000), null, 'from the future');
  assert.equal(readHandoff('not json', 1000), null);
  assert.equal(readHandoff(JSON.stringify({ at: 1000 }), 1000), null);
  assert.equal(readHandoff(null, 1000), null);
});
