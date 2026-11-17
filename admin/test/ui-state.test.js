import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpOpen, hasChanges, untranslated, translationGaps } from '../public/ui-state.js';

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

test('untranslated: a long text identical to ca counts, short ones and empty ca do not', () => {
  const long = 'Cercador de graus de Formació Professional de tot l’estat.';
  assert.equal(untranslated(long, long), true);
  assert.equal(untranslated(long, `  ${long}\n`), true, 'whitespace around does not hide it');
  assert.equal(untranslated(long, 'Search engine for vocational training degrees.'), false);
  assert.equal(untranslated('web app', 'web app'), false, 'short labels are often the same in every language');
  assert.equal(untranslated('', ''), false);
  assert.equal(untranslated(long, ''), false, 'empty is reported apart');
});

test('translationGaps lists, per language, the fields left empty or copied from ca', () => {
  const ca = 'Aquesta app va sortir de l’observació del portal del ministeri.';
  const project = {
    category: { ca: 'cercador', en: '', es: 'buscador' },
    description: { ca, en: 'This app came from looking at the ministry portal.', es: ca },
    ai: { ca, en: '', es: 'Esta app salió de observar el portal del ministerio.' },
  };
  assert.deepEqual(translationGaps(project), [
    { lang: 'en', field: 'category', kind: 'empty' },
    { lang: 'en', field: 'ai', kind: 'empty' },
    { lang: 'es', field: 'description', kind: 'same' },
  ]);
});

test('translationGaps ignores fields that are empty in ca and a fully translated project', () => {
  const done = { category: { ca: 'joc', en: 'game', es: 'juego' }, description: { ca: '', en: '', es: '' }, ai: { ca: 'Text llarg en català, prou per comptar.', en: 'A long English text, enough to count.', es: 'Un texto largo en castellano, suficiente.' } };
  assert.deepEqual(translationGaps(done), []);
  assert.deepEqual(translationGaps({}), [], 'missing fields are not gaps');
});
