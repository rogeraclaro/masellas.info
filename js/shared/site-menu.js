// Burger menu for phones (css/shared/menu.css shows .menu-toggle up to 640px). The toggle opens
// #site-menu, which holds the section and language tabs; html.menu-open drives the CSS.
// Escape closes it and refocuses the toggle; any click that is not on the toggle (a link,
// the panel background, the page) closes it. Wider screens never show the toggle.

export function bindSiteMenu() {
  const root = document.documentElement;
  const toggle = document.querySelector('.menu-toggle');
  if (!toggle || !document.getElementById(toggle.getAttribute('aria-controls'))) return { isOpen: () => false };

  const isOpen = () => root.classList.contains('menu-open');
  const setOpen = (open) => {
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  document.addEventListener('click', (event) => {
    if (isOpen() && !toggle.contains(event.target)) setOpen(false);
  });
  // Capture phase + preventDefault: page Escape handlers (the project detail) skip this one.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus();
  }, true);
  window.matchMedia('(max-width: 640px)').addEventListener('change', (event) => {
    if (!event.matches) setOpen(false);
  });
  // Never snapshot (view transition) or restore (back/forward cache) a page with the menu open.
  window.addEventListener('pageswap', () => setOpen(false));
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) setOpen(false);
  });

  return { isOpen };
}
