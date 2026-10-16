// Renders parseRichText() blocks into <p> elements (browser only: the admin preview and the home).
// DOM + textContent only, never innerHTML. A paragraph that is just one link gets "link-only"
// so it sits flush (no side padding on the link).
export function renderRichText(blocks, { linkClass = 'wipe-link', paragraphClass = '' } = {}) {
  return blocks.map((block) => {
    const p = document.createElement('p');
    if (paragraphClass) p.className = paragraphClass;
    for (const part of block.parts) {
      if (part.type === 'text') p.append(document.createTextNode(part.value));
      else if (part.type === 'br') p.append(document.createElement('br'));
      else if (part.type === 'link') {
        const a = document.createElement('a');
        a.className = linkClass;
        a.href = part.href;
        a.textContent = part.label;
        if (/^https?:/i.test(part.href)) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        p.append(a);
      }
    }
    if (block.parts.length === 1 && block.parts[0].type === 'link') p.classList.add('link-only');
    return p;
  });
}
