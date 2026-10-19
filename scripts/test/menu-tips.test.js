import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuTipUrl, tipText } from '../../js/shared/menu-tips.js';

test('menuTipUrl is absolute, so /en/ and /es/ pages fetch the shared data folder', () => {
  assert.equal(menuTipUrl('ca'), '/projects/data/menu.ca.json');
  assert.equal(menuTipUrl('en'), '/projects/data/menu.en.json');
});

test('tipText gives the trimmed tooltip for a tab, or empty for anything missing or malformed', () => {
  const json = { tooltips: { 'projects-ac': '  before AI ' } };
  assert.equal(tipText(json, 'projects-ac'), 'before AI');
  assert.equal(tipText(json, 'other'), '');
  assert.equal(tipText({ tooltips: { 'projects-ac': '' } }, 'projects-ac'), '', 'pending in the glossary');
  assert.equal(tipText({ tooltips: { 'projects-ac': 3 } }, 'projects-ac'), '');
  assert.equal(tipText({ tooltips: { constructor: 'x' } }, 'toString'), '');
  assert.equal(tipText(null, 'projects-ac'), '');
  assert.equal(tipText({}, 'projects-ac'), '');
});
