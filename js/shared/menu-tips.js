// Tooltips on the menu tabs (the projects (B.C.) tab). The text is the glossary term the admin
// publishes as /projects/data/menu.<lang>.json ({ tooltips: { <key>: text } }). A tab with
// data-menu-tip="<key>" points through aria-describedby at a hidden element (scripts/build-pages.mjs
// renders both, empty); this fills it, and admin/lib/term-tooltip.js shows it (data-term-link: hover
// and keyboard focus only, a tap just follows the link). Empty text or a failed fetch: no tooltip.

// Absolute, so /en/ and /es/ pages read the same data folder.
export const menuTipUrl = (lang) => `/projects/data/menu.${lang}.json`;

// Pure: the tooltip for one tab, or '' for anything missing or malformed.
export function tipText(json, key) {
  const tooltips = json?.tooltips;
  const text = tooltips && Object.hasOwn(tooltips, key) ? tooltips[key] : '';
  return typeof text === 'string' ? text.trim() : '';
}

export async function loadMenuTips(lang) {
  const tabs = [...document.querySelectorAll('[data-menu-tip]')];
  if (!tabs.length) return;
  let json;
  try {
    const response = await fetch(menuTipUrl(lang), { cache: 'no-store' });
    if (!response.ok) return;
    json = await response.json();
  } catch {
    return;
  }
  for (const tab of tabs) {
    const target = document.getElementById(tab.getAttribute('aria-describedby') ?? '');
    if (target) target.textContent = tipText(json, tab.dataset.menuTip);
  }
}
