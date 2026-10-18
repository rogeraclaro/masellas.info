// Machine translation of ca texts into en and es for the admin's "translate from ca" button.
// The engines are Softcatalà's public (undocumented, keyless) endpoints, the ones behind
// https://www.softcatala.org/traductor/. To use another engine, change ENGINES / callEngine: the rest
// (markup protection, warnings, the API in server.js and the UI) does not depend on it.
//
// Rich text (lib/rich-text.js) is protected before sending and restored after:
//   - atoms (sent as XQ<n>X, kept verbatim): {{term}} / {{term|explanation}}, `code`, backslash
//     escapes, and the line prefixes "## ", "- ", "> ";
//   - spans (sent as "[XQ<n>X text]", the text is translated): **bold**, ~~strikethrough~~ and
//     [label](url) (the label is translated, the url is kept).
// Both engines leave XQ<n>X and square brackets alone (checked against the live APIs) and the
// brackets keep a styled phrase together when the neural engine reorders words; the source never
// has bare square brackets (only in links, which are protected, or escaped). Whatever the engine
// breaks is reported as warnings, with the parser's own errors, instead of failing.
import { parseRichText } from './rich-text.js';

export const ENGINES = {
  // Neural (no ca -> es model there).
  en: { url: 'https://api.softcatala.org/v2/nmt/translate/', params: { langpair: 'cat|eng' } },
  // Rule-based (Apertium): literal but reliable. markUnknown=no leaves unknown words as they are.
  es: { url: 'https://api.softcatala.org/traductor/v1/translate', params: { langpair: 'cat|spa', markUnknown: 'no' } },
};
export const TARGETS = Object.keys(ENGINES);
export const TIMEOUT_MS = 20_000;

export class TranslateError extends Error {}

