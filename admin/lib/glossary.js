// The glossary behind {{term}}: lookups, which texts use a term, and its private file. Pure except
// prepareGlossary (boot). Explanations are per language; an empty en / es falls back to ca.
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

// Where a glossary term is used without an inline explanation, e.g. '"Ledger" how I used AI (en)'.
export function termUsage({ projects, words }, key) {
  const uses = (text) => bareKeys(text).some((term) => term.key === key);
  const places = [];
  for (const project of projects?.projects ?? []) {
    const ai = localize(project.ai);
    for (const lang of LANGS) if (uses(ai[lang])) places.push(`"${project.title}" how I used AI (${lang})`);
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
