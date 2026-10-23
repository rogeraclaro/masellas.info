// Project detail URLs: <list path><id>/ (e.g. /en/projects/ledger/, a page the admin writes for
// crawlers), plus the legacy <list path>?p=<id>. Pure.

export const projectHref = (listPath, id) => `${listPath}${encodeURIComponent(id)}/`;

// The project id in a location ({ pathname, search }): the path segment right after the list path,
// else the legacy ?p=. null when there is none.
export function projectIdFrom(listPath, { pathname = '', search = '' } = {}) {
  if (listPath && pathname.startsWith(listPath)) {
    const match = /^([^/]+)\/?$/.exec(pathname.slice(listPath.length));
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }
  return new URLSearchParams(search).get('p') || null;
}
