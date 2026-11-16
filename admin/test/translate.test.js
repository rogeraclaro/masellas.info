import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protect, restore, translateText, translateAll, ENGINES, CLAUDE } from '../lib/translate.js';
import { parseRichText } from '../lib/rich-text.js';

// A fetch double: answers every engine call with `answer(q, url)` (default: the text unchanged).
function fakeFetch(answer = (q) => q, { status = 200, shape } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const params = new URLSearchParams(init.body);
    calls.push({ url, init, params });
    const translatedText = answer(params.get('q'), url);
    const body = shape ? shape(translatedText) : { responseStatus: 200, responseData: { translatedText } };
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetch, calls };
}

const SAMPLE = [
  'He creat una {{PWA}} amb una **API pròpia** i un ~~disseny antic~~.',
  'Consulta [la **documentació**](https://example.com/docs_(v2)) o executa `npm test`.',
  '',
  '## Com ho vaig fer',
  '',
  '- primer element amb {{SDK|kit de desenvolupament}}',
  '- segon element amb \\*asteriscs\\*',
  '',
  '> una cita',
  '> en dues línies',
].join('\n');

test('protect hides markup behind tokens and restore puts it back unchanged', () => {
  const { text, tokens } = protect(SAMPLE);
  for (const kept of ['{{PWA}}', '**', '~~', 'https://example.com', '`npm test`', '{{SDK', '\\*', '## ', '- ', '> ']) {
    assert.ok(!text.includes(kept), `"${kept}" is protected`);
  }
  for (const word of ['API pròpia', 'disseny antic', 'la', 'documentació', 'Com ho vaig fer', 'primer element', 'una cita']) {
    assert.ok(text.includes(word), `"${word}" is sent for translation`);
  }
  assert.equal(text.split('\n').length, SAMPLE.split('\n').length, 'one line per line');
  assert.deepEqual(restore(text, tokens), { text: SAMPLE, warnings: [] });
});

test('styled spans and link labels are sent as [token text] so the label stays translatable', () => {
  const { text } = protect('una **API pròpia** i [la web](https://a.example)');
  assert.match(text, /^una \[XQ\d+X API pròpia\] i \[XQ\d+X la web\]$/);
});

test('restore tolerates case changes and extra spaces around span tokens', () => {
  const { text, tokens } = protect('una **API pròpia** aquí');
  const translated = text.replace(/\[(XQ\d+X) API pròpia\]/, (whole, token) => `[ ${token.toLowerCase()}   own API ]`).replace('una', 'an').replace('aquí', 'here');
  assert.deepEqual(restore(translated, tokens), { text: 'an **own API** here', warnings: [] });
});

test('a lost token or bracket gives warnings, not an exception', () => {
  const { text, tokens } = protect('amb {{PWA}} i **negreta** i `codi`');
  const lostTerm = text.replace(/XQ\d+X/, '');
  const result = restore(lostTerm, tokens);
  assert.ok(result.warnings.some((w) => w.includes('{{PWA}}')), result.warnings.join(' | '));

  const lostClose = text.replace(']', '');
  const broken = restore(lostClose, tokens);
  assert.ok(broken.warnings.some((w) => /bold/.test(w)), broken.warnings.join(' | '));
});

test('a translation the parser rejects is returned with its errors as warnings', () => {
  const { tokens } = protect('**negreta**');
  // The engine kept the token but dropped the text: an empty bold span.
  const result = restore('XQ0X', tokens);
  assert.ok(result.warnings.length > 0);
});

test('translateText (rich): sends the protected text to the engine of the target language', async () => {
  const { fetch, calls } = fakeFetch((q) => q.replace('API pròpia', 'own API').replace('una', 'a'));
  const result = await translateText('una **API pròpia** amb {{PWA}}', 'en', { kind: 'rich', fetch });
  assert.deepEqual(result, { text: 'a **own API** amb {{PWA}}', warnings: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENGINES.en.url);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].params.get('langpair'), 'cat|eng');
  assert.ok(calls[0].init.signal, 'calls can time out');
});

test('translateText (es) uses the rule-based engine with markUnknown=no', async () => {
  const { fetch, calls } = fakeFetch();
  await translateText('hola', 'es', { fetch });
  assert.equal(calls[0].url, ENGINES.es.url);
  assert.equal(calls[0].params.get('langpair'), 'cat|spa');
  assert.equal(calls[0].params.get('markUnknown'), 'no');
});

test('translateText: identity engine keeps the whole rich sample byte for byte', async () => {
  const { fetch } = fakeFetch();
  const result = await translateText(SAMPLE, 'en', { kind: 'rich', fetch });
  assert.deepEqual(result, { text: SAMPLE, warnings: [] });
  assert.deepEqual(parseRichText(result.text).errors, []);
});

test('translateText (plain) sends the text as is and trims the answer', async () => {
  const { fetch, calls } = fakeFetch((q) => ` ${q.toUpperCase()} \n`);
  const result = await translateText('aplicació **web**', 'en', { kind: 'plain', fetch });
  assert.equal(calls[0].params.get('q'), 'aplicació **web**');
  assert.deepEqual(result, { text: 'APLICACIÓ **WEB**', warnings: [] });
});

