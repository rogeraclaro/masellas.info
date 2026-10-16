// Pure validation helpers for project records and the home's "some words". No I/O.
import { parseRichText, RICH_TEXT_MAX } from './rich-text.js';
import { LANGS, DEFAULT_LANG } from './languages.js';

const FIELDS = ['title', 'category', 'year', 'description', 'url', 'visible', 'thumbs', 'ai', 'tools'];
const REQUIRED = ['title', 'category', 'year', 'url'];
const emptyText = () => Object.fromEntries(LANGS.map((lang) => [lang, '']));
const DEFAULTS = { description: emptyText(), visible: true, thumbs: [], ai: emptyText(), tools: [] };

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function text(value, { min, max, label, lower = false }) {
  if (typeof value !== 'string') return { error: `${label} must be text` };
  let clean = value.trim();
  if (lower) clean = clean.toLowerCase();
  if (clean.length < min) return { error: `${label} is required` };
  if (clean.length > max) return { error: `${label} must be ${max} characters or fewer` };
  return { value: clean };
}

// A per-language value: { ca, en, es }, all three as text. Each language gets the field's
// rules; only ca has to meet `min` (an empty en / es falls back to ca on the site).
// Returns { value } or { errors } keyed "<field>.<lang>" (or "<field>" for the shape).
function perLanguage(v, field, check, { min = 0, label = field } = {}) {
  const isObject = v !== null && typeof v === 'object' && !Array.isArray(v);
  const keys = isObject ? Object.keys(v) : [];
  if (!isObject || keys.length !== LANGS.length || !LANGS.every((lang) => keys.includes(lang))) {
    return { errors: { [field]: `${label} needs ca, en and es text` } };
  }
  const value = {};
  const errors = {};
  for (const lang of LANGS) {
    const result = check(v[lang], { min: lang === DEFAULT_LANG ? min : 0, label: `${label} (${lang})` });
    if (result.error) errors[`${field}.${lang}`] = result.error;
    else value[lang] = result.value;
  }
  return Object.keys(errors).length ? { errors } : { value };
}

const CHECKS = {
  title: (v) => text(v, { min: 1, max: 80, label: 'title' }),
  category: (v) => perLanguage(v, 'category', (item, opts) => text(item, { ...opts, max: 30, lower: true }), { min: 1 }),
  description: (v) => perLanguage(v, 'description', (item, opts) => text(item, { ...opts, max: 200 })),
  // Free text, e.g. "(orig. 2015) 2026". Whole numbers from older data become text.
  year: (v) => text(Number.isInteger(v) ? String(v) : v, { min: 1, max: 30, label: 'year' }),
  url: (v) => (isHttpUrl(v) ? { value: v.trim() } : { error: 'url must start with http:// or https://' }),
  visible: (v) => (typeof v === 'boolean' ? { value: v } : { error: 'visible must be true or false' }),
  thumbs: (v) => {
    if (!Array.isArray(v)) return { error: 'thumbs must be a list of urls' };
    if (v.length > 3) return { error: 'up to 3 thumbs' };
    if (!v.every(isHttpUrl)) return { error: 'each thumb must be an http:// or https:// url' };
    return { value: v.map((url) => url.trim()) };
  },
  // Same rich-text format as "some words" (lib/rich-text.js); the project detail renders it.
  ai: (v) => perLanguage(v, 'ai', (item, opts) => richText(item, { ...opts, max: 5000 }), { label: 'how I used AI' }),
  tools: (v) => {
    if (!Array.isArray(v)) return { error: 'tools must be a list' };
    if (v.length > 12) return { error: 'up to 12 tools' };
    const clean = [];
    for (const item of v) {
      const check = text(item, { min: 1, max: 30, label: 'each tool' });
      if (check.error) return check;
      if (clean.some((tool) => tool.toLowerCase() === check.value.toLowerCase())) return { error: `"${check.value}" is listed twice` };
      clean.push(check.value);
    }
    return { value: clean };
  },
};

// Returns { value, errors }. errors is {} when valid; keys are field names
// (or _body / _unknown for structural problems).
export function validateProject(input, { partial = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { value: {}, errors: { _body: 'expected a JSON object' } };
  }
  const errors = {};
  const value = {};
  const unknown = Object.keys(input).filter((key) => !FIELDS.includes(key));
  if (unknown.length) errors._unknown = `unknown fields: ${unknown.join(', ')}`;

  for (const field of FIELDS) {
    if (!(field in input)) {
      if (partial) continue;
      if (REQUIRED.includes(field)) errors[field] = `${field} is required`;
      else value[field] = structuredClone(DEFAULTS[field]);
      continue;
    }
    const check = CHECKS[field](input[field]);
    if (check.error) errors[field] = check.error;
    else if (check.errors) Object.assign(errors, check.errors);
    else value[field] = check.value;
  }
  return { value, errors };
}

export function slugify(title) {
  const slug = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug || 'project';
}

export function uniqueSlug(title, existingIds) {
  const base = slugify(title);
  const taken = new Set(existingIds);
  let candidate = base;
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}-${n}`;
  return candidate;
}

export function isPermutation(ids, currentIds) {
  if (!Array.isArray(ids) || ids.length !== currentIds.length) return false;
  if (!ids.every((id) => typeof id === 'string')) return false;
  const set = new Set(ids);
  return set.size === ids.length && currentIds.every((id) => set.has(id));
}

// Rich text (lib/rich-text.js): length after trimming, then the parser's errors (links, styles, lists).
function richText(v, { max = RICH_TEXT_MAX, ...opts }) {
  const check = text(v, { ...opts, max });
  if (check.error) return check;
  const { errors } = parseRichText(check.value);
  return errors.length ? { error: `${opts.label}: ${errors.join(' ')}` } : check;
}

// "some words": { text: { ca, en, es } } only; ca is required (1-4000), en / es may be empty.
export function validateSomeWords(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { value: {}, errors: { _body: 'expected a JSON object' } };
  }
  const errors = {};
  const unknown = Object.keys(input).filter((key) => key !== 'text');
  if (unknown.length) errors._unknown = `unknown fields: ${unknown.join(', ')}`;
  const check = perLanguage(input.text, 'text', richText, { min: 1 });
  if (check.errors) Object.assign(errors, check.errors);
  return { value: check.errors ? {} : { text: check.value }, errors };
}
