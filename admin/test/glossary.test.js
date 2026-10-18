import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGlossary } from '../lib/validation.js';
import { glossaryLookup, missingTerms, termUsage, glossaryPath, withPendingTerms } from '../lib/glossary.js';

const entry = (term, ca, en = '', es = '') => ({ term, explanation: { ca, en, es } });

test('validateGlossary trims, sorts alphabetically (case-insensitive) and accepts empty en / es', () => {
  const { value, errors } = validateGlossary({ terms: [entry(' RAG ', ' generació augmentada '), entry('llm', 'model de llenguatge', 'large language model'), entry('Agent', 'agent')] });
  assert.deepEqual(errors, {});
  assert.deepEqual(value.terms.map((t) => t.term), ['Agent', 'llm', 'RAG']);
  assert.deepEqual(value.terms[2], entry('RAG', 'generació augmentada'));
  assert.deepEqual(validateGlossary({ terms: [] }), { value: { terms: [] }, errors: {} });
});

test('validateGlossary rejects duplicates (case-insensitive), bad lengths and "}}"', () => {
  assert.match(validateGlossary({ terms: [entry('RAG', 'a'), entry(' rag', 'b')] }).errors['terms.1.term'], /RAG.*already/);
  assert.match(validateGlossary({ terms: [entry('', 'a')] }).errors['terms.0.term'], /required/);
  assert.match(validateGlossary({ terms: [entry('x'.repeat(61), 'a')] }).errors['terms.0.term'], /60/);
  assert.match(validateGlossary({ terms: [entry('RAG', 'a', 'x'.repeat(301))] }).errors['terms.0.explanation.en'], /300/);
  assert.match(validateGlossary({ terms: [entry('RAG', 'a }} b')] }).errors['terms.0.explanation.ca'], /\}\}/);
  assert.match(validateGlossary({ terms: [entry('a|b', 'x')] }).errors['terms.0.term'], /\|/);
  assert.ok(validateGlossary({ terms: 'nope' }).errors.terms);
  assert.ok(validateGlossary({ terms: [], extra: 1 }).errors._unknown);
  assert.ok(validateGlossary(null).errors._body);
});

const glossary = { terms: [entry('RAG', 'generació augmentada', 'retrieval-augmented generation'), entry('LLM', 'model de llenguatge')] };

test('glossaryLookup finds by key per language, falling back to ca', () => {
  assert.equal(glossaryLookup(glossary, 'en')('rag'), 'retrieval-augmented generation');
  assert.equal(glossaryLookup(glossary, 'es')('rag'), 'generació augmentada');
  assert.equal(glossaryLookup(glossary, 'en')('llm'), 'model de llenguatge');
  assert.equal(glossaryLookup(glossary, 'ca')('nope'), null);
});

test('missingTerms lists bare terms the glossary does not have, once each', () => {
  const keys = new Set(['rag']);
  assert.deepEqual(missingTerms('{{RAG}} {{MCP}} **{{mcp}}** {{Agent|own words}} `{{x}}`', keys), ['MCP']);
  assert.deepEqual(missingTerms('nothing', keys), []);
});

test('termUsage finds every bare use of a term, in any language, ignoring inline explanations', () => {
  const projects = { projects: [
    { id: 'ledger', title: 'Ledger', ai: { ca: 'Amb {{rag}}.', en: 'With {{RAG|own}}.', es: '' } },
    { id: 'olive', title: 'Olive', ai: { ca: '', en: '', es: 'Con **{{RAG}}**' } },
    { id: 'old', title: 'Old', ai: 'legacy {{RAG}}' },
  ] };
  const words = { text: { ca: '', en: 'I use {{RAG}}', es: '{{RAG|propia}}' } };
  assert.deepEqual(termUsage({ projects, words }, 'rag'), [
    '"Ledger" how I used AI (ca)', '"Olive" how I used AI (es)', '"Old" how I used AI (ca)', '"Old" how I used AI (en)', '"Old" how I used AI (es)', 'some words (en)',
  ]);
  assert.deepEqual(termUsage({ projects, words }, 'llm'), []);
});

test('glossaryPath sits next to DATA_FILE', () => {
  assert.equal(glossaryPath('/priv/data/projects.json'), '/priv/data/glossary.json');
});

test('validateGlossary accepts a pending term: empty ca, en / es empty or filled', () => {
  const { value, errors } = validateGlossary({ terms: [entry('RAG', ''), entry('MCP', '  ', 'model context protocol')] });
  assert.deepEqual(errors, {});
  assert.deepEqual(value.terms, [entry('MCP', '', 'model context protocol'), entry('RAG', '')]);
});

test('glossaryLookup gives no explanation for a pending term (ca empty) unless that language has one', () => {
  const pending = { terms: [entry('RAG', ''), entry('MCP', '', 'model context protocol')] };
  assert.equal(glossaryLookup(pending, 'ca')('rag'), null);
  assert.equal(glossaryLookup(pending, 'en')('rag'), null);
  assert.equal(glossaryLookup(pending, 'es')('mcp'), null);
  assert.equal(glossaryLookup(pending, 'en')('mcp'), 'model context protocol');
});

test('withPendingTerms adds missing bare terms once, as first written, with an empty explanation', () => {
  const current = { terms: [entry('RAG', 'generació augmentada')] };
  const { glossary: next, added } = withPendingTerms(current, [
    'Amb {{Vibe coding}} i {{rag}} i {{Agent|propi}}.',
    'With {{vibe CODING}} and **{{MCP}}** and `{{code}}`.',
    undefined,
    '{{mcp}}',
  ]);
  assert.deepEqual(added, ['Vibe coding', 'MCP']);
  assert.deepEqual(next.terms, [entry('MCP', ''), entry('RAG', 'generació augmentada'), entry('Vibe coding', '')], 'sorted like the glossary');
  assert.deepEqual(current.terms, [entry('RAG', 'generació augmentada')], 'input untouched');
  assert.deepEqual(withPendingTerms(current, ['{{RAG}} and {{x|own}}']), { glossary: current, added: [] });
  assert.deepEqual(withPendingTerms({}, ['{{New}}']).added, ['New'], 'a glossary without terms');
});

test('termUsage also finds uses in the projects (B.C.) collection, labelled "how it was made"', () => {
  const projects = { projects: [] };
  const projectsAc = { projects: [{ id: 'mill', title: 'Mill', ai: { ca: '', en: 'With {{RAG}}.', es: '' } }] };
  assert.deepEqual(termUsage({ projects, projectsAc, words: { text: '' } }, 'rag'), ['projects (B.C.) "Mill" how it was made (en)']);
  assert.deepEqual(termUsage({ projects, words: { text: '' } }, 'rag'), [], 'the collection is optional');
});