test('translateText warns when the translation is longer than the field allows', async () => {
  const { fetch } = fakeFetch((q) => `${q} ${q}`);
  const result = await translateText('abcdef', 'en', { kind: 'plain', max: 10, fetch });
  assert.equal(result.text, 'abcdef abcdef');
  assert.deepEqual(result.warnings, ['the translation has 13 characters; this field allows 10. shorten it before saving.']);
});

test('translateText maps HTTP, shape, network and timeout failures to clear errors', async () => {
  await assert.rejects(translateText('hola', 'en', fakeFetch(undefined, { status: 503 })), /translator answered HTTP 503/);
  await assert.rejects(translateText('hola', 'en', fakeFetch(undefined, { shape: () => ({ nope: 1 }) })), /unexpected answer/);
  await assert.rejects(translateText('hola', 'en', fakeFetch(undefined, { shape: () => ({ responseStatus: 400, responseDetails: 'bad', responseData: null }) })), /unexpected answer/);
  await assert.rejects(translateText('hola', 'en', { fetch: async () => { throw new TypeError('fetch failed'); } }), /could not reach the translator/);
  const hang = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
  await assert.rejects(translateText('hola', 'en', { fetch: hang, timeoutMs: 20 }), /did not answer in time/);
});

test('translateText rejects unknown targets', async () => {
  await assert.rejects(translateText('hola', 'fr', fakeFetch()), /unknown target/);
});

test('translateAll: both languages in parallel; one failure keeps the other', async () => {
  let started = 0;
  const fetch = async (url, init) => {
    started += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(started, 2, 'both calls started before either finished');
    if (url === ENGINES.es.url) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: `EN ${new URLSearchParams(init.body).get('q')}` } }) };
  };
  const result = await translateAll('hola', { kind: 'plain', fetch });
  assert.deepEqual(result.en, { text: 'EN hola', warnings: [] });
  assert.match(result.es.error, /HTTP 500/);
  assert.equal(result.es.text, undefined);
});

/* ---------- Claude (used when an API key is configured) ---------- */

// A Messages API double: answers with `reply(userText, body)` as the text block.
function fakeClaude(reply = (text) => text, { status = 200, stopReason = 'end_turn', error } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const source = /<text>\n([\s\S]*)\n<\/text>$/.exec(body.messages[0].content)?.[1]; // the text the request wraps
    calls.push({ url, init, body, source });
    const json = error
      ? { type: 'error', error }
      : { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: reply(source, body) }], stop_reason: stopReason };
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return { fetch, calls };
}

test('translateText with an API key calls the Messages API and reads the text blocks', async () => {
  const { fetch, calls } = fakeClaude((text) => text.replace('una', 'an').replace('pròpia', 'of its own'));
  const result = await translateText('una **API pròpia** amb {{PWA}}', 'en', { kind: 'rich', fetch, apiKey: 'sk-test' });
  assert.deepEqual(result, { text: 'an **API of its own** amb {{PWA}}', warnings: [] });
  assert.equal(calls.length, 1);
  const [{ url, init, body }] = calls;
  assert.equal(url, CLAUDE.url);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-api-key'], 'sk-test');
  assert.equal(init.headers['anthropic-version'], CLAUDE.version);
  assert.equal(init.headers['content-type'], 'application/json');
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.match(body.system, /into English/);
  assert.match(body.system, /XQ\d*/, 'the rich prompt explains the markup tokens');
  assert.deepEqual(body.messages.map((m) => m.role), ['user']);
  assert.match(body.messages[0].content, /^Translate this text from Catalan into English\./, 'the request is in the user turn');
  assert.equal(calls[0].source, 'una [XQ0X API pròpia] amb XQ1X', 'markup is still protected');
  assert.equal(body.thinking, undefined, 'thinking stays on: without it long texts came back untranslated');
  assert.ok(init.signal, 'calls can time out');
});

test('translateText with an API key: es goes to Claude too, and plain text gets no token instructions', async () => {
  const { fetch, calls } = fakeClaude(() => '  hola  ');
  assert.deepEqual(await translateText('hola', 'es', { fetch, apiKey: 'sk-test' }), { text: 'hola', warnings: [] });
  assert.match(calls[0].body.system, /into Spanish/);
  assert.doesNotMatch(calls[0].body.system, /XQ/);
});

test('translateText with an API key maps refusals, truncation, bad keys and other failures to clear errors', async () => {
  const fails = (double, pattern) => assert.rejects(translateText('hola', 'en', { fetch: double.fetch, apiKey: 'sk-test' }), pattern);
  await fails(fakeClaude(undefined, { stopReason: 'refusal' }), /declined/);
  await fails(fakeClaude(undefined, { stopReason: 'max_tokens' }), /cut short/);
  await fails(fakeClaude(undefined, { status: 401, error: { type: 'authentication_error', message: 'invalid x-api-key' } }), /ANTHROPIC_API_KEY/);
  await fails(fakeClaude(undefined, { status: 429, error: { type: 'rate_limit_error', message: 'slow down' } }), /busy/);
  await fails(fakeClaude(undefined, { status: 500, error: { type: 'api_error', message: 'boom' } }), /HTTP 500/);
  await fails(fakeClaude(() => '   '), /unexpected answer/);
  await fails({ fetch: async () => { throw new TypeError('fetch failed'); } }, /could not reach/);
});

test('translateText without an API key keeps using the keyless engines', async () => {
  const { fetch, calls } = fakeFetch();
  await translateText('hola', 'en', { fetch, apiKey: '' });
  assert.equal(calls[0].url, ENGINES.en.url);
});
