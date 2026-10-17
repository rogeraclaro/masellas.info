// Minimal rich text for the home's "some words" and the projects' "how I used AI".
// Pure (no DOM, no Node APIs): the admin validates with it, the admin preview, the home and the
// project detail render it (rich-text-dom.js), and scripts/build-pages.mjs renders the static fallback.
//
// Blocks (separated by blank lines):
//   paragraph         single newline -> line break
//   ## text           subheading (a block of one line)
//   - item            list (every line of the block starts with "- ")
//   > text            quote (every line starts with "> "; lines joined with line breaks)
// Inline (within one line):
//   **bold**  ~~strikethrough~~  `code` (literal)  [label](url) with an http:, https: or mailto: URL
//   bold / strikethrough may contain each other, links and code; a link label may contain bold,
//   strikethrough and code.
//   {{term}} (explained by the glossary) and {{term|explanation}} (its own explanation): plain text,
//   allowed inside bold / strikethrough, not inside a link label (and literal inside code).
//   A backslash before * ~ \ ` [ ] ( ) > - # { } makes it literal.
// Anything malformed is reported (and kept as text so a preview can still show it).
//
// AST: blocks  { type: 'p' | 'h' | 'quote', parts } | { type: 'ul', items: [parts] }
//      parts   { type: 'text', value } | { type: 'br' } | { type: 'code', value }
//              | { type: 'strong' | 's', parts } | { type: 'link', href, parts }
//              | { type: 'term', label, explanation | null, key }   (key: termKey(label), for the glossary)

