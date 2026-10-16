// 3D "cube roll" hover used by menu tabs, filter chips, rows and small buttons.
import { el } from './dom.js';

const leaveTimers = new WeakMap();
const boundInners = new Set();

// The outgoing page is snapshotted for the cross-document view transition right
// after `pageswap`; settle every cube first so no tab is frozen mid-roll.
window.addEventListener('pageswap', () => {
  for (const inner of boundInners) {
    clearLeave(inner);
    window.gsap?.killTweensOf(inner, 'rotateX');
    window.gsap?.set(inner, { rotateX: 0 });
  }
});

// Wraps front content plus two hidden faces into the cube structure.
export function buildCube(cube, frontNodes, makeHiddenNodes) {
  const inner = el('span', 'cube__inner');
  const front = el('span', 'face face--front');
  front.append(...frontNodes);
  inner.append(front);
  for (const side of ['before', 'after']) {
    const face = el('span', `face face--${side}`);
    face.setAttribute('aria-hidden', 'true');
    face.append(...makeHiddenNodes());
    inner.append(face);
  }
  cube.append(inner);
  return cube;
}

// Pass gsap only when animating.
export function measureCube(cube, gsap) {
  const inner = cube.firstElementChild;
  const height = inner.offsetHeight;
  if (!height) return; // not rendered (filtered out, or inside a hidden panel)
  cube.style.setProperty('--height', `${height}px`);
  // Pull the cube back by half its depth so the front face rests at z = 0.
  if (gsap) gsap.set(inner, { z: -height / 2 });
}

export function clearLeave(inner) {
  clearTimeout(leaveTimers.get(inner));
  leaveTimers.delete(inner);
}

export function bindCube(cube, { gsap, hoverQuery, leaveDelay = 0 }) {
  const inner = cube.firstElementChild;
  boundInners.add(inner);
  const roll = (angle, duration, ease) => {
    gsap.killTweensOf(inner, 'rotateX');
    gsap.to(inner, { rotateX: angle, duration, ease });
  };
  const rollBack = () => roll(0, leaveDelay ? 0.8 : 0.6, leaveDelay ? 'expo.inOut' : 'expo.out');

  cube.addEventListener('mouseenter', (event) => {
    if (!hoverQuery.matches) return;
    clearLeave(inner);
    const rect = cube.getBoundingClientRect();
    // Entering through the top half rolls down (-90), bottom half rolls up (+90).
    roll(event.clientY < rect.top + rect.height / 2 ? -90 : 90, 0.6, 'expo.out');
  });
  cube.addEventListener('mouseleave', () => {
    if (!hoverQuery.matches) return;
    clearLeave(inner);
    if (leaveDelay) leaveTimers.set(inner, setTimeout(rollBack, leaveDelay));
    else rollBack();
  });
  cube.addEventListener('focus', () => {
    if (!hoverQuery.matches || !cube.matches(':focus-visible')) return;
    clearLeave(inner);
    roll(-90, 0.6, 'expo.out');
  });
  cube.addEventListener('blur', () => {
    if (gsap.getProperty(inner, 'rotateX') !== 0 && !cube.matches(':hover')) rollBack();
  });
}
