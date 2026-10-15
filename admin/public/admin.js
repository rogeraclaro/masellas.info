/* Projects admin UI. Vanilla JS; all user data goes through textContent, never innerHTML. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const loginView = $('login');
  const appView = $('app');
  const list = $('list');
  const statusEl = $('status');
  const editor = $('editor');
  const form = $('project-form');
  const fields = ['title', 'category', 'year', 'description', 'url'];
  const thumbInputs = [...document.querySelectorAll('.thumb')];

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

  async function api(method, path, body) {
    const headers = {};
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && version) headers['If-Match'] = version;
    const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== 'api/login') {
      showLogin();
      throw new ApiError(401, data);
    }
    if (!res.ok) throw new ApiError(res.status, data);
    if (data.version) version = data.version;
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

  /* ---------- List ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

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
    const meta = el('span', 'row__meta', `${project.category} / ${project.year} / `);
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
    const categories = [...new Set(projects.map((p) => p.category))].sort();
    $('categories').replaceChildren(...categories.map((c) => Object.assign(document.createElement('option'), { value: c })));
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

  function updateCount() {
    $('description-count').textContent = `${$('f-description').value.length} / 200`;
  }

  function openForm(project, trigger) {
    editingId = project ? project.id : null;
    returnFocus = trigger;
    clearErrors();
    $('editor-title').textContent = project ? `edit ${project.title}` : 'new project';
    for (const name of fields) $(`f-${name}`).value = project ? project[name] ?? '' : '';
    if (!project) $('f-year').value = String(new Date().getFullYear());
    $('f-visible').checked = project ? project.visible !== false : true;
    thumbInputs.forEach((input, i) => { input.value = project?.thumbs?.[i] ?? ''; });
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
      category: $('f-category').value,
      year,
      description: $('f-description').value,
      url: $('f-url').value.trim(),
      visible: $('f-visible').checked,
      thumbs: thumbInputs.map((input) => input.value.trim()).filter(Boolean),
    };
  }

  function showErrors(errors) {
    let first = null;
    for (const [field, message] of Object.entries(errors)) {
      const target = $(`e-${field}`) || $('form-error');
      target.textContent = target.textContent ? `${target.textContent} ${message}` : message;
      const input = field === 'thumbs' ? thumbInputs[0] : $(`f-${field}`);
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

  $('f-description').addEventListener('input', updateCount);
  $('cancel').addEventListener('click', () => closeForm());
  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeForm();
  });
  $('new-project').addEventListener('click', (event) => openForm(null, event.currentTarget));
  list.addEventListener('click', onListClick);
  list.addEventListener('focusout', (event) => {
    if (event.target.dataset.confirm) resetDelete(event.target);
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
    showLogin();
  });

  api('GET', 'api/session')
    .then(({ loggedIn }) => (loggedIn ? showApp() : showLogin()))
    .catch((err) => {
      if (err.status !== 401) showLogin('could not reach the server. try again.');
    });
})();
