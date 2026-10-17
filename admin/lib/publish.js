// Public projection of the private data: only visible projects, without the visible flag,
// with the per-language fields flattened for one language (empty -> ca).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './store.js';
import { LANGS, DEFAULT_LANG, pick, localizedFile, migrateProjects, migrateSomeWords } from './languages.js';
import { resolveTerms } from './rich-text.js';
import { glossaryLookup } from './glossary.js';

// Rich text for one language with its {{term}}s explained from the glossary (in that language, or ca),
// so the site never needs the glossary itself.
const publicText = (value, lang, glossary) => resolveTerms(pick(value, lang), glossaryLookup(glossary, lang));

export function toPublic(data, lang = DEFAULT_LANG, glossary = null) {
  return {
    projects: data.projects
      .filter((p) => p.visible !== false)
      .map(({ id, title, category, year, description, url, thumbs, ai = '', tools = [] }) => ({
        id, title, category: pick(category, lang), year, description: pick(description, lang), url, thumbs, ai: publicText(ai, lang, glossary), tools,
      })),
  };
}

// <name>.<lang>.json for each language, plus the legacy <name>.json (= ca) that pages loaded
// before the site had languages still fetch. Each file is atomic, 0644, without backup: they live
// in the web root and are always rebuilt from the private file.
async function writeLanguages(file, publicFor) {
  const json = (lang) => `${JSON.stringify(publicFor(lang), null, 2)}\n`;
  for (const lang of LANGS) await writeAtomic(localizedFile(file, lang), json(lang), 0o644);
  await writeAtomic(file, json(DEFAULT_LANG), 0o644);
}

export function writePublic(publicFile, data, glossary = null) {
  return writeLanguages(publicFile, (lang) => toPublic(data, lang, glossary));
}

// Boot: seed DATA_FILE from PUBLIC_FILE once if needed, then bring PUBLIC_FILE in sync.
export async function prepareFiles({ dataFile, publicFile, glossary = null }) {
  let seeded = false;
  if (!existsSync(dataFile)) {
    if (!existsSync(publicFile)) throw new Error(`neither DATA_FILE (${dataFile}) nor PUBLIC_FILE (${publicFile}) exists`);
    const { projects } = JSON.parse(await readFile(publicFile, 'utf8'));
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify({ projects: projects.map((p) => ({ ...p, visible: true })) }, null, 2)}\n`, { mode: 0o600 });
    seeded = true;
  }
  const data = migrateProjects(JSON.parse(await readFile(dataFile, 'utf8')));
  await writePublic(publicFile, data, glossary);
  return { seeded };
}

/* ---------- "some words" (home section text) ---------- */

// Stored next to the projects files, so no extra configuration is needed.
export function someWordsPaths({ dataFile, publicFile }) {
  return {
    someWordsFile: path.join(path.dirname(dataFile), 'some-words.json'),
    someWordsPublicFile: path.join(path.dirname(publicFile), 'some-words.json'),
  };
}

// Public copies: { text } for one language each (empty -> ca), plus the legacy file (= ca).
export function writeSomeWordsPublic(publicFile, data, glossary = null) {
  return writeLanguages(publicFile, (lang) => ({ text: publicText(data.text, lang, glossary) }));
}

// Boot: seed the private file once (from the public copy, else the repo default),
// then republish. Returns the file it was seeded from, or null.
export async function prepareSomeWords({ someWordsFile, someWordsPublicFile, defaultFile, glossary = null }) {
  let seeded = null;
  if (!existsSync(someWordsFile)) {
    seeded = [someWordsPublicFile, defaultFile].find((file) => file && existsSync(file)) || null;
    if (!seeded) throw new Error(`no some-words content: none of ${someWordsFile}, ${someWordsPublicFile}, ${defaultFile} exists`);
    const { text } = JSON.parse(await readFile(seeded, 'utf8'));
    await mkdir(path.dirname(someWordsFile), { recursive: true });
    await writeFile(someWordsFile, `${JSON.stringify({ text }, null, 2)}\n`, { mode: 0o600 });
  }
  const data = migrateSomeWords(JSON.parse(await readFile(someWordsFile, 'utf8')));
  await writeSomeWordsPublic(someWordsPublicFile, data, glossary);
  return { seeded };
}
