// Language switcher (top-right tabs, rendered by scripts/build-pages.mjs). Each link carries
// the equivalent page in its language (data-lang-path); right before it is used, the link
// picks up the current state: the home section (#hash) or the open project (<list path><id>/).
import { projectHref, projectIdFrom } from './project-url.js';

// Pure: the target page plus the state worth keeping. Query parameters are dropped.
// listPath: this page's projects list path (projects pages only), to find the open project, which is
// kept in the path form (a legacy ?p=<id> too).
export function switchHref(path, { pathname = '', search = '', hash = '' } = {}, listPath = null) {
  const project = listPath ? projectIdFrom(listPath, { pathname, search }) : null;
  return `${project ? projectHref(path, project) : path}${hash}`;
}

// Updated on hover, focus and press (capture phase), so a click, a middle click or
// "copy link" all get the current state without tracking every history change.
export function bindLangLinks(nav, { listPath = null } = {}) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[data-lang-path]')];
  const sync = () => {
    for (const link of links) link.href = switchHref(link.dataset.langPath, window.location, listPath);
  };
  for (const type of ['mouseover', 'focusin', 'pointerdown', 'click', 'contextmenu']) {
    nav.addEventListener(type, sync, true);
  }
  sync();
}
