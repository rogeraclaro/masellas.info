// Pure .env update used by `hash-password --env`: set ADMIN_PASSWORD_HASH, add SESSION_SECRET only if missing.
import { parseEnv } from './config.js';

function upsert(lines, key, value) {
  const index = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (index === -1) lines.push(`${key}=${value}`);
  else lines[index] = `${key}=${value}`;
}

export function updateEnvText(text, { passwordHash, newSecret }) {
  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n');
  upsert(lines, 'ADMIN_PASSWORD_HASH', passwordHash);
  if (!parseEnv(text).SESSION_SECRET) upsert(lines, 'SESSION_SECRET', newSecret);
  return `${lines.join('\n')}\n`;
}
