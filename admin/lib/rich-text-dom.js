// Renders parseRichText() blocks into elements (browser only: the admin previews and help, the home
// and the project detail). DOM + textContent only, never innerHTML.
//   blockClass   class on every top-level block (the home animates them)
//   linkClass    class on links
//   headingTag   element for "## " subheadings (h3; one level below the section's own heading)
//   lookup       key -> explanation for {{term}}s without their own (published texts are already
//                resolved; the admin previews pass the glossary). A term with no explanation is plain text.
// A term is <button class="term" aria-describedby> plus a hidden element with the explanation;
// term-tooltip.js shows it.

let termCount = 0;

function renderTerm(part, lookup) {
  const explanation = part.explanation ?? (lookup ? lookup(part.key) : null);
  if (!explanation) return [document.createTextNode(part.label)];
  const description = document.createElement('span');
  description.id = `term-${(termCount += 1)}`;
  description.hidden = true;
  description.textContent = explanation;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'term';
  button.setAttribute('aria-describedby', description.id);
  button.textContent = part.label;
  return [button, description];
}

function renderInline(parts, linkClass, lookup) {
  return parts.flatMap((part) => {
    if (part.type === 'term') return renderTerm(part, lookup);
    if (part.type === 'text') return document.createTextNode(part.value);
    if (part.type === 'br') return document.createElement('br');
    if (part.type === 'code') {
      const code = document.createElement('code');
      code.textContent = part.value;
      return code;
    }
    if (part.type === 'strong' || part.type === 's') {
      const node = document.createElement(part.type);
      node.append(...renderInline(part.parts, linkClass, lookup));
      return node;
    }
    // link
    const a = document.createElement('a');
    if (linkClass) a.className = linkClass;
    a.href = part.href;
    a.append(...renderInline(part.parts, linkClass, lookup));
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

export function renderRichText(blocks, { linkClass = 'wipe-link', paragraphClass = '', blockClass = paragraphClass, headingTag = 'h3', lookup = null } = {}) {
  return blocks.map((block) => {
    if (block.type === 'h') return element(headingTag, blockClass, renderInline(block.parts, linkClass, lookup));
    if (block.type === 'ul') {
      return element('ul', blockClass, block.items.map((item) => element('li', '', renderInline(item, linkClass, lookup))));
    }
    if (block.type === 'quote') return element('blockquote', blockClass, [element('p', '', renderInline(block.parts, linkClass, lookup))]);
    return element('p', blockClass, renderInline(block.parts, linkClass, lookup));
  });
}
