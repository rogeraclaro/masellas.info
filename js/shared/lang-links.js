// Language switcher (top-right tabs, rendered by scripts/build-pages.mjs). Each link carries
// the equivalent page in its language (data-lang-path); right before it is used, the link
// picks up the current state: the home section (#hash) or the open project (?p=).

// Pure: the target page plus the state worth keeping. Other query parameters are dropped.
export function switchHref(path, { search = '', hash = '' } = {}) {
  const project = new URLSearchParams(search).get('p');
  const query = project ? `?${new URLSearchParams({ p: project })}` : '';
  return `${path}${query}${hash}`;
}

// Updated on hover, focus and press (capture phase), so a click, a middle click or
// "copy link" all get the current state without tracking every history change.
export function bindLangLinks(nav) {
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[data-lang-path]')];
  const sync = () => {
    for (const link of links) link.href = switchHref(link.dataset.langPath, window.location);
  };
  for (const type of ['mouseover', 'focusin', 'pointerdown', 'click', 'contextmenu']) {
    nav.addEventListener(type, sync, true);
  }
  sync();
}
