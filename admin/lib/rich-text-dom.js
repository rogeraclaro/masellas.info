// Renders parseRichText() blocks into elements (browser only: the admin previews and help, the home
// and the project detail). DOM + textContent only, never innerHTML.
//   blockClass   class on every top-level block (the home animates them)
//   linkClass    class on links
//   headingTag   element for "## " subheadings (h3; one level below the section's own heading)
// A paragraph that is just one link gets "link-only" so it sits flush (no side padding on the link).

function renderInline(parts, linkClass) {
  return parts.map((part) => {
    if (part.type === 'text') return document.createTextNode(part.value);
    if (part.type === 'br') return document.createElement('br');
    if (part.type === 'code') {
      const code = document.createElement('code');
      code.textContent = part.value;
      return code;
    }
    if (part.type === 'strong' || part.type === 's') {
      const node = document.createElement(part.type);
      node.append(...renderInline(part.parts, linkClass));
      return node;
    }
    // link
    const a = document.createElement('a');
    if (linkClass) a.className = linkClass;
    a.href = part.href;
    a.append(...renderInline(part.parts, linkClass));
    if (/^https?:/i.test(part.href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  });
}

function element(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function renderRichText(blocks, { linkClass = 'wipe-link', paragraphClass = '', blockClass = paragraphClass, headingTag = 'h3' } = {}) {
  return blocks.map((block) => {
    if (block.type === 'h') return element(headingTag, blockClass, renderInline(block.parts, linkClass));
    if (block.type === 'ul') {
      return element('ul', blockClass, block.items.map((item) => element('li', '', renderInline(item, linkClass))));
    }
    if (block.type === 'quote') return element('blockquote', blockClass, [element('p', '', renderInline(block.parts, linkClass))]);
    const p = element('p', blockClass, renderInline(block.parts, linkClass));
    if (block.parts.length === 1 && block.parts[0].type === 'link') p.classList.add('link-only');
    return p;
  });
}
