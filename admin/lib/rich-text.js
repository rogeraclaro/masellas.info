// Minimal rich text for the home's "some words": paragraphs, line breaks and [label](url) links.
// Pure (no DOM, no Node APIs): the admin validates with it and the front bundles it to render.
//   blank line        -> new paragraph
//   single newline    -> line break
//   [label](url)      -> link; url must be a full http:, https: or mailto: URL
// Anything that looks like a link but is not valid is reported, never rendered as a link.

export const RICH_TEXT_MAX = 4000;
const SCHEMES = new Set(['http:', 'https:', 'mailto:']);
// [label](href): label without brackets/newlines; href without spaces, allowing one level of
// balanced parentheses (e.g. Wikipedia URLs).
const LINK = /^\[([^[\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/;

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

function parseLine(line, errors) {
  const parts = [];
  let buffer = '';
  const flush = () => {
    if (buffer) parts.push({ type: 'text', value: buffer });
    buffer = '';
  };
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === ']') {
      errors.push(`unmatched "]" near "${snippet(line, Math.max(0, i - 20))}": square brackets are only for links, written [text](https://…)`);
      buffer += char;
      continue;
    }
    if (char !== '[') {
      buffer += char;
      continue;
    }
    const match = LINK.exec(line.slice(i));
    if (!match) {
      errors.push(`malformed link "${snippet(line, i)}": write links as [text](https://…) or [text](mailto:…), without nested brackets or spaces in the url`);
      // Keep the bracketed part as text and skip its own "]" so one mistake gives one error.
      const close = line.indexOf(']', i + 1);
      const end = close !== -1 && !line.slice(i + 1, close).includes('[') ? close : i;
      buffer += line.slice(i, end + 1);
      i = end;
      continue;
    }
    const [whole, label, href] = match;
    const problem = !label.trim() ? 'has empty text' : checkHref(href);
    if (problem) {
      errors.push(`link "${whole}" ${problem}`);
      buffer += whole;
    } else {
      flush();
      parts.push({ type: 'link', label, href });
    }
    i += whole.length - 1;
  }
  flush();
  return parts;
}

// Returns { blocks: [{ type: 'p', parts: [...] }], errors: [string] }.
export function parseRichText(input) {
  const errors = [];
  const blocks = String(input)
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean)
    .map((paragraph) => {
      const parts = [];
      paragraph.split('\n').forEach((line, index) => {
        if (index) parts.push({ type: 'br' });
        parts.push(...parseLine(line, errors));
      });
      return { type: 'p', parts };
    });
  return { blocks, errors };
}
