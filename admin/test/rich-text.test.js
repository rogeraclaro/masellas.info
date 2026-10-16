import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText } from '../lib/rich-text.js';

const text = (value) => ({ type: 'text', value });
const br = { type: 'br' };
const link = (label, href) => ({ type: 'link', label, href });

test('blank lines split paragraphs; extra blank lines and edge whitespace are ignored', () => {
  const { blocks, errors } = parseRichText('One.\n\nTwo.\n\n\n  \nThree.\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks, [
    { type: 'p', parts: [text('One.')] },
    { type: 'p', parts: [text('Two.')] },
    { type: 'p', parts: [text('Three.')] },
  ]);
});

test('a single newline inside a paragraph becomes a line break; CRLF is normalised', () => {
  const { blocks } = parseRichText('Line one\r\nline two');
  assert.deepEqual(blocks, [{ type: 'p', parts: [text('Line one'), br, text('line two')] }]);
});

test('inner spacing is kept exactly', () => {
  const { blocks } = parseRichText('Lamosca I \u001fFirst  directed');
  assert.equal(blocks[0].parts[0].value, 'Lamosca I \u001fFirst  directed');
});

test('markdown links: http, https and mailto, with text around them', () => {
  const { blocks, errors } = parseRichText('Studio [Lamosca sccl](https://www.lamosca.com). Mail [me](mailto:roger@lamosca.com) or [old](http://example.com/a_(b)).');
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks[0].parts, [
    text('Studio '),
    link('Lamosca sccl', 'https://www.lamosca.com'),
    text('. Mail '),
    link('me', 'mailto:roger@lamosca.com'),
    text(' or '),
    link('old', 'http://example.com/a_(b)'),
    text('.'),
  ]);
});

test('a paragraph can be only a link', () => {
  const { blocks } = parseRichText('[roger at lamosca.com](mailto:roger@lamosca.com)');
  assert.deepEqual(blocks, [{ type: 'p', parts: [link('roger at lamosca.com', 'mailto:roger@lamosca.com')] }]);
});

test('parentheses and plain text without brackets are just text', () => {
  const { blocks, errors } = parseRichText('projects (and debates) for many clients');
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks[0].parts, [text('projects (and debates) for many clients')]);
});

const rejected = [
  ['[x](javascript:alert(1))', /\[x\]\(javascript:alert\(1\)\).*http.*https.*mailto/],
  ['[x](data:text/html,hi)', /only http/],
  ['[x](ftp://example.com)', /only http/],
  ['[x](/relative/path)', /not a valid|full url/i],
  ['[x](www.example.com)', /not a valid|full url/i],
  ['[x](https://)', /not a valid|full url/i],
  ['[x](mailto:)', /address/i],
  ['[](https://example.com)', /empty/i],
  ['[x]()', /empty|missing/i],
  ['[x](https://exa mple.com)', /malformed|space/i],
  ['an [unclosed link', /\[unclosed link/],
  ['a stray ] bracket', /\]/],
  ['[a [b](https://b.example)](https://a.example)', /malformed|nested/i],
  ['[x] (https://example.com)', /malformed/i],
];

for (const [input, message] of rejected) {
  test(`rejects ${JSON.stringify(input)}`, () => {
    const { errors } = parseRichText(input);
    assert.ok(errors.length >= 1, 'expected an error');
    assert.match(errors.join(' | '), message);
  });
}

test('errors still return the text so a preview can show it', () => {
  const { blocks, errors } = parseRichText('see [x](javascript:void(0)) now');
  assert.equal(errors.length, 1);
  assert.equal(blocks[0].parts.map((part) => part.value || part.label).join(''), 'see [x](javascript:void(0)) now');
});

test('empty or whitespace-only text gives no paragraphs', () => {
  assert.deepEqual(parseRichText('').blocks, []);
  assert.deepEqual(parseRichText('  \n\n ').blocks, []);
});
