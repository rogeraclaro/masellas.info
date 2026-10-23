/* Projects index: renders the list from JSON, drives the cube-roll motion and the project detail view.
   Bundled with esbuild (scripts/build.sh) into projects.min.js. */
import { el } from '../../js/shared/dom.js';
import { setupGsap } from '../../js/shared/ease.js';
import { splitTitle as splitShared, titleIntro as introShared } from '../../js/shared/split-title.js';
import { buildCube, measureCube as measureShared, bindCube as bindShared, clearLeave } from '../../js/shared/cube.js';
import { pageReady } from '../../js/shared/page-ready.js';
import { loadStrings, pageLang } from '../../js/shared/i18n.js';
import { bindLangLinks } from '../../js/shared/lang-links.js';
import { projectHref, projectIdFrom } from '../../js/shared/project-url.js';
import { bindSiteMenu } from '../../js/shared/site-menu.js';
import { loadMenuTips } from '../../js/shared/menu-tips.js';
// "how I used AI" uses the same rich-text format as the home's "some words" (validated by the admin).
import { parseRichText } from '../../admin/lib/rich-text.js';
import { renderRichText } from '../../admin/lib/rich-text-dom.js';
import { bindTermTooltips } from '../../admin/lib/term-tooltip.js';

(() => {
  'use strict';

  const root = document.documentElement;
  const gsap = window.gsap;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = Boolean(gsap) && !reducedMotion;
  // Cube hover only where it makes sense: wide screens with a real mouse.
  const hoverQuery = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  const t = loadStrings(); // UI text for the page language (i18n/<lang>.json, injected by the build)

  const STAGGER = 0.0625;
  const ROW_LEAVE_DELAY = 500; // ms; leaves a trailing wave when sweeping across rows
  let ALPHA = 'power1.out';

  const list = document.getElementById('projects-list');
  // projects (IA) and projects (B.C.) share this bundle; the page names its data (set by the build).
  const collection = list.dataset.collection || 'projects';
  // The list's own path (e.g. /en/projects/); each project is at <list path><id>/ (see project-url.js).
  const listPath = list.dataset.listPath || window.location.pathname;
  const countEl = document.querySelector('.page-count');
  const filtersEl = document.querySelector('.filters');
  const titleEl = document.querySelector('[data-split]');
  let lenis = null;

  if (animate) {
    ALPHA = setupGsap(gsap);
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

  /* ---------- DOM helpers (el() is shared; textContent only, never innerHTML with data) ---------- */

  function safeUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return /^https?:$/.test(parsed.protocol) ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function renderRow(project) {
    const url = safeUrl(project.url);
    const link = el('a', 'work-item cube');
    link.href = detailHref(project.id);
    link.dataset.id = project.id;
    link.setAttribute('aria-label', t('row_label', { title: project.title, category: project.category }));

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

  // The "all" chip filters on '' so no category name can clash with it.
  function renderFilters(categories) {
    ['', ...categories].forEach((category, index) => {
      if (index > 0) {
        const sep = el('span', 'filters__sep', '/');
        sep.setAttribute('aria-hidden', 'true');
        filtersEl.append(sep);
      }
      const chip = el('button', 'chip cube');
      chip.type = 'button';
      chip.dataset.filter = category;
      chip.setAttribute('aria-pressed', String(index === 0));
      const label = category || t('filter_all');
      buildCube(chip, [document.createTextNode(label)], () => [document.createTextNode(label)]);
      filtersEl.append(chip);
    });
  }

  // Shared title splitter/intro (js/shared/split-title.js), bound to this page's motion settings.
  const splitTitle = (heading, text, options = {}) => splitShared(heading, text, { ...options, gsap: animate ? gsap : null });
  const titleIntro = (heading, tl, at = 0) => introShared(heading, tl, at, ALPHA);

  /* ---------- Cube geometry and hover ---------- */

  const measureCube = (cube) => measureShared(cube, animate ? gsap : null);

  function measureCubes() {
    document.querySelectorAll('.cube').forEach(measureCube);
  }

  const bindCube = (cube, leaveDelay) => bindShared(cube, { gsap, hoverQuery, leaveDelay });

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
    countEl.textContent = t.count('count', total);
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
      row.hidden = category !== '' && row.dataset.category !== category;
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

  /* ---------- Detail view (<list path><id>/, legacy ?p=<id>) ----------
     Open: the coral panel slides up from 100vh while the list page drifts to -33vh under
     a dark overlay (1.4s expo.inOut), then the title rolls in. Close is the exact reverse.
     The URL is the source of truth: clicks push a history entry, popstate syncs to it. */

  const pageEl = document.getElementById('page');
  const overlay = document.querySelector('.detail-overlay');
  const detail = document.getElementById('detail');
  const scroller = detail.querySelector('.detail__scroller');
  const content = detail.querySelector('.detail__content');
  const detailTitle = document.getElementById('detail-title');
  const nextLink = detail.querySelector('.detail__next a');
  // A project page (the admin's copy for crawlers) has the project's title: closing restores the list's.
  const pageTitle = list.dataset.listTitle || document.title;
  const SLIDE = { duration: 1.4, ease: 'expo.inOut' };

  let order = [];
  let projectsById = new Map();
  let currentId = null;
  let opener = null; // row link to refocus on close
  let savedScroll = 0;
  let transitioning = false;
  let pendingSync = false;
  let closingToList = false;
  let activeTl = null;
  let introTl = null;
  let detailLenis = null;
  let closeBtn = null;

  const detailHref = (id) => projectHref(listPath, id);
  const idFromUrl = () => projectIdFrom(listPath, window.location);
  const listUrl = () => listPath;
  const reveals = () => content.querySelectorAll('[data-reveal]:not([hidden])');
  const plainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  function buildCloseButton() {
    closeBtn = el('button', 'menu__tab cube detail__close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', t('close_label'));
    buildCube(closeBtn, [document.createTextNode(t('close'))], () => [document.createTextNode(t('close'))]);
    detail.prepend(closeBtn); // first in tab order inside the dialog
  }

  // Rich text, DOM only (never innerHTML). Subheadings are h4, under the section's "how I used AI" h3.
  // Anything the parser cannot read is rendered as the text it is.
  function aiBlocks(text) {
    return renderRichText(parseRichText(text).blocks, { linkClass: 'detail-link detail-link--inline', headingTag: 'h4' });
  }

  function renderDetail(project) {
    splitTitle(detailTitle, project.title, { words: true });
    const url = safeUrl(project.url);
    const visit = detail.querySelector('.detail__visit');
    const meta = detail.querySelector('.detail__meta');
    meta.replaceChildren(`${project.category} / ${project.year}`);
    if (url) {
      // The same "visit site" link as at the bottom, after a middle dot.
      const top = el('a', 'detail-link', visit.querySelector('a').textContent);
      top.href = url.href;
      top.target = '_blank';
      top.rel = 'noopener';
      top.setAttribute('aria-label', t('visit_label', { title: project.title }));
      meta.append(el('span', 'detail__meta-sep', ' · '), top);
    }

    const lead = detail.querySelector('.detail__lead');
    lead.textContent = project.description || '';
    lead.hidden = !project.description;

    const ai = typeof project.ai === 'string' ? project.ai.trim() : '';
    const aiSection = detail.querySelector('.detail__ai');
    aiSection.hidden = !ai;
    aiSection.querySelector('.detail__body').replaceChildren(...(ai ? aiBlocks(ai) : []));

    const tools = Array.isArray(project.tools) ? project.tools : [];
    const toolList = detail.querySelector('.detail__tools');
    toolList.replaceChildren(...tools.map((tool) => el('li', '', tool)));
    toolList.hidden = !tools.length;

    visit.hidden = !url;
    if (url) {
      const link = visit.querySelector('a');
      link.href = url.href;
      link.setAttribute('aria-label', t('visit_label', { title: project.title }));
    }

    const next = order[(order.indexOf(project) + 1) % order.length];
    nextLink.parentElement.hidden = order.length < 2;
    nextLink.href = detailHref(next.id);
    nextLink.dataset.id = next.id;
    nextLink.textContent = t('next', { title: next.title });

    document.title = t('detail_title', { title: project.title });
    if (animate) gsap.set(reveals(), { autoAlpha: 0, y: 24 });
  }

  function detailIntro(tl, at) {
    titleIntro(detailTitle, tl, at);
    tl.to(reveals(), { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: STAGGER }, at + 0.2);
    return tl;
  }

  function lockBackground(locked) {
    pageEl.inert = locked; // the menus stay usable over the detail
    root.classList.toggle('detail-open', locked);
    if (lenis) {
      if (locked) lenis.stop();
      else lenis.start();
    }
  }

  // One transition at a time; anything that arrives meanwhile is replayed from the URL afterwards.
  function startTransition() {
    if (activeTl) activeTl.kill();
    if (introTl) introTl.kill();
    transitioning = true;
    activeTl = gsap.timeline();
    return activeTl;
  }

  function settle() {
    transitioning = false; // activeTl may still run the title intro; the next transition kills it
    if (pendingSync) {
      pendingSync = false;
      sync();
    }
  }

  function openDetail(id, { instant = false, from = null } = {}) {
    currentId = id;
    opener = from;
    savedScroll = window.scrollY;
    renderDetail(projectsById.get(id));
    lockBackground(true);
    detail.hidden = false;
    scroller.scrollTop = 0;
    measureCube(closeBtn);
    // Focus last: GSAP briefly reparents the fixed panel while it parses its transform, which would blur it.
    const focusTitle = () => detailTitle.focus({ preventScroll: true });
    if (!animate) return focusTitle();

    if (window.Lenis) {
      detailLenis = new window.Lenis({ wrapper: scroller, content, easing: (t) => 1 - Math.pow(1 - t, 5) });
    }
    const tl = startTransition();
    if (instant) {
      // Deep link: panel already in place, only the title intro runs.
      gsap.set(detail, { y: 0 });
      gsap.set(pageEl, { y: '-33vh' });
      gsap.set(overlay, { autoAlpha: 1 });
      detailIntro(tl, 0.1);
      tl.call(settle, null, 0);
      return focusTitle();
    }
    tl.fromTo(detail, { y: '100vh' }, { y: 0, ...SLIDE }, 0);
    tl.fromTo(pageEl, { y: 0 }, { y: '-33vh', ...SLIDE }, 0);
    tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: ALPHA }, 0.4);
    detailIntro(tl, 1.1);
    tl.call(settle, null, SLIDE.duration);
    return focusTitle();
  }

  function closeDetail() {
    currentId = null;
    const finish = () => {
      detail.hidden = true;
      if (detailLenis) {
        detailLenis.destroy();
        detailLenis = null;
      }
      if (animate) gsap.set([pageEl, detail, overlay], { clearProps: 'transform,opacity,visibility' });
      lockBackground(false);
      window.scrollTo(0, savedScroll);
      if (lenis) lenis.scrollTo(savedScroll, { immediate: true, force: true });
      document.title = pageTitle;
      (opener && opener.isConnected && !opener.closest('[hidden]') ? opener : titleEl).focus({ preventScroll: true });
    };
    if (!animate) return finish();

    const tl = startTransition();
    tl.to(detail, { y: '100vh', ...SLIDE }, 0);
    tl.to(pageEl, { y: 0, ...SLIDE }, 0);
    tl.to(overlay, { autoAlpha: 0, duration: 0.4, ease: ALPHA }, SLIDE.duration - 0.8);
    tl.call(() => {
      finish();
      settle();
    }, null, SLIDE.duration);
  }

  // "next project": old content rolls out, new content rolls in, panel back to the top.
  function swapDetail(id) {
    currentId = id;
    const project = projectsById.get(id);
    const showNew = () => {
      renderDetail(project);
      if (detailLenis) detailLenis.scrollTo(0, { immediate: true, force: true });
      scroller.scrollTop = 0;
      detailTitle.focus({ preventScroll: true });
    };
    if (!animate) return showNew();

    const tl = startTransition();
    tl.to(detailTitle.querySelectorAll('.page-title__char'), { rotateX: -90, autoAlpha: 0, duration: 0.4, ease: 'expo.in', stagger: 0.015 }, 0);
    tl.to(detailTitle.querySelectorAll('.page-title__line'), { scaleX: 0, duration: 0.4, ease: 'expo.in' }, 0);
    tl.to(reveals(), { autoAlpha: 0, y: -24, duration: 0.4, ease: ALPHA }, 0);
    tl.call(() => {
      showNew();
      introTl = detailIntro(gsap.timeline(), 0);
      settle();
    }, null, 0.5);
  }

  // Brings the view in line with the URL (used by popstate and after each transition).
  function sync() {
    if (transitioning) {
      pendingSync = true;
      return;
    }
    const id = idFromUrl();
    const wanted = id && projectsById.has(id) ? id : null;
    if (id && !wanted) history.replaceState(null, '', listUrl());
    if (wanted === currentId) return;
    if (!wanted) closeDetail();
    else if (currentId) swapDetail(wanted);
    else openDetail(wanted, { from: list.querySelector(`a[data-id="${CSS.escape(wanted)}"]`) });
  }

  // Close goes back to the list entry, however many "next project" steps were taken.
  function requestClose() {
    if (transitioning || !currentId) return;
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) {
      closingToList = true;
      history.go(-depth);
    } else {
      history.replaceState(null, '', listUrl());
      closeDetail();
    }
  }

  function openFromUrl() {
    const id = idFromUrl();
    if (!id) return;
    if (!projectsById.has(id)) {
      history.replaceState(null, '', listUrl());
      return;
    }
    history.replaceState({ p: id, depth: 0 }, '', detailHref(id)); // a legacy ?p=<id> becomes the path form
    openDetail(id, { instant: true });
  }

  function bindDetail() {
    if (animate && window.Lenis) gsap.ticker.add((time) => detailLenis && detailLenis.raf(time * 1000));

    list.addEventListener('click', (event) => {
      const link = event.target.closest('a.work-item');
      if (!link || !plainClick(event)) return; // modified clicks open the real project page
      event.preventDefault();
      if (transitioning || currentId) return;
      history.pushState({ p: link.dataset.id, depth: 1 }, '', detailHref(link.dataset.id));
      openDetail(link.dataset.id, { from: link });
    });

    nextLink.addEventListener('click', (event) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      if (transitioning) return;
      const id = nextLink.dataset.id;
      history.pushState({ p: id, depth: ((history.state && history.state.depth) || 0) + 1 }, '', detailHref(id));
      swapDetail(id);
    });

    closeBtn.addEventListener('click', requestClose);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && currentId && !event.defaultPrevented) requestClose(); // the burger menu closes first
    });
    window.addEventListener('popstate', () => {
      if (closingToList) {
        closingToList = false;
        history.replaceState(null, '', listUrl());
      }
      sync();
    });
  }

  /* ---------- Data + intro ---------- */

  // Returns the visible projects, or null when the data cannot be loaded.
  async function loadProjects() {
    try {
      const response = await fetch(`/projects/data/${collection}.${pageLang()}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).projects.filter((project) => project.visible !== false);
    } catch (err) {
      return null;
    }
  }

  function intro() {
    if (!animate) return;
    const tl = titleIntro(titleEl, gsap.timeline());
    tl.fromTo(countEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: ALPHA }, 0.15);
    if (filtersEl.children.length) tl.fromTo(filtersEl.children, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out', stagger: STAGGER }, 0.3);
    tl.add(() => show(), 0.2);
  }

  async function init() {
    splitTitle(titleEl, titleEl.textContent.trim());
    bindSiteMenu();
    bindLangLinks(document.querySelector('.lang-nav'), { listPath });
    bindTermTooltips({ gsap: animate ? gsap : null, ease: ALPHA });
    loadMenuTips(pageLang());
    titleEl.tabIndex = -1; // focus target when a deep-linked detail closes
    const [projects] = await Promise.all([loadProjects(), document.fonts ? document.fonts.ready : null]);
    // The rows already in the list are the admin's copy for crawlers (admin/lib/seo-pages.js), not built
    // for the animations: they give way to the live rows, or to the error when there is no data.
    if (!projects) {
      list.replaceChildren();
      list.after(el('p', 'work-list__error', t('load_error')));
      await pageReady();
      intro();
      return;
    }

    list.replaceChildren(...projects.map(renderRow));
    order = projects;
    projectsById = new Map(projects.map((project) => [project.id, project]));
    buildCloseButton();
    if (projects.length) {
      renderFilters([...new Set(projects.map((project) => project.category))]);
      updateCount();
    } else {
      // An empty collection: one sentence in the count's place; no filters, no list hairline.
      countEl.textContent = t('empty');
      list.hidden = true;
      pageEl.classList.add('page--empty');
    }
    measureCubes();
    if (lenis) lenis.resize();

    if (animate) {
      // Pre-state for the appear animation; show() reveals what is in view.
      if (projects.length) gsap.set(linksOf(visibleRows()), { autoAlpha: 0 });
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

    bindDetail();
    await pageReady(); // after the cross-page slide, not under it
    intro();
    openFromUrl();
  }

  init();
})();
