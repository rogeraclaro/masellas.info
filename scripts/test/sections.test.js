import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapIndex, step, jump, indexFromHash, createGestureGate } from '../../js/home/sections.js';

test('wrapIndex keeps the index inside 0..n-1, both ways (continuousVertical)', () => {
  assert.equal(wrapIndex(0, 2), 0);
  assert.equal(wrapIndex(2, 2), 0);
  assert.equal(wrapIndex(-1, 2), 1);
  assert.equal(wrapIndex(5, 3), 2);
  assert.equal(wrapIndex(-4, 3), 2);
});

test('step moves one section and keeps the gesture direction across the wrap', () => {
  assert.deepEqual(step(0, 1, 2), { index: 1, direction: 'down' });
  assert.deepEqual(step(1, 1, 2), { index: 0, direction: 'down' }, 'down from the last wraps to the first');
  assert.deepEqual(step(0, -1, 2), { index: 1, direction: 'up' }, 'up from the first wraps to the last');
  assert.deepEqual(step(1, -1, 2), { index: 0, direction: 'up' });
});

test('jump picks the direction from the positions, or null when already there', () => {
  assert.deepEqual(jump(0, 1), { index: 1, direction: 'down' });
  assert.deepEqual(jump(1, 0), { index: 0, direction: 'up' });
  assert.equal(jump(1, 1), null);
});

test('indexFromHash maps anchors to indexes, unknown to -1', () => {
  const anchors = ['firstPage', 'secondPage'];
  assert.equal(indexFromHash('#firstPage', anchors), 0);
  assert.equal(indexFromHash('#secondPage', anchors), 1);
  assert.equal(indexFromHash('secondPage', anchors), 1);
  assert.equal(indexFromHash('', anchors), -1);
  assert.equal(indexFromHash('#3rdPage', anchors), -1);
});

test('gesture gate: one accepted event per gesture; inertia tails are ignored', () => {
  const gate = createGestureGate(200);
  assert.equal(gate.accept(0), true, 'first event of a gesture');
  // Trackpad inertia: events every ~16 ms for 1.5 s, never a 200 ms pause.
  for (let t = 16; t < 1500; t += 16) assert.equal(gate.accept(t), false);
  assert.equal(gate.accept(1500 + 250), true, 'a new gesture after a pause');
  assert.equal(gate.accept(1500 + 260), false);
});

test('gesture gate: a gap exactly at the threshold still counts as the same gesture', () => {
  const gate = createGestureGate(200);
  gate.accept(0);
  assert.equal(gate.accept(200), false);
  assert.equal(gate.accept(401), true);
});
