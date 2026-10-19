// Tooltips for rich-text terms: <button class="term" aria-describedby="<id>">, where <id> is a hidden
// element holding the explanation (rich-text-dom.js / build-pages render both). Screen readers get
// term + explanation once through aria-describedby; the floating bubble is visual only.
// One bubble per page, content via textContent. Browser only; shared by the home, the project detail
// and the admin previews (served by the admin, bundled by the site).
// A link with data-term-link (the projects (B.C.) menu tab, js/shared/menu-tips.js) is a target too,
// with the same aria-describedby, but a tap only follows the link: no touch toggle.
//   mouse: show after 100 ms, hide 150 ms after leaving (time to move onto the bubble)
//   keyboard: show on focus, hide on blur or Esc
//   touch / pen: tap toggles (not on a data-term-link); tapping elsewhere, scrolling or Esc hides
const SHOW_DELAY = 100;
const HIDE_DELAY = 150;
const MARGIN = 8; // from the viewport edges
const GAP = 8; // between the term and the bubble
const TAP_FOCUS_WINDOW = 600; // ms: a tap focuses the button too; the click decides

let bound = false;

export function bindTermTooltips({ gsap = null, ease = 'power1.out' } = {}) {
  if (bound) return;
  bound = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = Boolean(gsap) && !reduced;

  const tip = document.createElement('div');
  tip.className = 'term-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true'); // the term's own aria-describedby already reads it
  tip.hidden = true;
  document.body.append(tip);

  let current = null;
  let showTimer = 0;
  let hideTimer = 0;
  let lastPointer = 'mouse';
  let pointerDownAt = 0;
  let shownAt = 0;

  const termOf = (node) => (node instanceof Element ? node.closest('.term, [data-term-link]') : null);
  const explanationOf = (term) => {
    const id = term.getAttribute('aria-describedby');
    return (id && document.getElementById(id)?.textContent) || '';
  };

  // Above the term, centred; below when there is no room; always inside the viewport.
  function place(term) {
    const rect = term.getClientRects()[0] || term.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    let top = rect.top - height - GAP;
    const below = top < MARGIN;
    if (below) top = rect.bottom + GAP;
    top = Math.min(top, window.innerHeight - height - MARGIN);
    const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - MARGIN);
    tip.style.left = `${Math.round(Math.max(MARGIN, left))}px`;
    tip.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
    tip.dataset.side = below ? 'below' : 'above';
  }

  function show(term) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    const text = explanationOf(term);
    if (!text) return;
    const wasHidden = !current;
    current = term;
    shownAt = performance.now();
    tip.textContent = text;
    tip.hidden = false;
    if (animate) gsap.killTweensOf(tip);
    place(term);
    if (!animate) return;
    if (wasHidden) gsap.fromTo(tip, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.2, ease });
    else gsap.set(tip, { autoAlpha: 1, y: 0 });
  }

  function hide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (!current) return;
    current = null;
    if (!animate) {
      tip.hidden = true;
      return;
    }
    gsap.killTweensOf(tip);
    gsap.to(tip, {
      autoAlpha: 0, y: 6, duration: 0.2, ease,
      onComplete: () => { if (!current) tip.hidden = true; },
    });
  }

  const later = (fn, delay) => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    return setTimeout(fn, delay);
  };

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const term = termOf(event.target);
    if (term) showTimer = later(() => show(term), current ? 0 : SHOW_DELAY);
  });
  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse' || !termOf(event.target)) return;
    const to = event.relatedTarget;
    if (to instanceof Node && (tip.contains(to) || termOf(to) === termOf(event.target))) return;
    hideTimer = later(hide, HIDE_DELAY);
  });
  tip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  tip.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !(event.relatedTarget instanceof Node && termOf(event.relatedTarget) === current)) hideTimer = later(hide, HIDE_DELAY);
  });

  document.addEventListener('pointerdown', (event) => {
    lastPointer = event.pointerType || 'mouse';
    pointerDownAt = performance.now();
    if (!termOf(event.target) && !tip.contains(event.target)) hide();
  }, true);
  document.addEventListener('click', (event) => {
    const term = termOf(event.target);
    // Touch / pen tap toggles. Mouse already shows on hover; keyboard (detail 0) already on focus.
    // A term link's tap navigates, without a bubble.
    if (!term || lastPointer === 'mouse' || event.detail === 0 || term.hasAttribute('data-term-link')) return;
    if (current === term) hide();
    else show(term);
  });

  document.addEventListener('focusin', (event) => {
    const term = termOf(event.target);
    if (!term) return;
    if (lastPointer !== 'mouse' && performance.now() - pointerDownAt < TAP_FOCUS_WINDOW) return;
    show(term);
  });
  document.addEventListener('focusout', (event) => {
    if (termOf(event.target) && termOf(event.target) === current && !(event.relatedTarget && tip.contains(event.relatedTarget))) hide();
  });

  // Capture, so Esc only closes the bubble (not, say, the project detail behind it).
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !current) return;
    event.stopPropagation();
    event.preventDefault();
    hide();
  }, true);
  // A scroll right after showing is the focus scrolling the term into view: follow it instead.
  const onMove = () => {
    if (!current) return;
    if (performance.now() - shownAt < 300) place(current);
    else hide();
  };
  for (const type of ['scroll', 'wheel', 'resize']) window.addEventListener(type, onMove, { capture: true, passive: true });
}
