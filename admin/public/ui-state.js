// Small pure helpers for the admin UI state (tested in test/ui-state.test.js).

// "formatting help": open only if the user left it open last time (stored 'open'); closed by default.
export const helpOpen = (stored) => stored === 'open';

// Same JSON whatever the key order, so two copies of the same form values compare equal.
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

// True when the form values differ from what was last loaded or saved (null: nothing saved yet).
export function hasChanges(saved, current) {
  if (saved == null) return true;
  return JSON.stringify(stable(saved)) !== JSON.stringify(stable(current));
}

/* ---------- Translation status (projects list and the ca / en / es tabs) ---------- */

// Texts this short are often the same in every language ("web app", "landing"), so only longer
// ones count as copied over untranslated.
const SAME_MIN = 20;

// True when `text` is a copy of the ca text, i.e. it was never translated. Empty is not "same".
export function untranslated(ca, text) {
  const source = String(ca ?? '').trim();
  return source.length >= SAME_MIN && String(text ?? '').trim() === source;
}

// What each language still needs: [{ lang, field, kind: 'empty' | 'same' }], in field order.
// Only fields with ca text count; an empty en / es shows the ca text on the site.
export function translationGaps(project, { fields = ['category', 'description', 'ai'], langs = ['en', 'es'] } = {}) {
  const gaps = [];
  for (const lang of langs) {
    for (const field of fields) {
      const value = project?.[field];
      const ca = String(value?.ca ?? '').trim();
      if (!ca) continue;
      const text = String(value?.[lang] ?? '').trim();
      if (!text) gaps.push({ lang, field, kind: 'empty' });
      else if (untranslated(ca, text)) gaps.push({ lang, field, kind: 'same' });
    }
  }
  return gaps;
}
