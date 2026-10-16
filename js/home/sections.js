// Pure navigation logic for the home's full-screen sections. No DOM.

export function wrapIndex(index, count) {
  return ((index % count) + count) % count;
}

// One step down (+1) or up (-1). The direction follows the gesture, also across the wrap,
// so going down from the last section still slides the first one in from below.
export function step(current, delta, count) {
  return { index: wrapIndex(current + delta, count), direction: delta > 0 ? 'down' : 'up' };
}

// Direct jump (menu, Home/End, hash). null when already there.
export function jump(current, target) {
  if (target === current) return null;
  return { index: target, direction: target > current ? 'down' : 'up' };
}

export function indexFromHash(hash, anchors) {
  return anchors.indexOf(String(hash).replace(/^#/, ''));
}

// Wheel and touch fire many events per gesture (trackpads keep firing during inertia).
// A gesture is a run of events with no pause longer than `gap` ms; only its first event counts.
export function createGestureGate(gap = 200) {
  let last = -Infinity;
  let used = false;
  return {
    accept(now) {
      if (now - last > gap) used = false;
      last = now;
      if (used) return false;
      used = true;
      return true;
    },
  };
}
