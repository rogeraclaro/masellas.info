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