const ESCAPABLE = new Set(['*', '~', '\\', '`', '[', ']', '(', ')', '>', '-', '#', '{', '}']);
const MARKS = [['**', 'bold'], ['~~', 'strikethrough']];
const LINK = /^\[((?:\\.|[^[\]\\\n])*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/; // as in rich-text.js
const PREFIX = /^(## |- |> )/;
const token = (n) => `XQ${n}X`;

// Index of the `mark` closing a span opened before `from`, skipping escapes, code, terms and links
// (where the parser does not look for it); -1 if none.
function findClose(src, from, mark) {
  let i = from;
  while (i < src.length) {
    if (src.startsWith(mark, i)) return i;
    if (src[i] === '\\' && ESCAPABLE.has(src[i + 1])) i += 2;
    else if (src[i] === '`' && src.indexOf('`', i + 1) > i + 1) i = src.indexOf('`', i + 1) + 1;
    else if (src.startsWith('{{', i) && src.indexOf('}}', i + 2) !== -1) i = src.indexOf('}}', i + 2) + 2;
    else if (src[i] === '[' && LINK.test(src.slice(i))) i += LINK.exec(src.slice(i))[0].length;
    else i += 1;
  }
  return -1;
}

// Returns { text, tokens }: tokens[n] is { kind: 'atom', value } or { kind: 'span', name, open, close }.
export function protect(source) {
  const tokens = [];
  const atom = (value) => token(tokens.push({ kind: 'atom', value }) - 1);
  const span = (name, open, close) => token(tokens.push({ kind: 'span', name, open, close }) - 1);

  // One line, following the parser's rules (a mark already open is plain text inside, so it is kept as an atom).
  function line(src, open = []) {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const char = src[i];
      if (char === '\\' && ESCAPABLE.has(src[i + 1])) {
        out += atom(src.slice(i, i + 2));
        i += 2;
      } else if (char === '`') {
        const end = src.indexOf('`', i + 1);
        const stop = end > i + 1 ? end + 1 : i + 1;
        out += atom(src.slice(i, stop));
        i = stop;
      } else if (src.startsWith('{{', i) && src.indexOf('}}', i + 2) !== -1) {
        const end = src.indexOf('}}', i + 2) + 2;
        out += atom(src.slice(i, end));
        i = end;
      } else if (MARKS.some(([mark]) => src.startsWith(mark, i))) {
        const [mark, name] = MARKS.find(([m]) => src.startsWith(m, i));
        const close = open.includes(mark) ? -1 : findClose(src, i + 2, mark);
        if (close === -1) {
          out += atom(mark);
          i += 2;
        } else {
          out += `[${span(name, mark, mark)} ${line(src.slice(i + 2, close), [...open, mark])}]`;
          i = close + 2;
        }
      } else if (char === '[' && LINK.test(src.slice(i))) {
        const [whole, label, href] = LINK.exec(src.slice(i));
        out += `[${span('link', '[', `](${href})`)} ${line(label, open)}]`;
        i += whole.length;
      } else if (char === '[' || char === ']') {
        out += atom(char);
        i += 1;
      } else {
        out += char;
        i += 1;
      }
    }
    return out;
  }

  const text = String(source).replace(/\r\n?/g, '\n').split('\n').map((src) => {
    const prefix = PREFIX.exec(src);
    return prefix ? `${atom(prefix[1])} ${line(src.slice(prefix[1].length))}` : line(src);
  }).join('\n');
  return { text, tokens };
}

const quote = (value) => `"${value.trim()}"`;

// Puts the protected markup back into a translation. Returns { text, warnings }.
export function restore(translated, tokens) {
  const warnings = [];
  const used = new Set();
  const stack = []; // open spans on the current line: token numbers
  let out = '';
  const OPEN = /\[\s*XQ(\d+)X\s*/iy;
  const ATOM = /XQ(\d+)X/iy;
  const closeLine = () => {
    for (const n of stack.splice(0)) warnings.push(`check the ${tokens[n].name}: its end was lost.`);
  };
  let i = 0;
  while (i < translated.length) {
    const char = translated[i];
    OPEN.lastIndex = i;
    ATOM.lastIndex = i;
    let match;
    if (char === '[' && (match = OPEN.exec(translated)) && tokens[match[1]]?.kind === 'span' && !used.has(Number(match[1]))) {
      const n = Number(match[1]);
      used.add(n);
      stack.push(n);
      out += tokens[n].open;
      i = OPEN.lastIndex;
    } else if (char === ']' && stack.length) {
      out = out.replace(/[ \t]+$/, '') + tokens[stack.pop()].close;
      i += 1;
    } else if ((match = ATOM.exec(translated)) && tokens[match[1]]) {
      const n = Number(match[1]);
      const item = tokens[n];
      i = ATOM.lastIndex;
      if (item.kind === 'atom' && !used.has(n)) {
        used.add(n);
        out += item.value;
        // A line prefix carries its own space.
        if (PREFIX.test(item.value) && translated[i] === ' ') i += 1;
      }
    } else {
      if (char === '\n') closeLine();
      out += char;
      i += 1;
    }
  }
  closeLine();
  tokens.forEach((item, n) => {
    if (used.has(n)) return;
    warnings.push(item.kind === 'span' ? `check the ${item.name}: it was lost.` : `${quote(item.value)} was lost: add it back.`);
  });
  for (const error of parseRichText(out).errors) warnings.push(`would not save like this: ${error}`);
  return { text: out, warnings: [...new Set(warnings)] };
}

async function callEngine(text, target, { fetch, timeoutMs }) {
  const engine = ENGINES[target];
  // A plain timer, cleared on every path (AbortSignal.timeout's is unref'd, which hides hung calls in tests).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  let res;
  try {
    res = await fetch(engine.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ ...engine.params, q: text }).toString(),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new TranslateError(`the translator did not answer in time (${Math.round(timeoutMs / 1000)} s)`);
    }
    throw new TranslateError('could not reach the translator');
  }
  if (!res.ok) {
    clearTimeout(timer);
    throw new TranslateError(`the translator answered HTTP ${res.status}`);
  }
  // The body read is covered by the same timeout.
  const json = await res.json().catch(() => null).finally(() => clearTimeout(timer));
  const translated = json?.responseData?.translatedText;
  if (json?.responseStatus !== 200 || typeof translated !== 'string') throw new TranslateError('unexpected answer from the translator');
  return translated;
}

// text: ca. target: 'en' | 'es'. kind: 'rich' (lib/rich-text.js format) or 'plain'.
// max: the field's length limit (a longer translation is returned with a warning). Returns { text, warnings }.
export async function translateText(text, target, { kind = 'plain', max = null, fetch = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  if (!Object.hasOwn(ENGINES, target)) throw new TranslateError(`unknown target language: ${target}`);
  let result;
  if (kind === 'rich') {
    const { text: protectedText, tokens } = protect(text);
    const restored = restore(await callEngine(protectedText, target, { fetch, timeoutMs }), tokens);
    result = { text: restored.text.trim(), warnings: restored.warnings };
  } else {
    result = { text: (await callEngine(text, target, { fetch, timeoutMs })).trim(), warnings: [] };
  }
  if (max && result.text.length > max) {
    result.warnings.push(`the translation has ${result.text.length} characters; this field allows ${max}. shorten it before saving.`);
  }
  return result;
}

// Every target in parallel: { en: { text, warnings } | { error }, es: … }. One failure keeps the others.
export async function translateAll(text, options = {}) {
  const settled = await Promise.allSettled(TARGETS.map((target) => translateText(text, target, options)));
  return Object.fromEntries(TARGETS.map((target, i) => {
    const { status, value, reason } = settled[i];
    if (status === 'fulfilled') return [target, value];
    if (!(reason instanceof TranslateError)) console.error(`admin: translate ${target}: ${reason?.stack ?? reason}`);
    return [target, { error: reason instanceof TranslateError ? reason.message : 'translation failed' }];
  }));
}
