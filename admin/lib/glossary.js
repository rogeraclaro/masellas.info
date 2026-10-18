// The glossary behind {{term}}: lookups, which texts use a term, and its private file. Pure except
// prepareGlossary (boot). Explanations are per language; an empty en / es falls back to ca; an empty
// ca means the term is pending (added automatically from a text, not defined yet).
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseRichText, termKey } from './rich-text.js';
import { LANGS, localize, pick } from './languages.js';

// Next to DATA_FILE, like some-words.json: no extra configuration.
export const glossaryPath = (dataFile) => path.join(path.dirname(dataFile), 'glossary.json');

// key -> explanation in `lang` (or ca), or null.
export function glossaryLookup(glossary, lang) {
  const byKey = new Map((glossary?.terms ?? []).map((entry) => [termKey(entry.term), entry.explanation]));
  return (key) => (byKey.has(key) ? pick(byKey.get(key), lang) || null : null);
}

// Every term node in a rich text.
function termsIn(text) {
  const found = [];
  const walk = (parts) => {
    for (const part of parts) {
      if (part.type === 'term') found.push(part);
      else if (part.parts) walk(part.parts);
    }
  };
  for (const block of parseRichText(text).blocks) {
    if (block.items) block.items.forEach(walk);
    else walk(block.parts);
  }
  return found;
}

const bareKeys = (text) => termsIn(text).filter((term) => term.explanation === null);

// Labels of {{term}}s (no inline explanation) the glossary does not have, once each.
export function missingTerms(text, keys) {
  const missing = new Map();
  for (const term of bareKeys(text)) if (!keys.has(term.key) && !missing.has(term.key)) missing.set(term.key, term.label);
  return [...missing.values()];
}

// A term written as {{term}} that the glossary lacks joins it pending: explanation { ca: '', … } (empty
// ca = pending; it publishes as the plain word until defined). texts: rich texts (undefined skipped).
// Returns { glossary, added: [labels as first written] }; the same glossary object when nothing is added.
export function withPendingTerms(glossary, texts) {
  const terms = glossary?.terms ?? [];
  const keys = new Set(terms.map((entry) => termKey(entry.term)));
  const added = [];
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const label of missingTerms(text, keys)) {
      keys.add(termKey(label));
      added.push(label);
    }
  }
  if (!added.length) return { glossary, added };
  const pending = added.map((term) => ({ term, explanation: Object.fromEntries(LANGS.map((lang) => [lang, ''])) }));
  const sorted = [...terms, ...pending].sort((a, b) => termKey(a.term).localeCompare(termKey(b.term)));
  return { glossary: { ...glossary, terms: sorted }, added };
}

// Where a glossary term is used without an inline explanation, e.g. '"Ledger" how I used AI (en)' or,
// in projects (B.C.), 'projects (B.C.) "Mill" how it was made (ca)'.
export function termUsage({ projects, projectsAc, words }, key) {
  const uses = (text) => bareKeys(text).some((term) => term.key === key);
  const places = [];
  const collections = [[projects, (title) => `"${title}" how I used AI`], [projectsAc, (title) => `projects (B.C.) "${title}" how it was made`]];
  for (const [collection, where] of collections) {
    for (const project of collection?.projects ?? []) {
      const ai = localize(project.ai);
      for (const lang of LANGS) if (uses(ai[lang])) places.push(`${where(project.title)} (${lang})`);
    }
  }
  const text = localize(words?.text);
  for (const lang of LANGS) if (uses(text[lang])) places.push(`some words (${lang})`);
  return places;
}

// Boot: create an empty glossary once (mode 0600, like the other private files).
export async function prepareGlossary({ glossaryFile }) {
  if (existsSync(glossaryFile)) return { created: false };
  await mkdir(path.dirname(glossaryFile), { recursive: true });
  await writeFile(glossaryFile, `${JSON.stringify({ terms: [] }, null, 2)}\n`, { mode: 0o600 });
  return { created: true };
}
