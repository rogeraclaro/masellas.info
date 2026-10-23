// Project url slugs (the id in /projects/<slug>/). Pure, no imports: the server validates with it
// and the admin UI pre-fills the slug field from the title with the same slugify.

export const SLUG_MAX = 60;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Folders the site already has under /projects/, where each project also gets /projects/<slug>/.
const RESERVED = new Set(['data', 'css', 'js']);

// Title -> slug: accents dropped, lowercase, anything else becomes single hyphens.
export function slugify(title) {
  const slug = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '');
  if (RESERVED.has(slug)) return `${slug}-project`;
  return slug || 'project';
}

// Returns { value } or { error }. Trims; otherwise the slug must already be in its final form.
export function checkSlug(value) {
  const slug = typeof value === 'string' ? value.trim() : '';
  if (!slug) return { error: 'url slug is required' };
  if (slug.length > SLUG_MAX) return { error: `url slug must be ${SLUG_MAX} characters or fewer` };
  if (!SLUG.test(slug)) return { error: 'url slug: use lowercase letters a-z, digits 0-9 and single hyphens, not at the start or end' };
  if (RESERVED.has(slug)) return { error: `url slug "${slug}" is reserved by the site` };
  return { value: slug };
}
