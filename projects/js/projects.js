/* Projects index: renders the list from JSON and drives the cube-roll motion. */
(() => {
  'use strict';

  const root = document.documentElement;
  const gsap = window.gsap;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = Boolean(gsap) && !reducedMotion;
  // Cube hover only where it makes sense: wide screens with a real mouse.
  const hoverQuery = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');

  const STAGGER = 0.0625;
  const ROW_LEAVE_DELAY = 500; // ms; leaves a trailing wave when sweeping across rows
  let ALPHA = 'power1.out';

  const list = document.getElementById('projects-list');
  const countEl = document.querySelector('.page-count');
  const filtersEl = document.querySelector('.filters');
  const titleEl = document.querySelector('[data-split]');
  const leaveTimers = new WeakMap();
  let lenis = null;

  if (animate) {
    gsap.defaults({ ease: 'none' });
    if (window.CustomEase) {
      gsap.registerPlugin(window.CustomEase);
      window.CustomEase.create('masellas.alpha', '.25, .46, .45, .9');
      ALPHA = 'masellas.alpha';
    }
    if (window.Lenis) {
      lenis = new window.Lenis({ easing: (t) => 1 - Math.pow(1 - t, 5), wheelMultiplier: 1 });
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  } else {
    // Nothing will animate: drop the pre-hide class and use the CSS-only hover.
    root.classList.remove('js');
    root.classList.add('no-motion');
  }

  /* ---------- DOM helpers (textContent only, never innerHTML with data) ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return /^https?:$/.test(parsed.protocol) ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  // Wraps front content plus two hidden faces into the cube structure.
  function buildCube(cube, frontNodes, makeHiddenNodes) {
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

  function renderRow(project) {
    const url = safeUrl(project.url);
    const link = el('a', 'work-item cube');
    if (url) link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', `${project.title}, ${project.category} (opens in a new tab)`);

    const meta = el('span', 'work-item__meta');
    meta.append(el('span', '', `${project.category} / ${project.year}`));
    const thumbs = Array.isArray(project.thumbs) ? project.thumbs.slice(0, 3) : [];
    if (thumbs.length) {
      const strip = el('span', 'work-item__thumbs');
      for (const src of thumbs) {
        const img = el('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        strip.append(img);
      }
      meta.append(strip);
    }

    buildCube(link, [el('span', 'work-item__title', project.title), meta], () => {
      const info = el('span', 'work-item__info');
      info.append(el('span', 'work-item__desc', project.description));
      if (url) info.append(el('span', 'work-item__domain', url.hostname));
      return [el('span', 'work-item__title', project.title), info];
    });

    const li = el('li');
    li.dataset.category = project.category;
    li.append(link);
    return li;
  }

  function renderFilters(categories) {
    ['all', ...categories].forEach((category, index) => {
      if (index > 0) {
        const sep = el('span', 'filters__sep', '/');
        sep.setAttribute('aria-hidden', 'true');
        filtersEl.append(sep);
      }
      const chip = el('button', 'chip cube');
      chip.type = 'button';
      chip.dataset.filter = category;
      chip.setAttribute('aria-pressed', String(index === 0));
      buildCube(chip, [document.createTextNode(category)], () => [document.createTextNode(category)]);
      filtersEl.append(chip);
    });
  }

  // Splits the heading into chars; screen readers get the intact word instead.
  function splitTitle() {
    const text = titleEl.textContent.trim();
    titleEl.textContent = '';
    const chars = el('span', 'page-title__chars');
    chars.setAttribute('aria-hidden', 'true');
    for (const char of text) {
      chars.append(el('span', 'page-title__char', char === ' ' ? ' ' : char));
    }
    chars.append(el('span', 'page-title__line'));
    titleEl.append(el('span', 'sr-only', text), chars);
    titleEl.classList.add('is-split');
    if (animate) {
      gsap.set(chars.querySelectorAll('.page-title__char'), { rotateX: 90, autoAlpha: 0, transformOrigin: '50% 100%' });
      gsap.set(chars.querySelector('.page-title__line'), { scaleX: 0 });
    }
  }

  /* ---------- Cube geometry and hover ---------- */

  function measureCubes() {
    for (const cube of document.querySelectorAll('.cube')) {
      const inner = cube.firstElementChild;
      const height = inner.offsetHeight;
      if (!height) continue; // filtered out (display: none)
      cube.style.setProperty('--height', `${height}px`);
      // Pull the cube back by half its depth so the front face rests at z = 0.
      if (animate) gsap.set(inner, { z: -height / 2 });
    }
  }

  function roll(inner, angle, duration, ease) {
    gsap.killTweensOf(inner, 'rotateX');
    gsap.to(inner, { rotateX: angle, duration, ease });
  }

  function clearLeave(inner) {
    clearTimeout(leaveTimers.get(inner));
    leaveTimers.delete(inner);
  }

  function bindCube(cube, leaveDelay) {
    const inner = cube.firstElementChild;
    const rollBack = () => roll(inner, 0, leaveDelay ? 0.8 : 0.6, leaveDelay ? 'expo.inOut' : 'expo.out');

    cube.addEventListener('mouseenter', (event) => {
      if (!hoverQuery.matches) return;
      clearLeave(inner);
      const rect = cube.getBoundingClientRect();
      // Entering through the top half rolls down (-90), bottom half rolls up (+90).
      roll(inner, event.clientY < rect.top + rect.height / 2 ? -90 : 90, 0.6, 'expo.out');
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
      roll(inner, -90, 0.6, 'expo.out');
    });
    cube.addEventListener('blur', () => {
      if (gsap.getProperty(inner, 'rotateX') !== 0 && !cube.matches(':hover')) rollBack();
    });
  }

  /* ---------- List show / hide ---------- */

  const visibleRows = () => [...list.children].filter((li) => !li.hidden);
  const linksOf = (rows) => rows.map((li) => li.firstElementChild);
  const innersOf = (rows) => rows.map((li) => li.firstElementChild.firstElementChild);

  // viewTop lets the caller test against a scroll position that is still being animated to.
  function inView(row, viewTop) {
    const rect = row.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    return top < viewTop + window.innerHeight && top + rect.height > viewTop;
  }

  function show(viewTop = window.scrollY) {
    if (!animate) return Promise.resolve();
    const rows = visibleRows();
    const inside = rows.filter((row) => inView(row, viewTop));
    const outside = rows.filter((row) => !inside.includes(row));
    if (outside.length) {
      gsap.set(linksOf(outside), { autoAlpha: 1 });
      gsap.set(innersOf(outside), { rotateX: 0 });
    }
    if (!inside.length) return Promise.resolve();

    list.style.pointerEvents = 'none';
    const tl = gsap.timeline({ onComplete: () => { list.style.pointerEvents = ''; } });
    tl.fromTo(innersOf(inside), { rotateX: 90 }, { rotateX: 0, duration: 0.8, ease: 'expo.inOut', stagger: STAGGER }, 0);
    tl.fromTo(linksOf(inside), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: ALPHA, stagger: STAGGER }, 0.3);
    return tl.then();
  }

  function hide() {
    if (!animate) return Promise.resolve();
    const rows = visibleRows();
    const inside = rows.filter((row) => inView(row, window.scrollY));
    const inners = innersOf(rows);
    inners.forEach(clearLeave);
    gsap.killTweensOf(inners, 'rotateX');
    const outside = rows.filter((row) => !inside.includes(row));
    if (outside.length) gsap.set(linksOf(outside), { autoAlpha: 0 });
    if (!inside.length) return Promise.resolve();

    list.style.pointerEvents = 'none';
    const tl = gsap.timeline();
    // Bottom-up: the last visible row leaves first.
    tl.to(innersOf(inside), { rotateX: 90, duration: 0.6, ease: 'expo.out', stagger: { each: STAGGER, from: 'end' } }, 0);
    tl.to(linksOf(inside), { autoAlpha: 0, duration: 0.2, ease: ALPHA, stagger: { each: STAGGER, from: 'end' } }, 0.15);
    return tl.then();
  }

  /* ---------- Filters ---------- */

  let busy = false;
  let pendingFilter = null;

  function updateCount() {
    const total = visibleRows().length;
    countEl.textContent = `${total} project${total === 1 ? '' : 's'}`;
  }

  async function applyFilter(category) {
    if (busy) {
      pendingFilter = category;
      return;
    }
    busy = true;
    for (const chip of filtersEl.querySelectorAll('.chip')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === category));
    }

    // If the list top has scrolled out of view, bring it back while rows leave.
    let viewTop = window.scrollY;
    const listTop = list.getBoundingClientRect().top;
    if (listTop < 0) {
      viewTop = Math.max(0, listTop + window.scrollY - 80);
      if (lenis) lenis.scrollTo(viewTop, { duration: 1.2, force: true });
      else window.scrollTo(0, viewTop);
    }

    await hide();
    for (const row of list.children) {
      row.hidden = category !== 'all' && row.dataset.category !== category;
    }
    measureCubes();
    if (lenis) lenis.resize();
    updateCount();
    viewTop = Math.min(viewTop, Math.max(0, root.scrollHeight - window.innerHeight));
    await show(viewTop);

    busy = false;
    if (pendingFilter !== null && pendingFilter !== category) {
      const next = pendingFilter;
      pendingFilter = null;
      applyFilter(next);
    }
    pendingFilter = null;
  }

  /* ---------- Data + intro ---------- */

  async function loadProjects() {
    try {
      const response = await fetch('data/projects.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).projects;
    } catch (err) {
      // file:// or network failure: use the inline copy embedded in the page.
      return JSON.parse(document.getElementById('projects-data').textContent).projects;
    }
  }

  function intro() {
    if (!animate) return;
    const chars = titleEl.querySelectorAll('.page-title__char');
    const tl = gsap.timeline();
    tl.to(chars, { autoAlpha: 1, duration: 0.4, ease: ALPHA, stagger: 0.03125 }, 0);
    tl.to(chars, { rotateX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.03125 }, 0);
    tl.to(titleEl.querySelector('.page-title__line'), { scaleX: 1, duration: 0.8, ease: 'expo.out' }, 0.15);
    tl.fromTo(countEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: ALPHA }, 0.15);
    tl.fromTo(filtersEl.children, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out', stagger: STAGGER }, 0.3);
    tl.add(() => show(), 0.2);
  }

  async function init() {
    splitTitle();
    const [projects] = await Promise.all([loadProjects(), document.fonts ? document.fonts.ready : null]);

    list.append(...projects.map(renderRow));
    renderFilters([...new Set(projects.map((project) => project.category))]);
    updateCount();
    measureCubes();
    if (lenis) lenis.resize();

    if (animate) {
      // Pre-state for the appear animation; show() reveals what is in view.
      gsap.set(linksOf(visibleRows()), { autoAlpha: 0 });
      document.querySelectorAll('.cube').forEach((cube) => bindCube(cube, cube.classList.contains('work-item') ? ROW_LEAVE_DELAY : 0));
      hoverQuery.addEventListener('change', () => {
        if (!hoverQuery.matches) gsap.set(document.querySelectorAll('.cube__inner'), { rotateX: 0 });
      });
    }

    filtersEl.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (chip && chip.getAttribute('aria-pressed') !== 'true') applyFilter(chip.dataset.filter);
    });

    let lastWidth = window.innerWidth;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return; // ignore mobile URL-bar height changes
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureCubes();
        if (lenis) lenis.resize();
      }, 100);
    });

    intro();
  }

  init();
})();
