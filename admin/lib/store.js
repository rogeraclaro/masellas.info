// JSON file store: atomic writes, one rolling .bak, serialized updates, sha256 versions.
import { readFile, writeFile, rename, copyFile, stat, unlink } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

export class ConflictError extends Error {
  constructor(version) {
    super('data changed since it was read');
    this.version = version;
  }
}

const hash = (content) => createHash('sha256').update(content).digest('hex');

export function createStore(file) {
  let queue = Promise.resolve();

  async function read() {
    const content = await readFile(file, 'utf8');
    return { data: JSON.parse(content), version: hash(content) };
  }

  async function write(data) {
    const content = `${JSON.stringify(data, null, 2)}\n`;
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomBytes(6).toString('hex')}.tmp`);
    const { mode } = await stat(file);
    try {
      await writeFile(tmp, content, { mode });
      await copyFile(file, `${file}.bak`);
      await rename(tmp, file);
    } catch (err) {
      await unlink(tmp).catch(() => {});
      throw err;
    }
    return hash(content);
  }

  // mutate(data) returns the new data. expectedVersion null skips the check.
  function update(expectedVersion, mutate) {
    const run = queue.then(async () => {
      const current = await read();
      if (expectedVersion !== null && expectedVersion !== current.version) throw new ConflictError(current.version);
      const data = await mutate(current.data);
      return { data, version: await write(data) };
    });
    queue = run.catch(() => {});
    return run;
  }

  return { read, update };
}
