// JSON file store: atomic writes, one rolling .bak, serialized updates, sha256 versions.
import { readFile, writeFile, rename, copyFile, stat, unlink, chmod } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

export class ConflictError extends Error {
  constructor(version) {
    super('data changed since it was read');
    this.version = version;
  }
}

// Temp dotfile in the same directory + rename, so readers never see a half-written file.
export async function writeAtomic(file, content, mode = 0o644) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${randomBytes(6).toString('hex')}`);
  try {
    await writeFile(tmp, content, { mode });
    await chmod(tmp, mode); // writeFile's mode is filtered by the umask
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

const hash = (content) => createHash('sha256').update(content).digest('hex');

// migrate(data) upgrades older shapes on read; the version stays the hash of the file as
// stored, and the next write stores the upgraded shape.
export function createStore(file, { migrate = (data) => data } = {}) {
  let queue = Promise.resolve();

  async function read() {
    const content = await readFile(file, 'utf8');
    return { data: migrate(JSON.parse(content)), version: hash(content) };
  }

  async function write(data) {
    const content = `${JSON.stringify(data, null, 2)}\n`;
    const { mode } = await stat(file);
    await copyFile(file, `${file}.bak`);
    await writeAtomic(file, content, mode);
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
