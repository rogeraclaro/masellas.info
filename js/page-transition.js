// Cross-document view transitions between pages. Loaded render-blocking in <head>:
// pagereveal only reaches listeners registered before the first render.
import { transitionType, readHandoff } from './shared/page-direction.js';

const HANDOFF = 'masellas:page-x';
const LOG = 'masellas:last-transition'; // last decision, for debugging and tests
const DURATION = 'masellas:vt-duration'; // optional override, e.g. "6s" to inspect the slide

const root = document.documentElement;
const pageX = root.dataset.pageX;

const store = {
  get: (key) => { try { return sessionStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* storage blocked */ } },
  remove: (key) => { try { sessionStorage.removeItem(key); } catch { /* storage blocked */ } },
};

let markReady;
window.masellasPageReady = new Promise((resolve) => { markReady = resolve; });

const duration = store.get(DURATION);
if (duration) root.style.setProperty('--page-vt-duration', duration);

window.addEventListener('pageswap', () => {
  store.set(HANDOFF, JSON.stringify({ x: pageX, at: Date.now() }));
});

window.addEventListener('pagereveal', (event) => {
  const fromX = readHandoff(store.get(HANDOFF), Date.now());
  store.remove(HANDOFF);
  const type = transitionType(fromX, pageX);
  const transition = event.viewTransition;
  const typed = Boolean(transition && type && transition.types);
  store.set(LOG, JSON.stringify({ from: fromX, to: pageX, type: typed ? type : null, at: Date.now() }));
  if (!transition) return markReady();
  if (typed) transition.types.add(type);
  else transition.skipTransition(); // unknown direction: plain navigation
  transition.finished.then(markReady, markReady);
});

// Browsers without cross-document view transitions never fire pagereveal.
if (!('onpagereveal' in window)) markReady();
