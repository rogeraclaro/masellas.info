/* Home: full-screen sections with a vertical "curtain" transition (replaces fullPage.js).
   Bundled with esbuild (scripts/build.sh) into home.min.js. */
import { setupGsap } from './shared/ease.js';
import { splitTitle, titleIntro, hideTitle } from './shared/split-title.js';
import { measureCube, bindCube } from './shared/cube.js';
import { pageReady } from './shared/page-ready.js';
import { step, jump, indexFromHash, createGestureGate } from './home/sections.js';
// Same parser the admin validates with (admin/lib is deployed as-is; esbuild bundles it here).
import { parseRichText, RICH_TEXT_MAX } from '../admin/lib/rich-text.js';
import { renderRichText } from '../admin/lib/rich-text-dom.js';

const root = document.documentElement;
const gsap = window.gsap;
const animate = Boolean(gsap) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverQuery = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
const SLIDE = { duration: 1.4, ease: 'expo.inOut' };

const sections = [...document.querySelectorAll('.section')];
const anchors = sections.map((section) => section.dataset.anchor);
const shade = document.querySelector('.section-shade');
const tabs = [...document.querySelectorAll('.menu__tab')];
const title = document.getElementById('home-title');
const words = document.querySelector('.intro');
const wordsSection = words && words.closest('.section');
const tabIndex = (tab) => (tab.pathname === window.location.pathname ? indexFromHash(tab.hash, anchors) : -1);

let alpha = 'power1.out';
let current = 0;
let animating = false;
let pendingWords = null; // fetched "some words" paragraphs waiting for a safe moment to swap in

if (animate) alpha = setupGsap(gsap);
else {
  root.classList.remove('js'); // nothing will animate: show text as is
  root.classList.add('no-motion');
}

/* ---------- Text intro: title chars, then paragraphs ---------- */

const texts = (section) => section.querySelectorAll('.home-animate');

function hideText(section) {
  if (!animate) return;
  if (section.contains(title)) hideTitle(title, gsap);
  gsap.set(texts(section), { autoAlpha: 0, y: 24 });
}

function textIntro(section, tl, at = 0) {
  if (!animate) return;
  let textsAt = at;
  if (section.contains(title)) {
    titleIntro(title, tl, at, alpha);
    textsAt = at + 0.3;
  }
  tl.to(texts(section), { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: 0.0625 }, textsAt);
}

/* ---------- "some words" from the admin (projects/data/some-words.json) ---------- */

// The paragraphs in index.html stay as the no-JS / failure fallback.
async function loadSomeWords() {
  try {
    const response = await fetch('projects/data/some-words.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { text } = await response.json();
    if (typeof text !== 'string' || !text.trim() || text.length > RICH_TEXT_MAX) throw new Error('no usable text');
    const { blocks, errors } = parseRichText(text);
    if (errors.length) throw new Error(errors[0]);
    return renderRichText(blocks, { paragraphClass: 'home-animate' });
  } catch (err) {
    console.warn(`some words: keeping the built-in text (${err.message})`);
    return null;
  }
}

// Swaps only while the section is off screen (or forced while its text is hidden for the intro),
// so readers never see the text jump; otherwise it waits for the next visit.
function applyWords({ force = false } = {}) {
  if (!pendingWords || (!force && wordsSection.classList.contains('is-active'))) return;
  words.replaceChildren(...pendingWords);
  pendingWords = null;
}

/* ---------- Section switching ---------- */

function markActive(index) {
  sections.forEach((section, i) => {
    section.inert = i !== index;
    if (i === index) section.removeAttribute('aria-hidden');
    else section.setAttribute('aria-hidden', 'true');
  });
  for (const tab of tabs) {
    if (tabIndex(tab) === index) tab.setAttribute('aria-current', 'location');
    else if (tabIndex(tab) >= 0) tab.removeAttribute('aria-current');
  }
  current = index;
}

// Going down, the next section rises from below over the current one, which drifts up a
// third and darkens; going up mirrors it. Then the incoming text plays its intro.
function go(move, { focus = false } = {}) {
  if (!move || animating) return;
  const from = sections[current];
  const to = sections[move.index];
  if (to === wordsSection) applyWords(); // before hideText(), so the intro animates the new nodes
  to.classList.add('is-active');
  to.scrollTop = 0;
  markActive(move.index);
  history.replaceState(history.state, '', `#${anchors[move.index]}`);
  const finish = () => {
    from.classList.remove('is-active');
    animating = false;
  };
  const focusSection = () => focus && to.querySelector('.section__inner').focus({ preventScroll: true });
  if (!animate) {
    finish();
    focusSection();
    return;
  }

  animating = true;
  hideText(to);
  const down = move.direction === 'down';
  gsap.set(from, { zIndex: 1 });
  gsap.set(shade, { zIndex: 2 });
  gsap.set(to, { zIndex: 3 });
  const tl = gsap.timeline();
  tl.fromTo(to, { y: down ? '100vh' : '-100vh' }, { y: 0, ...SLIDE }, 0);
  tl.fromTo(from, { y: 0 }, { y: down ? '-33vh' : '33vh', ...SLIDE }, 0);
  tl.fromTo(shade, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: alpha }, 0.4);
  tl.call(() => {
    gsap.set([from, to, shade], { clearProps: 'transform,zIndex,opacity,visibility' });
    finish();
  }, null, SLIDE.duration);
  textIntro(to, tl, SLIDE.duration);
  focusSection();
}

