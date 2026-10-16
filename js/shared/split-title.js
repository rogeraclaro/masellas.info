// Display titles: split into chars that roll up into place, with an animatable underline.
import { el } from './dom.js';

// Pre-state for titleIntro (also used to replay the intro).
export function hideTitle(heading, gsap) {
  gsap.set(heading.querySelectorAll('.page-title__char'), { rotateX: 90, autoAlpha: 0, transformOrigin: '50% 100%' });
  gsap.set(heading.querySelectorAll('.page-title__line'), { scaleX: 0 });
}

// Screen readers get the intact text. words: one underlined group per word, so long titles
// wrap between words and never inside one. Pass gsap to start hidden, ready for titleIntro.
export function splitTitle(heading, text, { words = false, gsap = null } = {}) {
  heading.textContent = '';
  heading.append(el('span', 'sr-only', text));
  const groups = words ? text.split(/\s+/).filter(Boolean) : [text];
  groups.forEach((group, index) => {
    if (index > 0) heading.append(document.createTextNode(' '));
    const chars = el('span', 'page-title__chars');
    chars.setAttribute('aria-hidden', 'true');
    for (const char of group) chars.append(el('span', 'page-title__char', char === ' ' ? ' ' : char));
    chars.append(el('span', 'page-title__line'));
    heading.append(chars);
  });
  heading.classList.add('is-split');
  if (gsap) hideTitle(heading, gsap);
}

// Chars roll up into place, then the underline grows. Adds to `tl` at `at`.
export function titleIntro(heading, tl, at = 0, alpha = 'masellas.alpha') {
  const chars = heading.querySelectorAll('.page-title__char');
  tl.to(chars, { autoAlpha: 1, duration: 0.4, ease: alpha, stagger: 0.03125 }, at);
  tl.to(chars, { rotateX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.03125 }, at);
  tl.to(heading.querySelectorAll('.page-title__line'), { scaleX: 1, duration: 0.8, ease: 'expo.out' }, at + 0.15);
  return tl;
}
