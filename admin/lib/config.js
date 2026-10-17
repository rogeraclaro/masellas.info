// Env-only configuration with a tiny .env parser (no dotenv dependency).
import path from 'node:path';
import { someWordsPaths } from './publish.js';
import { glossaryPath } from './glossary.js';

export function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.startsWith('#')) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

export function loadConfig(env) {
  const required = ['DATA_FILE', 'PUBLIC_FILE', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`missing required env vars: ${missing.join(', ')}`);
  if (!path.isAbsolute(env.DATA_FILE)) throw new Error('DATA_FILE must be an absolute path');
  if (!path.isAbsolute(env.PUBLIC_FILE)) throw new Error('PUBLIC_FILE must be an absolute path');
  if (path.resolve(env.PUBLIC_FILE) === path.resolve(env.DATA_FILE)) throw new Error('PUBLIC_FILE must differ from DATA_FILE');
  if (!/^[0-9a-f]{64,}$/i.test(env.SESSION_SECRET)) {
    throw new Error('SESSION_SECRET must be at least 32 random bytes as hex (64+ hex chars)');
  }
  // Optional overrides; by default the "some words" files sit next to the projects files.
  for (const key of ['SOME_WORDS_FILE', 'SOME_WORDS_PUBLIC_FILE']) {
    if (env[key] && !path.isAbsolute(env[key])) throw new Error(`${key} must be an absolute path`);
  }
  const cookiePath = env.COOKIE_PATH || '/';
  const derived = someWordsPaths({ dataFile: env.DATA_FILE, publicFile: env.PUBLIC_FILE });
  if (!/^\/[A-Za-z0-9/_-]*$/.test(cookiePath)) throw new Error('COOKIE_PATH must be a plain path starting with /');
  return {
    port: Number(env.PORT || 8787),
    host: env.HOST || '127.0.0.1',
    dataFile: env.DATA_FILE,
    publicFile: env.PUBLIC_FILE,
    someWordsFile: env.SOME_WORDS_FILE || derived.someWordsFile,
    someWordsPublicFile: env.SOME_WORDS_PUBLIC_FILE || derived.someWordsPublicFile,
    glossaryFile: glossaryPath(env.DATA_FILE), // next to DATA_FILE, no variable needed
    passwordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: env.COOKIE_SECURE !== 'false',
    cookiePath,
    trustProxy: env.TRUST_PROXY === 'true',
    publicUrl: env.PUBLIC_URL || 'https://masellas.info/projects/',
  };
}
