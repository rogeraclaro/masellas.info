// Pure validation helpers for project records. No I/O.

const FIELDS = ['title', 'category', 'year', 'description', 'url', 'visible', 'thumbs'];
const REQUIRED = ['title', 'category', 'year', 'url'];
const DEFAULTS = { description: '', visible: true, thumbs: [] };

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

const CHECKS = {
  title: (v) => text(v, { min: 1, max: 80, label: 'title' }),
  category: (v) => text(v, { min: 1, max: 30, label: 'category', lower: true }),
  description: (v) => text(v, { min: 0, max: 200, label: 'description' }),
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
