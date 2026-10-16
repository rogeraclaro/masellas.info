// GSAP defaults shared by every page. Returns the brand "alpha" ease name
// (a close built-in stand-in when CustomEase did not load).
export function setupGsap(gsap) {
  gsap.defaults({ ease: 'none' });
  if (!window.CustomEase) return 'power1.out';
  gsap.registerPlugin(window.CustomEase);
  window.CustomEase.create('masellas.alpha', '.25, .46, .45, .9');
  return 'masellas.alpha';
}
