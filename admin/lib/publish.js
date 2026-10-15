// Public projection of the private data: only visible projects, without the visible flag.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './store.js';

export function toPublic(data) {
  return {
    projects: data.projects
      .filter((p) => p.visible !== false)
      .map(({ id, title, category, year, description, url, thumbs }) => ({ id, title, category, year, description, url, thumbs })),
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
