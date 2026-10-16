// Resolves when the cross-page view transition (if any) has finished, so a page's own
// intro plays after the slide instead of under it. Set by js/page-transition.js.
export function pageReady() {
  return window.masellasPageReady || Promise.resolve();
}
