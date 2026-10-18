import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protect, restore, translateText, translateAll, ENGINES } from '../lib/translate.js';
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
