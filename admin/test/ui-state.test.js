import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpOpen, hasChanges } from '../public/ui-state.js';

test('formatting help is closed unless the user opened it before', () => {
  assert.equal(helpOpen(null), false, 'never toggled');
  assert.equal(helpOpen('closed'), false);
  assert.equal(helpOpen('open'), true);
  assert.equal(helpOpen('garbage'), false);
});

test('hasChanges compares form values by content, not identity or key order', () => {
  const saved = { title: 'Ledger', category: { ca: 'eina', en: '', es: '' }, thumbs: [], visible: true };
  assert.equal(hasChanges(saved, structuredClone(saved)), false);
  assert.equal(hasChanges(saved, { visible: true, thumbs: [], category: { es: '', en: '', ca: 'eina' }, title: 'Ledger' }), false, 'key order');
  assert.equal(hasChanges(saved, { ...saved, title: 'Ledger 2' }), true);
  assert.equal(hasChanges(saved, { ...saved, category: { ca: 'eina', en: 'tool', es: '' } }), true, 'nested');
  assert.equal(hasChanges(saved, { ...saved, thumbs: ['https://x.example'] }), true, 'arrays');
  assert.equal(hasChanges(null, saved), true, 'nothing saved yet');
});
