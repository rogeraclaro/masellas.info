// UI strings for the page language. scripts/build-pages.mjs injects them from i18n/<lang>.json
// into <script type="application/json" id="i18n">; the build fails if a language misses one.

// Pure: "next project: {title}" + { title } -> "next project: Ledger". Unknown names stay visible.
export function format(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

export const pageLang = () => document.documentElement.lang || 'ca';

export function loadStrings() {
  const node = document.getElementById('i18n');
  let strings = {};
  try {
    strings = node ? JSON.parse(node.textContent) : {};
  } catch {
    strings = {};
  }
  const plural = new Intl.PluralRules(pageLang());
  // A missing key shows its own name: visible in review, never a crash.
  const t = (key, params) => format(Object.hasOwn(strings, key) ? strings[key] : key, params);
  // Count keys come in pairs: <key>_one / <key>_other.
  t.count = (key, n) => t(`${key}_${plural.select(n) === 'one' ? 'one' : 'other'}`, { n });
  return t;
}