export const RICH_TEXT_MAX = 4000;
export const TERM_MAX = 60;
export const EXPLANATION_MAX = 300;
const SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const ESCAPABLE = new Set(['*', '~', '\\', '`', '[', ']', '(', ')', '>', '-', '#', '{', '}']);
const MARKS = [['**', 'strong', 'bold'], ['~~', 's', 'strikethrough']];
// [label](href): the label may hold escaped characters but no bare brackets or newlines; the href
// has no spaces and allows one level of balanced parentheses (e.g. Wikipedia URLs).
const LINK = /^\[((?:\\.|[^[\]\\\n])*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/;

const snippet = (text, at) => text.slice(at, at + 48).split('\n')[0];

function checkHref(href) {
  if (!href) return 'has an empty url';
  let url;
  try {
    url = new URL(href);
  } catch {
    return 'is not a valid full url (start with https:// or mailto:)';
  }
  if (!SCHEMES.has(url.protocol)) return 'is not allowed: only http:, https: and mailto: links';
  if (url.protocol === 'mailto:' && !url.pathname) return 'needs an email address after mailto:';
  if (url.protocol !== 'mailto:' && !url.hostname) return 'is not a valid full url (start with https:// or mailto:)';
  return null;
}

const plainText = (parts) => parts.map((part) => part.value ?? part.label ?? (part.parts ? plainText(part.parts) : '')).join('');

// Glossary key of a term: trimmed, lowercase.
export const termKey = (label) => String(label).trim().toLowerCase();

// "{{" at `at` in a line: { end, whole, label, explanation } (end: index after "}}"), or null if unclosed.
function readTerm(src, at) {
  const close = src.indexOf('}}', at + 2);
  if (close === -1) return null;
  const inner = src.slice(at + 2, close);
  const bar = inner.indexOf('|');
  return {
    end: close + 2,
    whole: src.slice(at, close + 2),
    inner,
    label: (bar === -1 ? inner : inner.slice(0, bar)).trim(),
    explanation: bar === -1 ? null : inner.slice(bar + 1).trim(),
  };
}

function termProblem({ label, explanation }) {
  if (!label) return 'has an empty term';
  if (label.length > TERM_MAX) return `has a term longer than ${TERM_MAX} characters`;
  if (explanation !== null && !explanation) return 'has an empty explanation (write {{term}} to use the glossary one)';
  if (explanation !== null && explanation.length > EXPLANATION_MAX) return `has an explanation longer than ${EXPLANATION_MAX} characters`;
  return null;
}

// Parses src from `start` until the `close` mark (or the end). Marks already open (`open`) are
// plain text inside, so bold-in-bold can never nest. Returns { parts, end, closed }.
function parseSpan(src, start, errors, { close = null, open = [], inLink = false } = {}) {
  const parts = [];
  let buffer = '';
  const flush = () => {
    if (buffer) parts.push({ type: 'text', value: buffer });
    buffer = '';
  };
  let i = start;
  while (i < src.length) {
    if (close && src.startsWith(close, i)) {
      flush();
      return { parts, end: i + close.length, closed: true };
    }
    const char = src[i];
    if (char === '\\' && ESCAPABLE.has(src[i + 1])) {
      buffer += src[i + 1];
      i += 2;
      continue;
    }
    if (char === '`') {
      const end = src.indexOf('`', i + 1);
      if (end === -1) {
        errors.push(`unclosed "\`" near "${snippet(src, i)}": close code with another \` (write \\\` for a literal one)`);
      } else if (end > i + 1) {
        flush();
        parts.push({ type: 'code', value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
      buffer += char;
      i += 1;
      continue;
    }
    if (src.startsWith('{{', i)) {
      const found = readTerm(src, i);
      if (!found) {
        errors.push(`unclosed "{{" near "${snippet(src, i)}": close a term with }} (write \\{ for a literal {)`);
        buffer += '{{';
        i += 2;
        continue;
      }
      const problem = inLink ? 'cannot be inside a link label: put it next to the link' : termProblem(found);
      if (problem) {
        errors.push(`term "${found.whole}" ${problem}`);
        buffer += found.whole;
      } else {
        flush();
        parts.push({ type: 'term', label: found.label, explanation: found.explanation, key: termKey(found.label) });
      }
      i = found.end;
      continue;
    }
    const mark = MARKS.find(([token]) => src.startsWith(token, i));
    if (mark && !open.includes(mark[0])) {
      const [token, type, name] = mark;
      const inner = [];
      const span = parseSpan(src, i + token.length, inner, { close: token, open: [...open, token], inLink });
      if (span.closed) {
        errors.push(...inner);
        flush();
        parts.push({ type, parts: span.parts });
        i = span.end;
      } else {
        // Report it once, keep the mark as text and read on from just after it.
        errors.push(`unclosed "${token}" near "${snippet(src, i)}": close ${name} with ${token} on the same line (write \\${token[0]} for a literal ${token[0]})`);
        buffer += token;
        i += token.length;
      }
      continue;
    }
    if (char === ']') {
      errors.push(`unmatched "]" near "${snippet(src, Math.max(0, i - 20))}": square brackets are only for links, written [text](https://…) (write \\] for a literal one)`);
      buffer += char;
      i += 1;
      continue;
    }
    if (char !== '[') {
      buffer += char;
      i += 1;
      continue;
    }
    const match = inLink ? null : LINK.exec(src.slice(i));
    if (!match) {
      errors.push(`malformed link "${snippet(src, i)}": write links as [text](https://…) or [text](mailto:…), without nested brackets or spaces in the url`);
      // Keep the bracketed part as text and skip its own "]" so one mistake gives one error.
      const closeAt = src.indexOf(']', i + 1);
      const end = closeAt !== -1 && !src.slice(i + 1, closeAt).includes('[') ? closeAt : i;
      buffer += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const [whole, label, href] = match;
    const labelErrors = [];
    const labelParts = parseSpan(label, 0, labelErrors, { open, inLink: true }).parts;
    const problem = !plainText(labelParts).trim() ? 'has empty text' : checkHref(href);
    if (problem) {
      errors.push(`link "${whole}" ${problem}`);
      buffer += whole;
    } else {
      errors.push(...labelErrors);
      flush();
      parts.push({ type: 'link', href, parts: labelParts });
    }
    i += whole.length;
  }
  flush();
  return { parts, end: i, closed: false };
}

const parseLine = (line, errors) => parseSpan(line, 0, errors).parts;

// Lines joined with line breaks.
function parseLines(lines, errors) {
  const parts = [];
  lines.forEach((line, index) => {
    if (index) parts.push({ type: 'br' });
    parts.push(...parseLine(line, errors));
  });
  return parts;
}

function parseBlock(block, errors) {
  const lines = block.split('\n');
  if (lines.length === 1 && lines[0].startsWith('## ')) return { type: 'h', parts: parseLine(lines[0].slice(3), errors) };
  const listLines = lines.filter((line) => line.startsWith('- ')).length;
  if (listLines === lines.length) return { type: 'ul', items: lines.map((line) => parseLine(line.slice(2), errors)) };
  if (listLines) {
    errors.push(`list mixed with other lines near "${snippet(block, 0)}": in a list every line starts with "- ". Put a blank line between the text and the list, or write \\- to start a line with a dash`);
  }
  if (lines.every((line) => line.startsWith('> '))) return { type: 'quote', parts: parseLines(lines.map((line) => line.slice(2)), errors) };
  return { type: 'p', parts: parseLines(lines, errors) };
}

// Returns { blocks, errors: [string] }.
export function parseRichText(input) {
  const errors = [];
  const blocks = String(input)
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((block) => block.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean)
    .map((block) => parseBlock(block, errors));
  return { blocks, errors };
}

// Publishing: every {{term}} without its own explanation becomes {{term|<lookup(key)>}} (unknown
// keys stay as they are). Follows the parser's rules, so code spans and escaped braces are untouched.
export function resolveTerms(text, lookup) {
  return String(text).split('\n').map((line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      if (char === '\\' && ESCAPABLE.has(line[i + 1])) {
        out += line.slice(i, i + 2);
        i += 2;
      } else if (char === '`' && line.indexOf('`', i + 1) > i + 1) {
        const end = line.indexOf('`', i + 1) + 1;
        out += line.slice(i, end);
        i = end;
      } else if (line.startsWith('{{', i) && readTerm(line, i)) {
        const found = readTerm(line, i);
        const explanation = found.explanation === null && found.label ? lookup(termKey(found.label)) : null;
        out += explanation ? `{{${found.inner}|${explanation}}}` : found.whole;
        i = found.end;
      } else {
        out += char;
        i += 1;
      }
    }
    return out;
  }).join('\n');
}
