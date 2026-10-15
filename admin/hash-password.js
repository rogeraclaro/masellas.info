// Prints a scrypt hash for ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password            (prompts; input is not echoed)
//        npm run hash-password -- <pass>  (non-interactive; ends up in shell history)
import { createInterface } from 'node:readline';
import { hashPassword } from './lib/auth.js';

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); }; // hide typed chars
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write('\n');
  return answer;
}

const password = process.argv[2] ?? await prompt('password: ');
if (password.length < 8) {
  console.error('use at least 8 characters.');
  process.exit(1);
}
console.log(hashPassword(password));
