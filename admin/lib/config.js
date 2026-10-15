// Env-only configuration with a tiny .env parser (no dotenv dependency).
import path from 'node:path';

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
  return {
    port: Number(env.PORT || 8787),
    host: env.HOST || '127.0.0.1',
    dataFile: env.DATA_FILE,
    publicFile: env.PUBLIC_FILE,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: env.COOKIE_SECURE !== 'false',
    publicUrl: env.PUBLIC_URL || 'https://masellas.info/projects/',
  };
}
