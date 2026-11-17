// "Ask me": a button (bottom right) that opens a small chat about Roger's work, answered by the admin
// (POST /admin/api/ask, admin/lib/ask.js). Only on pages whose <body> has data-ask (the home and the
// pages for companies). The conversation lives here only; nothing is stored. UI strings: js.ask_* keys.
import { el } from './dom.js';

const ENDPOINT = '/admin/api/ask';
const MAX_QUESTION = 500; // as admin/lib/ask.js
const KEEP = 10; // earlier messages sent along with a question (the server takes up to 12 in all)

export function bindAsk({ t, lang }) {
  if (!document.body.hasAttribute('data-ask')) return;

  const toggle = el('button', 'ask-toggle', t('ask_open'));
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'ask-panel');

  const panel = el('section', 'ask');
  panel.id = 'ask-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'ask-title');
  panel.dataset.ownScroll = ''; // the home's section paging leaves it alone (js/home.js)
  const head = el('div', 'ask__head');
  const title = el('h2', 'ask__title', t('ask_title'));
  title.id = 'ask-title';
  const close = el('button', 'ask__close', t('ask_close'));
  close.type = 'button';
  head.append(title, close);
  const log = el('ol', 'ask__log');
  log.setAttribute('aria-live', 'polite');
  log.dataset.lenisPrevent = ''; // the projects pages' smooth scroll leaves it alone
  log.append(el('li', 'ask__intro', t('ask_intro')));
  const form = el('form', 'ask__form');
  const input = el('textarea', 'ask__input');
  input.rows = 2;
  input.maxLength = MAX_QUESTION;
  input.placeholder = t('ask_placeholder');
  input.setAttribute('aria-label', t('ask_placeholder'));
  const send = el('button', 'ask__send', t('ask_send'));
  send.type = 'submit';
  form.append(input, send);
  panel.append(head, log, form);
  document.body.append(toggle, panel);

  let history = [];
  let busy = false;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else toggle.focus();
  };

  function say(role, text) {
    const item = el('li', `ask__msg ask__msg--${role}`);
    item.append(el('span', 'ask__who', role === 'user' ? t('ask_you') : t('ask_bot')), el('p', 'ask__text', text));
    log.append(item);
    log.scrollTop = log.scrollHeight;
    return item;
  }

  async function ask(question) {
    busy = true;
    send.disabled = true;
    say('user', question);
    const pending = say('bot', t('ask_thinking'));
    pending.classList.add('ask__msg--pending');
    const messages = [...history.slice(-KEEP), { role: 'user', content: question }];
    let answer = null;
    let code = 'error';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ lang, messages }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json.answer === 'string') answer = json.answer;
      else if (['rate', 'daily', 'declined'].includes(json.code)) code = json.code;
    } catch {
      /* network: the generic message */
    }
    pending.classList.remove('ask__msg--pending');
    pending.querySelector('.ask__text').textContent = answer ?? t(`ask_${code}`);
    if (answer) history = [...messages, { role: 'assistant', content: answer }]; // a failed question is not kept
    log.scrollTop = log.scrollHeight;
    busy = false;
    send.disabled = false;
    input.focus();
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = '';
    ask(question);
  });
  // Enter sends, Shift+Enter breaks the line.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}
