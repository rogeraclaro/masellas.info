// Site languages and the per-language data shape. Pure, no I/O.
// Per-language values are stored as { ca, en, es }; ca is the principal language and the
// fallback for an empty en / es. Older data has plain strings: they are read as a copy in
// every language and stored that way on the next write.
import path from 'node:path';

export const LANGS = ['ca', 'en', 'es'];
export const DEFAULT_LANG = LANGS[0];

// Project fields that are translated; everything else is shared by every language.
export const LOCALIZED_FIELDS = ['category', 'description', 'ai'];

export function localize(value) {
  if (typeof value === 'string') return Object.fromEntries(LANGS.map((lang) => [lang, value]));
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(LANGS.map((lang) => [lang, typeof source[lang] === 'string' ? source[lang] : '']));
}

// The text for one language, or ca's when that one is empty.
export function pick(value, lang) {
  const text = localize(value);
  return text[lang] && text[lang].trim() ? text[lang] : text[DEFAULT_LANG];
}

// Never fails: whatever is missing or malformed becomes empty text.
export function migrateProjects(data) {
  const projects = Array.isArray(data && data.projects) ? data.projects : [];
  return {
    ...data,
    projects: projects.map((project) => {
      const next = { ...project };
      for (const field of LOCALIZED_FIELDS) next[field] = localize(project[field]);
      return next;
    }),
  };
}

export function migrateSomeWords(data) {
  return { ...data, text: localize(data && data.text) };
}

// /web/projects/data/projects.json + en -> /web/projects/data/projects.en.json
export function localizedFile(file, lang) {
  const { dir, name, ext } = path.parse(file);
  return path.join(dir, `${name}.${lang}${ext}`);
}