// A section taller than the screen scrolls first; it only hands over at its edge.
function atEdge(direction) {
  const section = sections[current];
  const max = section.scrollHeight - section.clientHeight;
  if (max <= 1) return true;
  return direction === 'down' ? section.scrollTop >= max - 1 : section.scrollTop <= 1;
}

function stepBy(delta, options) {
  if (!atEdge(delta > 0 ? 'down' : 'up')) return false;
  go(step(current, delta, sections.length), options);
  return true;
}

/* ---------- Input ---------- */

// One gesture = one step: only the first event of each wheel/touch gesture counts, so
// trackpad inertia can never skip two sections. Gestures that start mid-scroll just scroll.
function gestureHandler(gate, delta) {
  return (self) => {
    if (self.event && self.event.pointerType === 'mouse') return; // keep mouse text selection
    if (!gate.accept(performance.now()) || animating) return;
    stepBy(delta);
  };
}

function bindInput() {
  if (window.Observer && gsap) {
    gsap.registerPlugin(window.Observer);
    const wheel = createGestureGate(200);
    window.Observer.create({ type: 'wheel', tolerance: 5, onDown: gestureHandler(wheel, 1), onUp: gestureHandler(wheel, -1) });
    if (animate) {
      const touch = createGestureGate(200);
      window.Observer.create({ type: 'touch,pointer', tolerance: 30, onUp: gestureHandler(touch, 1), onDown: gestureHandler(touch, -1) });
    }
  }

  const keys = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      go(jump(current, event.key === 'Home' ? 0 : sections.length - 1), { focus: true });
      return;
    }
    const delta = event.key === ' ' ? (event.shiftKey ? -1 : 1) : keys[event.key];
    if (!delta) return;
    if (animating) event.preventDefault();
    else if (stepBy(delta, { focus: true })) event.preventDefault();
  });

  for (const tab of tabs) {
    tab.addEventListener('click', (event) => {
      const index = tabIndex(tab);
      if (index < 0 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(jump(current, index), { focus: true });
    });
  }

  // Old links and hand-edited hashes (#firstPage / #secondPage) keep working.
  window.addEventListener('hashchange', () => {
    const index = indexFromHash(window.location.hash, anchors);
    if (index >= 0) go(jump(current, index));
  });
}

/* ---------- Boot ---------- */

async function init() {
  splitTitle(title, title.textContent.trim(), { gsap: animate ? gsap : null });
  const start = Math.max(0, indexFromHash(window.location.hash, anchors)); // deep link: no slide
  sections.forEach((section, i) => section.classList.toggle('is-active', i === start));
  markActive(start);
  hideText(sections[start]);
  bindInput();

  // Never blocks "the point"; a deep link to "some words" waits briefly (max 1.5 s) for its text.
  const wordsReady = wordsSection
    ? loadSomeWords().then((nodes) => {
      pendingWords = nodes;
      applyWords();
    })
    : Promise.resolve();
  const startsOnWords = sections[start] === wordsSection;
  await Promise.all([
    document.fonts ? document.fonts.ready : null,
    pageReady(),
    startsOnWords ? Promise.race([wordsReady, new Promise((resolve) => setTimeout(resolve, 1500))]) : null,
  ]);
  if (startsOnWords && pendingWords) {
    applyWords({ force: true }); // its text is still hidden for the intro
    hideText(wordsSection);
  }
  for (const tab of tabs) {
    measureCube(tab, animate ? gsap : null);
    if (animate) bindCube(tab, { gsap, hoverQuery });
  }
  if (animate) {
    hoverQuery.addEventListener('change', () => {
      if (!hoverQuery.matches) gsap.set(document.querySelectorAll('.cube__inner'), { rotateX: 0 });
    });
    textIntro(sections[start], gsap.timeline());
  }
}

init();
