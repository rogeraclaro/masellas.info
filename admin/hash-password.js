// Creates an ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password                     prompts; prints the hash
//        npm run hash-password -- <pass>           non-interactive; ends up in shell history
//        node hash-password.js --env <file>        prompts twice; writes the hash (and a SESSION_SECRET
//                                                  if the file has none) into <file>, mode 0600; prints nothing secret
import { createInterface } from 'node:readline';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './lib/auth.js';
import { updateEnvText } from './lib/envfile.js';
import { parseEnv } from './lib/config.js';

// Reads one line per question; typed characters are not echoed. Works for a TTY and for piped input.
async function prompt(questions) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = () => {}; // hide typed chars (questions are written directly below)
  const lines = rl[Symbol.asyncIterator]();
  const answers = [];
  for (const question of questions) {
    process.stdout.write(question);
    const { value } = await lines.next();
    process.stdout.write('\n');
    answers.push(value ?? '');
  }
  rl.close();
  return answers;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');

if (envIndex === -1) {
  const password = args[0] ?? (await prompt(['password: ']))[0];
  if (password.length < 8) fail('use at least 8 characters.');
  console.log(hashPassword(password));
} else {
  const file = args[envIndex + 1];
  if (!file) fail('usage: node hash-password.js --env <file>');
  const [password, again] = await prompt(['new password: ', 'repeat password: ']);
  if (password !== again) fail('the passwords do not match. nothing was written.');
  if (password.length < 8) fail('use at least 8 characters. nothing was written.');
  const before = existsSync(file) ? await readFile(file, 'utf8') : '';
  const text = updateEnvText(before, { passwordHash: hashPassword(password), newSecret: randomBytes(32).toString('hex') });
  await writeFile(file, text, { mode: 0o600 });
  await chmod(file, 0o600);
  console.log(`updated ${file}: password hash${parseEnv(before).SESSION_SECRET ? '' : ' and a new session secret'}.`);
}
