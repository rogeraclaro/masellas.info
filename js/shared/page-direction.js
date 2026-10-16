// Pure helpers for cross-page view transitions. Each page declares its place on a
// horizontal axis (<html data-page-x="…">); the incoming page slides in from its side.

const HANDOFF_MAX_AGE = 60_000; // ms; older handoffs belong to some other navigation

function position(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

// 'slide-from-left' when the new page sits left of the old one, 'slide-from-right' when
// it sits to the right, null when the positions are equal or unknown.
export function transitionType(fromX, toX) {
  const from = position(fromX);
  const to = position(toX);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return null;
  return to < from ? 'slide-from-left' : 'slide-from-right';
}

// The old page stores {x, at} on pageswap; the new page reads it on pagereveal.
export function readHandoff(raw, now, maxAge = HANDOFF_MAX_AGE) {
  try {
    const { x, at } = JSON.parse(raw);
    if (x == null || typeof at !== 'number' || at > now || now - at > maxAge) return null;
    return x;
  } catch {
    return null;
  }
}
