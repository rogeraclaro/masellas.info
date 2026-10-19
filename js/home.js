/* Home: full-screen sections with a vertical "curtain" transition (replaces fullPage.js).
   Bundled with esbuild (scripts/build.sh) into home.min.js. */
import { setupGsap } from './shared/ease.js';
import { splitTitle, titleIntro, hideTitle } from './shared/split-title.js';
import { measureCube, bindCube } from './shared/cube.js';
import { pageReady } from './shared/page-ready.js';
import { step, jump, indexFromHash, createGestureGate, canLeave } from './home/sections.js';
import { pageLang } from './shared/i18n.js';
import { bindLangLinks } from './shared/lang-links.js';
import { bindSiteMenu } from './shared/site-menu.js';
import { loadMenuTips } from './shared/menu-tips.js';
// Same parser the admin validates with (admin/lib is deployed as-is; esbuild bundles it here).
import { parseRichText, RICH_TEXT_MAX } from '../admin/lib/rich-text.js';
import { renderRichText } from '../admin/lib/rich-text-dom.js';
import { bindTermTooltips } from '../admin/lib/term-tooltip.js';

const root = document.documentElement;
const gsap = window.gsap;
const animate = Boolean(gsap) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverQuery = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
const SLIDE = { duration: 1.4, ease: 'expo.inOut' };

const sections = [...document.querySelectorAll('.section')];
const anchors = sections.map((section) => section.dataset.anchor);
const shade = document.querySelector('.section-shade');
const tabs = [...document.querySelectorAll('.menu .menu__tab')]; // section links (the point / some words / projects / projects (B.C.))
const cubes = [...document.querySelectorAll('.menu__tab')]; // plus the language tabs
const title = document.getElementById('home-title');
const words = document.querySelector('.intro');
const wordsSection = words && words.closest('.section');
const tabIndex = (tab) => (tab.pathname === window.location.pathname ? indexFromHash(tab.hash, anchors) : -1);

let alpha = 'power1.out';
let current = 0;
let animating = false;
let pendingWords = null; // fetched "some words" paragraphs waiting for a safe moment to swap in
let menu = { isOpen: () => false }; // mobile burger menu: while open, gestures and keys never change sections

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

/* ---------- "some words" from the admin (projects/data/some-words.<lang>.json) ---------- */

// The paragraphs in the page (from i18n/<lang>.json) stay as the no-JS / failure fallback.
async function loadSomeWords() {
  try {
    const response = await fetch(`/projects/data/some-words.${pageLang()}.json`, { cache: 'no-store' });
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

// Which ways the current section can be left right now (canLeave: a tall one scrolls first).
function exits() {
  const section = sections[current];
  return { up: canLeave(section, 'up'), down: canLeave(section, 'down') };
}

// `from`: the exits when the gesture began (default: now). Returns whether it changed section.
function stepBy(delta, options, from = exits()) {
  if (!from[delta > 0 ? 'down' : 'up']) return false;
  go(step(current, delta, sections.length), options);
  return true;
}

/* ---------- Input ---------- */

// One gesture = one step: only the first event of each wheel/touch gesture counts, so
// trackpad inertia can never skip two sections. A gesture changes section only if the section
// was already at that edge when it began; one that starts mid-scroll (or reaches the edge on
// the way) just scrolls, and the next gesture moves on.

// Touch: Observer reports a drag once it passes its tolerance, after the section has already
// scrolled with the finger, so the exits are read when the finger lands.
let touchExits = null;

function touchHandler(gate, delta) {
  return (self) => {
    if (self.event && self.event.pointerType === 'mouse') return; // keep mouse text selection
    if (!gate.accept(performance.now()) || animating || menu.isOpen()) return;
    stepBy(delta, undefined, touchExits || exits());
  };
}

// Wheel: a plain, non-passive listener, so the browser waits for it before scrolling and the
// edge is read before the scroll. (Observer reports wheel events a frame later, and a passive
// listener lets the scroll run first: either way one notch could scroll a slightly-too-tall
// section to its edge and then also change section.)
function bindWheel() {
  const gate = createGestureGate(200);
  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return; // pinch zoom
    if (!gate.accept(performance.now()) || animating || menu.isOpen()) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return; // sideways
    if (stepBy(Math.sign(event.deltaY))) event.preventDefault();
  }, { passive: false });
}

function bindInput() {
  bindWheel();
  if (animate && window.Observer) {
    gsap.registerPlugin(window.Observer);
    window.addEventListener('pointerdown', () => { touchExits = exits(); }, { capture: true, passive: true });
    const touch = createGestureGate(200);
    window.Observer.create({ type: 'touch,pointer', tolerance: 30, onUp: touchHandler(touch, 1), onDown: touchHandler(touch, -1) });
  }

  const keys = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || menu.isOpen()) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      go(jump(current, event.key === 'Home' ? 0 : sections.length - 1), { focus: true });
      return;
    }
    const delta = event.key === ' ' ? (event.shiftKey ? -1 : 1) : keys[event.key];
    if (!delta || (event.key === ' ' && event.target.closest('button'))) return; // Space presses buttons
    event.preventDefault();
    if (animating || stepBy(delta, { focus: true })) return;
    // Not at the edge yet: scroll the section like the browser would, wherever the focus is
    // (with focus outside the section the browser would scroll nothing, html never scrolls).
    const section = sections[current];
    const distance = event.key.startsWith('Arrow') ? 40 : section.clientHeight * 0.85;
    section.scrollBy({ top: delta * distance, behavior: animate ? 'smooth' : 'auto' });
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
  menu = bindSiteMenu();
  bindInput();
  bindLangLinks(document.querySelector('.lang-nav'));
  bindTermTooltips({ gsap: animate ? gsap : null, ease: alpha });
  loadMenuTips(pageLang());

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
  for (const tab of cubes) {
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
