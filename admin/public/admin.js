/* Admin UI (projects + the home's "some words"). Vanilla JS module; all user data goes through
   textContent, never innerHTML. The rich-text parser is the same file the server validates with. */
import { parseRichText, RICH_TEXT_MAX } from './rich-text.js';
import { renderRichText } from './rich-text-dom.js';
import { formattingHelp } from './rich-text-help.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const loginView = $('login');
  const appView = $('app');
  const list = $('list');
  const statusEl = $('status');
  const editor = $('editor');
  const form = $('project-form');
  const fields = ['title', 'year', 'url']; // shared by every language
  const thumbInputs = [...document.querySelectorAll('.thumb')];
  const LANGS = ['ca', 'en', 'es']; // ca: principal; an empty en / es shows the ca text on the site

  let projects = [];
  let version = null;
  let editingId = null; // null = creating
  let returnFocus = null;
  let dragId = null;
  let statusTimer = 0;

  /* ---------- API ---------- */

  class ApiError extends Error {
    constructor(status, body) {
      super(body.error || `HTTP ${status}`);
      this.status = status;
      this.body = body;
    }
  }

  // ifMatch/track: "some words" has its own version and must not touch the projects one.
  async function api(method, path, body, { ifMatch = version, track = true } = {}) {
    const headers = {};
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && ifMatch) headers['If-Match'] = ifMatch;
    const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== 'api/login') {
      showLogin();
      throw new ApiError(401, data);
    }
    if (!res.ok) throw new ApiError(res.status, data);
    if (track && data.version) version = data.version;
    return data;
  }

  /* ---------- Views ---------- */

  function showLogin(message = '') {
    appView.hidden = true;
    loginView.hidden = false;
    $('login-error').textContent = message;
    $('password').value = '';
    $('password').focus();
  }

  async function showApp() {
    const [config] = await Promise.all([api('GET', 'api/config'), loadProjects()]);
    $('view-site').href = config.publicUrl;
    loginView.hidden = true;
    appView.hidden = false;
    $('new-project').focus();
  }

  function setStatus(text) {
    clearTimeout(statusTimer);
    statusEl.textContent = text;
    if (text === 'saved') statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }

  async function loadProjects() {
    const data = await api('GET', 'api/projects');
    projects = data.projects;
    render();
  }

  // Shared failure path: 409 reloads the list, anything else is reported plainly.
  async function handleError(err, target = setStatus) {
    if (err.status === 401) return;
    if (err.status === 409) {
      target('the data changed elsewhere. the list has been reloaded, check it and try again.');
      await loadProjects();
      return;
    }
    if (err.body && err.body.version) {
      // Saved privately but the public file failed: reflect the saved state.
      target(err.message);
      await loadProjects();
      return;
    }
    target(err.status ? `could not save: ${err.message}.` : 'could not reach the server. try again.');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  /* ---------- Per-language fields ----------
     index.html marks the ca control with data-langs; this adds an en and an es copy (one shown
     at a time) and a ca / en / es tab strip that also tells which languages are empty. */

  function langField(base, { onChange = () => {} } = {}) {
    const name = base.id.replace(/^f-/, '');
    const label = document.querySelector(`label[for="${base.id}"]`);
    const required = base.required;
    const statusEl = el('p', 'hint lang-status');
    statusEl.id = `${name}-langs`;
    statusEl.setAttribute('aria-live', 'polite');
    const list = base.getAttribute('list');
    const inputs = {};
    for (const lang of LANGS) {
      const input = lang === 'ca' ? base : base.cloneNode();
      input.id = `f-${name}-${lang}`;
      input.name = `${base.name}-${lang}`;
      input.lang = lang;
      input.removeAttribute('data-langs');
      input.setAttribute('aria-describedby', `${statusEl.id} ${base.getAttribute('aria-describedby')}`);
      if (lang !== 'ca') {
        input.required = false;
        input.hidden = true;
      }
      if (list) {
        input.setAttribute('list', `${list}-${lang}`);
        const datalist = el('datalist');
        datalist.id = `${list}-${lang}`;
        base.parentElement.append(datalist);
      }
      inputs[lang] = input;
    }
    base.after(inputs.en, inputs.es);
    label.htmlFor = inputs.ca.id;

    const strip = el('div', 'lang-tabs');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', `${label.textContent}: language`);
    const tabs = {};
    for (const lang of LANGS) {
      const tab = el('button', 'btn lang-tab');
      tab.type = 'button';
      tab.addEventListener('click', () => select(lang, { focus: true }));
      tabs[lang] = tab;
      strip.append(tab);
    }
    label.after(strip);
    (base.parentElement.querySelector('.field-error') || base.parentElement.lastElementChild).before(statusEl);

    let current = 'ca';
    const isEmpty = (lang) => !inputs[lang].value.trim();

    function refresh() {
      for (const lang of LANGS) {
        const note = lang === 'ca' && required ? 'required' : isEmpty(lang) ? 'empty' : '';
        tabs[lang].replaceChildren(document.createTextNode(lang));
        if (note) tabs[lang].append(' ', el('span', 'lang-tab__note', note));
        tabs[lang].setAttribute('aria-pressed', String(lang === current));
        const states = [lang === 'ca' && required ? 'required' : '', isEmpty(lang) ? 'empty' : ''].filter(Boolean);
        tabs[lang].setAttribute('aria-label', [lang, ...states].join(', '));
      }
      const fallback = LANGS.filter((lang) => lang !== 'ca' && isEmpty(lang));
      statusEl.textContent = fallback.length && !isEmpty('ca') ? `${fallback.join(', ')} empty: the site shows the ca text there.` : '';
    }

    function select(lang, { focus = false } = {}) {
      current = lang;
      for (const code of LANGS) inputs[code].hidden = code !== lang;
      label.htmlFor = inputs[lang].id;
      refresh();
      onChange();
      if (focus) inputs[lang].focus();
    }

    for (const lang of LANGS) {
      inputs[lang].addEventListener('input', () => {
        refresh();
        onChange();
      });
    }
    refresh();

    return {
      inputs,
      current: () => current,
      value: () => Object.fromEntries(LANGS.map((lang) => [lang, inputs[lang].value])),
      set(value) {
        for (const lang of LANGS) inputs[lang].value = (value && value[lang]) ?? '';
        select('ca');
      },
      select,
    };
  }

  // Server errors on per-language fields come keyed "<field>.<lang>": show that language.
  function errorInput(key, localized) {
    const [field, lang] = key.split('.');
    const group = localized[field];
    if (!group) return { field, input: $(`f-${field}`) };
    if (lang) group.select(lang);
    return { field, input: group.inputs[lang || 'ca'] };
  }

  // Live preview of one language of a rich-text field, with the parser and renderer the site uses.
  // Problems are listed above it; the server rejects the same ones on save.
  function renderPreview(source, preview, problems, options) {
    const { blocks, errors } = parseRichText(source);
    preview.replaceChildren(...renderRichText(blocks, options));
    problems.textContent = errors.length ? `not saved like this: ${errors.join(' ')}` : '';
  }

  for (const slot of document.querySelectorAll('[data-format-help]')) slot.replaceWith(formattingHelp());

  const langFields = {};
  for (const name of ['category', 'description', 'ai']) {
    langFields[name] = langField($(`f-${name}`), { onChange: () => updateCount() });
  }

  /* ---------- List ---------- */

  function button(label, action, ariaLabel) {
    const btn = el('button', 'btn', label);
    btn.type = 'button';
    btn.dataset.action = action;
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  }

  function renderRow(project, index) {
    const row = el('li', 'row');
    row.dataset.id = project.id;
    row.draggable = true;

    const info = el('div', 'row__info');
    const meta = el('span', 'row__meta', `${project.category.ca} / ${project.year} / `);
    const visible = project.visible !== false;
    meta.append(el('span', visible ? 'row__state' : 'row__state row__state--hidden', visible ? 'visible' : 'hidden'));
    info.append(el('span', 'row__title', project.title), meta);

    const actions = el('div', 'row__actions');
    const up = button('up', 'up', `move ${project.title} up`);
    const down = button('down', 'down', `move ${project.title} down`);
    up.disabled = index === 0;
    down.disabled = index === projects.length - 1;
    actions.append(button('edit', 'edit', `edit ${project.title}`), up, down, button('delete', 'delete', `delete ${project.title}`));

    row.append(info, actions);
    return row;
  }

  function render() {
    list.replaceChildren(...projects.map(renderRow));
    if (!projects.length) list.append(el('li', 'empty', 'no projects yet.'));
    for (const lang of LANGS) {
      const categories = [...new Set(projects.map((p) => p.category[lang]).filter(Boolean))].sort();
      $(`categories-${lang}`).replaceChildren(...categories.map((c) => Object.assign(document.createElement('option'), { value: c })));
    }
  }

  const rowButton = (id, action) => list.querySelector(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`);

  async function saveOrder(next, focus) {
    projects = next;
    render();
    if (focus) {
      const btn = rowButton(focus.id, focus.action);
      (btn && !btn.disabled ? btn : rowButton(focus.id, focus.action === 'up' ? 'down' : 'up'))?.focus();
    }
    try {
      await api('PUT', 'api/order', { ids: next.map((p) => p.id) });
      setStatus('saved');
    } catch (err) {
      await handleError(err);
      if (err.status !== 409 && err.status !== 401) await loadProjects();
    }
  }

  function move(id, delta, action) {
    const from = projects.findIndex((p) => p.id === id);
    const to = from + delta;
    if (to < 0 || to >= projects.length) return;
    const next = projects.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    saveOrder(next, { id, action });
  }

  function resetDelete(btn) {
    delete btn.dataset.confirm;
    btn.textContent = 'delete';
    btn.classList.remove('btn--danger');
    btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^confirm delete/, 'delete'));
  }

  async function onListClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const { id } = btn.closest('.row').dataset;
    const { action } = btn.dataset;
    if (action === 'up') move(id, -1, 'up');
    else if (action === 'down') move(id, 1, 'down');
    else if (action === 'edit') openForm(projects.find((p) => p.id === id), btn);
    else if (action === 'delete' && !btn.dataset.confirm) {
      btn.dataset.confirm = '1';
      btn.textContent = 'confirm delete';
      btn.classList.add('btn--danger');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^delete/, 'confirm delete'));
    } else if (action === 'delete') {
      try {
        const data = await api('DELETE', `api/projects/${encodeURIComponent(id)}`);
        projects = data.projects;
        render();
        $('new-project').focus();
        setStatus('deleted');
      } catch (err) {
        await handleError(err);
      }
    }
  }

  /* ---------- Drag and drop ---------- */

  function clearIndicators() {
    list.querySelectorAll('.drop-before, .drop-after').forEach((row) => row.classList.remove('drop-before', 'drop-after'));
  }

  const dropAfter = (row, event) => {
    const rect = row.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
  };

  list.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.row');
    if (!row) return;
    dragId = row.dataset.id;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragId);
  });

  list.addEventListener('dragover', (event) => {
    const row = event.target.closest('.row');
    if (!dragId || !row) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearIndicators();
    if (row.dataset.id !== dragId) row.classList.add(dropAfter(row, event) ? 'drop-after' : 'drop-before');
  });

  list.addEventListener('drop', (event) => {
    const row = event.target.closest('.row');
    if (!dragId || !row) return;
    event.preventDefault();
    const after = dropAfter(row, event);
    const targetId = row.dataset.id;
    const moving = projects.find((p) => p.id === dragId);
    clearIndicators();
    if (targetId === dragId) return;
    const next = projects.filter((p) => p.id !== dragId);
    next.splice(next.findIndex((p) => p.id === targetId) + (after ? 1 : 0), 0, moving);
    if (next.some((p, i) => p !== projects[i])) saveOrder(next);
  });

  list.addEventListener('dragend', () => {
    dragId = null;
    clearIndicators();
    list.querySelectorAll('.is-dragging').forEach((row) => row.classList.remove('is-dragging'));
  });

  /* ---------- Form ---------- */

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  }

  // Counts (and previews) the language on show.
  function updateCount() {
    const shown = (name) => langFields[name].inputs[langFields[name].current()].value;
    $('description-count').textContent = `${shown('description').length} / 200`;
    $('ai-count').textContent = `${shown('ai').length} / 5000`;
    // As in the project detail: subheadings sit under its "how I used AI" heading.
    renderPreview(shown('ai'), $('ai-preview'), $('ai-problems'), { linkClass: '', headingTag: 'h4' });
  }

  function openForm(project, trigger) {
    editingId = project ? project.id : null;
    returnFocus = trigger;
    clearErrors();
    $('editor-title').textContent = project ? `edit ${project.title}` : 'new project';
    for (const name of fields) $(`f-${name}`).value = project ? project[name] ?? '' : '';
    for (const [name, group] of Object.entries(langFields)) group.set(project ? project[name] : null);
    if (!project) $('f-year').value = String(new Date().getFullYear());
    $('f-visible').checked = project ? project.visible !== false : true;
    thumbInputs.forEach((input, i) => { input.value = project?.thumbs?.[i] ?? ''; });
    $('f-tools').value = (project?.tools ?? []).join(', ');
    updateCount();
    editor.hidden = false;
    $('f-title').focus();
  }

  function closeForm(focusTarget = returnFocus) {
    editor.hidden = true;
    editingId = null;
    (focusTarget && focusTarget.isConnected ? focusTarget : $('new-project')).focus();
  }

  function collect() {
    const year = $('f-year').value.trim();
    return {
      title: $('f-title').value,
      category: langFields.category.value(),
      year,
      description: langFields.description.value(),
      url: $('f-url').value.trim(),
      visible: $('f-visible').checked,
      thumbs: thumbInputs.map((input) => input.value.trim()).filter(Boolean),
      ai: langFields.ai.value(),
      tools: $('f-tools').value.split(',').map((tool) => tool.trim()).filter(Boolean),
    };
  }

  function showErrors(errors) {
    let first = null;
    for (const [key, message] of Object.entries(errors)) {
      const { field, input: fieldInput } = errorInput(key, first ? {} : langFields); // only the first error switches tabs
      const target = $(`e-${field}`) || $('form-error');
      target.textContent = target.textContent ? `${target.textContent} ${message}` : message;
      const input = field === 'thumbs' ? thumbInputs[0] : fieldInput || langFields[field]?.inputs.ca;
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        first ??= input;
      }
    }
    (first || $('form-error')).focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const wasEditing = editingId;
    try {
      const data = wasEditing
        ? await api('PUT', `api/projects/${encodeURIComponent(wasEditing)}`, collect())
        : await api('POST', 'api/projects', collect());
      projects = data.projects;
      render();
      closeForm(wasEditing ? rowButton(wasEditing, 'edit') : $('new-project'));
      setStatus('saved');
    } catch (err) {
      if (err.status === 400 && err.body.errors) showErrors(err.body.errors);
      else await handleError(err, (message) => { $('form-error').textContent = message; });
    }
  });

  $('cancel').addEventListener('click', () => closeForm());
  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeForm();
  });
  $('new-project').addEventListener('click', (event) => openForm(null, event.currentTarget));
  list.addEventListener('click', onListClick);
  list.addEventListener('focusout', (event) => {
    if (event.target.dataset.confirm) resetDelete(event.target);
  });

  /* ---------- Views: projects / some words ---------- */

  function showView(name) {
    for (const tab of document.querySelectorAll('.view-tab')) tab.setAttribute('aria-pressed', String(tab.dataset.view === name));
    $('view-projects').hidden = name !== 'projects';
    $('view-words').hidden = name !== 'words';
    if (name === 'words' && wordsVersion === null) loadWords().catch((err) => wordsFailed(err));
  }

  for (const tab of document.querySelectorAll('.view-tab')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }

  /* ---------- Some words ---------- */

  const words = langField($('f-words'), { onChange: () => renderWordsPreview() });
  let wordsVersion = null;
  let wordsTimer = 0;

  function setWordsStatus(text) {
    clearTimeout(wordsTimer);
    $('words-status').textContent = text;
    if (text === 'saved') wordsTimer = setTimeout(() => { $('words-status').textContent = ''; }, 3000);
  }

  // Live preview of the language on show, with the same parser and renderer as the home page.
  function renderWordsPreview() {
    const text = words.inputs[words.current()].value;
    $('words-count').textContent = `${text.length} / ${RICH_TEXT_MAX}`;
    renderPreview(text, $('words-preview'), $('preview-problems'));
  }

  async function loadWords({ keepDraft = false } = {}) {
    const data = await api('GET', 'api/some-words', undefined, { track: false });
    wordsVersion = data.version;
    if (!keepDraft) words.set(data.text);
    renderWordsPreview();
  }

  function wordsFailed(err, message) {
    if (err.status === 401) return;
    setWordsStatus(message || (err.status ? `could not load: ${err.message}.` : 'could not reach the server. try again.'));
  }

  function clearWordsError() {
    $('e-words').textContent = '';
    for (const input of Object.values(words.inputs)) input.removeAttribute('aria-invalid');
  }

  for (const input of Object.values(words.inputs)) input.addEventListener('input', clearWordsError);

  $('words-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearWordsError();
    try {
      const data = await api('PUT', 'api/some-words', { text: words.value() }, { ifMatch: wordsVersion, track: false });
      wordsVersion = data.version;
      const shown = words.current();
      words.set(data.text);
      words.select(shown);
      setWordsStatus('saved');
    } catch (err) {
      if (err.status === 401) return;
      if (err.status === 400 && err.body.errors) {
        $('e-words').textContent = Object.values(err.body.errors).join(' ');
        const { input } = errorInput(Object.keys(err.body.errors)[0], { text: words });
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      } else if (err.status === 409) {
        // Like projects: reload what is saved. The draft stays in the box so nothing typed is lost.
        await loadWords({ keepDraft: true }).catch(() => {});
        setWordsStatus('the text changed elsewhere. your draft is still here; saving again replaces the other version.');
      } else if (err.body && err.body.version) {
        wordsVersion = err.body.version; // saved privately, public copy pending
        setWordsStatus(err.message);
      } else {
        wordsFailed(err, err.status ? `could not save: ${err.message}.` : 'could not reach the server. try again.');
      }
    }
  });

  /* ---------- Session ---------- */

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('POST', 'api/login', { password: $('password').value });
      await showApp();
    } catch (err) {
      const messages = { 401: 'wrong password.', 429: 'too many attempts. wait 15 minutes and try again.' };
      showLogin(messages[err.status] || 'could not log in. try again.');
    }
  });

  $('logout').addEventListener('click', async () => {
    await api('POST', 'api/logout').catch(() => {});
    version = null;
    wordsVersion = null;
    showLogin();
  });

  api('GET', 'api/session')
    .then(({ loggedIn }) => (loggedIn ? showApp() : showLogin()))
    .catch((err) => {
      if (err.status !== 401) showLogin('could not reach the server. try again.');
    });
})();
