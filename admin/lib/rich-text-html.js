// Renders rich text (rich-text.js) to an HTML string, with the same markup as rich-text-dom.js: the
// static copies for crawlers (the home's "some words" fallback in scripts/build-pages.mjs, the project
// pages in seo-pages.js). Pure. Throws on text the parser reports as malformed.
// No glossary here: {{term|explanation}} becomes a tooltip term, a bare {{term}} just its text
// (published texts are already resolved).
import { parseRichText } from './rich-text.js';

export const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(parts, linkClass, ids) {
  return parts.map((part) => {
    if (part.type === 'term') {
      if (!part.explanation) return escapeHtml(part.label);
      const id = `term-static-${(ids.count += 1)}`;
      return `<button type="button" class="term" aria-describedby="${id}">${escapeHtml(part.label)}</button><span id="${id}" hidden>${escapeHtml(part.explanation)}</span>`;
    }
    if (part.type === 'br') return '<br>';
    if (part.type === 'text') return escapeHtml(part.value);
    if (part.type === 'code') return `<code>${escapeHtml(part.value)}</code>`;
    if (part.type === 'strong' || part.type === 's') return `<${part.type}>${inlineHtml(part.parts, linkClass, ids)}</${part.type}>`;
    const external = /^https?:/i.test(part.href) ? ' target="_blank" rel="noopener"' : '';
    return `<a class="${linkClass}" href="${escapeHtml(part.href)}"${external}>${inlineHtml(part.parts, linkClass, ids)}</a>`;
  }).join('');
}

export function richTextHtml(text, { paragraphClass = '', linkClass = 'wipe-link', headingTag = 'h3' } = {}) {
  const { blocks, errors } = parseRichText(text);
  if (errors.length) throw new Error(errors.join(' '));
  const ids = { count: 0 };
  const inline = (parts) => inlineHtml(parts, linkClass, ids);
  const open = (tag) => `<${tag}${paragraphClass ? ` class="${paragraphClass}"` : ''}>`;
  return blocks.map((block) => {
    if (block.type === 'h') return `${open(headingTag)}${inline(block.parts)}</${headingTag}>`;
    if (block.type === 'ul') return `${open('ul')}${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
    if (block.type === 'quote') return `${open('blockquote')}<p>${inline(block.parts)}</p></blockquote>`;
    return `${open('p')}${inline(block.parts)}</p>`;
  }).join('\n');
}
