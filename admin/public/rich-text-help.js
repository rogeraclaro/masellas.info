/* "formatting help": a collapsible table of the rich-text styles, shown under every rich-text field.
   Each example is rendered with the real parser and renderer. Open by default; the open / closed
   state is remembered (shared by every copy) in localStorage when it is available. */
import { parseRichText } from './rich-text.js';
import { renderRichText } from './rich-text-dom.js';

const KEY = 'admin:formatting-help-open';
const EXAMPLES = [
  ['paragraph (blank line)', 'first paragraph\n\nsecond paragraph'],
  ['line break (single newline)', 'first line\nsecond line'],
  ['subheading', '## what I did'],
  ['list', '- one thing\n- another'],
  ['quote', '> make it boring'],
  ['bold', '**important**'],
  ['strikethrough', '~~old plan~~'],
  ['code (taken literally)', '`npm test`'],
  ['link', '[my site](https://masellas.info)'],
  ['email link', '[write me](mailto:roger@lamosca.com)'],
  ['escape: \\ before * ~ ` [ ] ( ) > - # \\', '\\*not bold\\*'],
];

const instances = new Set();
let isOpen = null; // shared state; "toggle" also fires (async) for the initial value, so compare with it

function readOpen() {
  try {
    return localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
}

function saveOpen(open) {
  try {
    localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch { /* storage blocked: keep the default */ }
}

function cell(tag, ...children) {
  const node = document.createElement(tag);
  node.append(...children);
  return node;
}

export function formattingHelp() {
  const details = document.createElement('details');
  details.className = 'format-help';
  if (isOpen === null) isOpen = readOpen();
  details.open = isOpen;
  details.append(cell('summary', 'formatting help'));

  const table = document.createElement('table');
  table.className = 'format-help__table';
  const head = cell('tr', ...['style', 'type this', 'you get'].map((label) => {
    const th = cell('th', label);
    th.scope = 'col';
    return th;
  }));
  const rows = EXAMPLES.map(([style, source]) => {
    const th = cell('th', style);
    th.scope = 'row';
    const code = cell('code', source);
    code.className = 'format-help__source';
    const result = cell('div', ...renderRichText(parseRichText(source).blocks, { linkClass: '' }));
    result.className = 'rich-text format-help__result';
    return cell('tr', th, cell('td', code), cell('td', result));
  });
  table.append(cell('thead', head), cell('tbody', ...rows));
  const scroller = cell('div', table);
  scroller.className = 'format-help__scroller';
  details.append(scroller);

  details.addEventListener('toggle', () => {
    if (details.open === isOpen) return;
    isOpen = details.open;
    saveOpen(isOpen);
    for (const other of instances) other.open = isOpen;
  });
  instances.add(details);
  return details;
}
