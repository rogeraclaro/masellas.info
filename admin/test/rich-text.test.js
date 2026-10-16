import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText } from '../lib/rich-text.js';

const text = (value) => ({ type: 'text', value });
const br = { type: 'br' };
const link = (label, href) => ({ type: 'link', href, parts: typeof label === 'string' ? [text(label)] : label });
const strong = (...parts) => ({ type: 'strong', parts });
const strike = (...parts) => ({ type: 's', parts });
const code = (value) => ({ type: 'code', value });
const p = (...parts) => ({ type: 'p', parts });
const parse = (input) => {
  const result = parseRichText(input);
  assert.deepEqual(result.errors, [], `no errors for ${JSON.stringify(input)}`);
  return result.blocks;
};

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
  assert.equal(blocks[0].parts.map((part) => part.value).join(''), 'see [x](javascript:void(0)) now');
});

test('empty or whitespace-only text gives no paragraphs', () => {
  assert.deepEqual(parseRichText('').blocks, []);
  assert.deepEqual(parseRichText('  \n\n ').blocks, []);
});

/* ---------- Blocks: subheading, list, quote ---------- */

test('a one-line block starting with "## " is a subheading, with inline styles', () => {
  assert.deepEqual(parse('## What I do\n\nText.'), [{ type: 'h', parts: [text('What I do')] }, p(text('Text.'))]);
  assert.deepEqual(parse('## **Now** and ~~then~~'), [{ type: 'h', parts: [strong(text('Now')), text(' and '), strike(text('then'))] }]);
});

test('"##" without a space, or a longer block starting with "## ", stays a paragraph', () => {
  assert.deepEqual(parse('##tag'), [p(text('##tag'))]);
  assert.deepEqual(parse('## one\ntwo'), [p(text('## one'), br, text('two'))]);
});

test('a block where every line starts with "- " is a list; items take inline styles', () => {
  assert.deepEqual(parse('- one\n- **two**\n- [three](https://three.example)'), [{
    type: 'ul',
    items: [[text('one')], [strong(text('two'))], [link('three', 'https://three.example')]],
  }]);
});

test('a block mixing "- " lines with other lines is an error that explains the fix, and still renders', () => {
  const { blocks, errors } = parseRichText('Tools I use:\n- Claude\n- Cursor');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /list/i);
  assert.match(errors[0], /Tools I use/);
  assert.match(errors[0], /blank line/);
  assert.match(errors[0], /\\-/);
  assert.equal(blocks[0].type, 'p');
});

test('a block where every line starts with "> " is a quote: one paragraph, lines joined with breaks', () => {
  assert.deepEqual(parse('> Make it boring.\n> **Then** ship it.'), [{
    type: 'quote',
    parts: [text('Make it boring.'), br, strong(text('Then')), text(' ship it.')],
  }]);
});

test('a block mixing "> " lines with others stays a paragraph (no error)', () => {
  assert.deepEqual(parse('> one\ntwo'), [p(text('> one'), br, text('two'))]);
});

/* ---------- Inline: bold, strikethrough, code ---------- */

test('bold, strikethrough and code', () => {
  assert.deepEqual(parse('a **b** c ~~d~~ e `f` g'), [p(
    text('a '), strong(text('b')), text(' c '), strike(text('d')), text(' e '), code('f'), text(' g'),
  )]);
});

test('code content is literal: no styles, links or escapes inside, and no link errors', () => {
  assert.deepEqual(parse('run `**x** [a](javascript:1) \\* ~~y~~`'), [p(text('run '), code('**x** [a](javascript:1) \\* ~~y~~'))]);
});

test('bold and strikethrough can contain each other, links and code', () => {
  assert.deepEqual(parse('**bold [link](https://l.example) and ~~gone `c`~~**'), [p(strong(
    text('bold '), link('link', 'https://l.example'), text(' and '), strike(text('gone '), code('c')),
  ))]);
  assert.deepEqual(parse('~~old **bold**~~'), [p(strike(text('old '), strong(text('bold'))))]);
});

test('a link label can contain bold, strikethrough and code', () => {
  assert.deepEqual(parse('[**Lamosca** ~~sl~~ `sccl`](https://www.lamosca.com)'), [p(
    link([strong(text('Lamosca')), text(' '), strike(text('sl')), text(' '), code('sccl')], 'https://www.lamosca.com'),
  )]);
});

test('a lone * or ~ is just text', () => {
  assert.deepEqual(parse('5 * 3 ~ 15, a*b, ~x'), [p(text('5 * 3 ~ 15, a*b, ~x'))]);
});

/* ---------- Escapes ---------- */

test('a backslash makes * ~ \\ ` [ ] ( ) > - # literal', () => {
  assert.deepEqual(parse('\\*\\*not bold\\*\\* \\~\\~no\\~\\~ \\`no\\` \\[no\\](link) \\(x\\) \\\\'), [p(text('**not bold** ~~no~~ `no` [no](link) (x) \\'))]);
  assert.deepEqual(parse('\\- not a list\n\\- really'), [p(text('- not a list'), br, text('- really'))]);
  assert.deepEqual(parse('\\## not a heading'), [p(text('## not a heading'))]);
  assert.deepEqual(parse('\\> not a quote'), [p(text('> not a quote'))]);
});

test('a backslash before any other character stays as typed', () => {
  assert.deepEqual(parse('C:\\temp \\n'), [p(text('C:\\temp \\n'))]);
});

test('an escaped bracket inside a link label is literal', () => {
  assert.deepEqual(parse('[a \\] b](https://x.example)'), [p(link('a ] b', 'https://x.example'))]);
});

/* ---------- Errors ---------- */

const unclosed = [
  ['this is **bold', /unclosed "\*\*".*\*\*bold/],
  ['this is ~~gone', /unclosed "~~".*~~gone/],
  ['run `npm test', /unclosed "`".*`npm test/],
  ['**open [link](https://x.example)', /unclosed "\*\*"/],
];

for (const [input, message] of unclosed) {
  test(`reports ${JSON.stringify(input)} and keeps the text`, () => {
    const { blocks, errors } = parseRichText(input);
    assert.equal(errors.length, 1, errors.join(' | '));
    assert.match(errors[0], message);
    assert.equal(blocks.length, 1);
  });
}

test('styles do not run across a line break: each line closes its own', () => {
  const { errors } = parseRichText('**one\ntwo**');
  assert.equal(errors.length, 2);
});

test('unclosed styles inside list items and quotes are reported too', () => {
  assert.equal(parseRichText('- **a\n- b').errors.length, 1);
  assert.equal(parseRichText('> ~~a').errors.length, 1);
  assert.match(parseRichText('- [x](javascript:1)').errors[0], /only http/);
});

test('plain texts parse exactly as before (one text part per line)', () => {
  const plain = 'Claude wrote the first pass of the invoice parser. I rewrote the edge cases: VAT on partial hours, credit notes.\n\nCursor did most of the boring CRUD - while I watched (the tests).\nNumbers are mine.';
  assert.deepEqual(parse(plain), [
    p(text('Claude wrote the first pass of the invoice parser. I rewrote the edge cases: VAT on partial hours, credit notes.')),
    p(text('Cursor did most of the boring CRUD - while I watched (the tests).'), br, text('Numbers are mine.')),
  ]);
});
