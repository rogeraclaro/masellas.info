// Public projection of the private data: only visible projects, without the visible flag.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './store.js';

export function toPublic(data) {
  return {
    projects: data.projects
      .filter((p) => p.visible !== false)
      .map(({ id, title, category, year, description, url, thumbs, ai = '', tools = [] }) => ({
        id, title, category, year, description, url, thumbs, ai, tools,
      })),
  };
}

// No backup here: the public file lives in the web root and is always rebuilt from DATA_FILE.
export function writePublic(publicFile, data) {
  return writeAtomic(publicFile, `${JSON.stringify(toPublic(data), null, 2)}\n`, 0o644);
}

// Boot: seed DATA_FILE from PUBLIC_FILE once if needed, then bring PUBLIC_FILE in sync.
export async function prepareFiles({ dataFile, publicFile }) {
  let seeded = false;
  if (!existsSync(dataFile)) {
    if (!existsSync(publicFile)) throw new Error(`neither DATA_FILE (${dataFile}) nor PUBLIC_FILE (${publicFile}) exists`);
    const { projects } = JSON.parse(await readFile(publicFile, 'utf8'));
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify({ projects: projects.map((p) => ({ ...p, visible: true })) }, null, 2)}\n`, { mode: 0o600 });
    seeded = true;
  }
  const data = JSON.parse(await readFile(dataFile, 'utf8'));
  await writePublic(publicFile, data);
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

// Public copy: { text } only, atomic, no backup (it is rebuilt from the private file).
export function writeSomeWordsPublic(publicFile, data) {
  return writeAtomic(publicFile, `${JSON.stringify({ text: data.text }, null, 2)}\n`, 0o644);
}

// Boot: seed the private file once (from the public copy, else the repo default),
// then republish. Returns the file it was seeded from, or null.
export async function prepareSomeWords({ someWordsFile, someWordsPublicFile, defaultFile }) {
  let seeded = null;
  if (!existsSync(someWordsFile)) {
    seeded = [someWordsPublicFile, defaultFile].find((file) => file && existsSync(file)) || null;
    if (!seeded) throw new Error(`no some-words content: none of ${someWordsFile}, ${someWordsPublicFile}, ${defaultFile} exists`);
    const { text } = JSON.parse(await readFile(seeded, 'utf8'));
    await mkdir(path.dirname(someWordsFile), { recursive: true });
    await writeFile(someWordsFile, `${JSON.stringify({ text }, null, 2)}\n`, { mode: 0o600 });
  }
  const data = JSON.parse(await readFile(someWordsFile, 'utf8'));
  await writeSomeWordsPublic(someWordsPublicFile, data);
  return { seeded };
}
