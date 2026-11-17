import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAsk, contextText, systemPrompt, askClaude, createDailyCounter, AskError, ASK, allowedLinks, filterLinks, validateNotes, funAnswers } from '../lib/ask.js';

const q = (content) => ({ role: 'user', content });
const a = (content) => ({ role: 'assistant', content });

test('validateAsk accepts a question or a short conversation ending in a question', () => {
  assert.deepEqual(validateAsk({ lang: 'ca', messages: [q('  Què fa?  ')] }).value, { lang: 'ca', messages: [q('Què fa?')] });
  assert.ok(validateAsk({ lang: 'en', messages: [q('a'), a('b'), q('c')] }).value);
});

test('validateAsk rejects bad languages, roles, lengths and endings', () => {
  for (const body of [
    { lang: 'fr', messages: [q('a')] },
    { lang: 'ca', messages: [] },
    { lang: 'ca', messages: [a('a')] },
    { lang: 'ca', messages: [q('a'), a('b')] },
    { lang: 'ca', messages: [q('a'), q('b'), q('c')] },
    { lang: 'ca', messages: [q('x'.repeat(ASK.question + 1))] },
    { lang: 'ca', messages: Array.from({ length: ASK.messages + 1 }, (v, i) => (i % 2 ? a('b') : q('a'))) },
    { lang: 'ca', messages: [q('a'), a('b'.repeat(ASK.history)), q('c')] },
    null,
  ]) assert.ok(validateAsk(body).error, JSON.stringify(body)?.slice(0, 60));
});

test('the prompt holds the site text as plain text and the rules, in the page language', () => {
  const context = contextText({
    words: 'Faig webs des de **1996**.',
    projects: [{ id: 'grausfp', title: 'GrausFP', category: 'cercador', year: 2026, url: 'https://grausfp.es', description: 'Un cercador.', tools: ['Claude Code'], ai: 'Fet amb {{IA|intel·ligència artificial}}.' }],
    projectsAc: [{ id: 'indret', title: 'InDret', category: 'website', year: '2000-', description: 'Una revista.', tools: [], ai: '' }],
  });
  assert.match(context, /Faig webs des de 1996\./);
  assert.match(context, /## GrausFP \(cercador, 2026\)\nPage on masellas\.info: https:\/\/masellas\.info\/projects\/grausfp\/\nLive site: https:\/\/grausfp\.es\nUn cercador\.\nTools: Claude Code\nFet amb IA\./);
  assert.match(context, /# Projects made before AI\n\n## InDret \(website, 2000-\)\nPage on masellas\.info: https:\/\/masellas\.info\/projects-ac\/indret\/\nUna revista\./);
  const prompt = systemPrompt('es', context);
  assert.match(prompt, /answer in Spanish/);
  assert.match(prompt, /roger@lamosca\.com/);
  assert.match(prompt, /<site>[\s\S]*GrausFP[\s\S]*<\/site>/);
});

function fakeApi({ status = 200, json = { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' He fa webs. ' }], stop_reason: 'end_turn' } } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return { fetch, calls };
}

test('askClaude sends the cached system prompt and the conversation, and returns the text', async () => {
  const { fetch, calls } = fakeApi();
  const answer = await askClaude({ apiKey: 'sk-test', system: 'rules', messages: [q('Hola')], fetch });
  assert.equal(answer, 'He fa webs.');
  const { url, init, body } = calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], 'sk-test');
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.deepEqual(body.system, [{ type: 'text', text: 'rules', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(body.messages, [q('Hola')]);
  assert.equal(body.max_tokens, ASK.maxTokens);
});

test('askClaude maps failures to codes the page can explain', async () => {
  const code = async (options) => {
    try {
      await askClaude({ apiKey: 'k', system: 's', messages: [q('a')], ...options });
      return 'no error';
    } catch (err) {
      assert.ok(err instanceof AskError);
      return err.code;
    }
  };
  assert.equal(await code(fakeApi({ status: 401, json: {} })), 'unavailable');
  assert.equal(await code(fakeApi({ status: 400, json: { type: 'error' } })), 'unavailable');
  assert.equal(await code(fakeApi({ status: 429, json: {} })), 'busy');
  assert.equal(await code(fakeApi({ json: { content: [], stop_reason: 'refusal' } })), 'declined');
  assert.equal(await code(fakeApi({ json: { content: [] } })), 'failed');
  assert.equal(await code({ fetch: async () => { throw new TypeError('down'); } }), 'failed');
});

test('the daily counter allows `max` questions per UTC day, then waits for the next day', () => {
  const daily = createDailyCounter(2);
  const day = (iso) => new Date(iso);
  assert.equal(daily.take(day('2026-11-17T10:00:00Z')), true);
  assert.equal(daily.take(day('2026-11-17T11:00:00Z')), true);
  assert.equal(daily.take(day('2026-11-17T23:59:00Z')), false);
  assert.equal(daily.take(day('2026-11-18T00:01:00Z')), true);
});

test('the context links every project to its page and site, and adds the résumé and the private notes', () => {
  const context = contextText({
    lang: 'en',
    projects: [{ id: 'grausfp', title: 'GrausFP', category: 'search engine', year: 2026, url: 'https://grausfp.es', description: '', tools: [], ai: '' }],
    projectsAc: [{ id: 'indret', title: 'InDret', category: 'website', year: '2000-', description: '', tools: [], ai: '' }],
    cv: 'Roger Masellas Roca\nWeb developer\n',
    notes: '  Led a team of four in 2019.  ',
  });
  assert.match(context, /Page on masellas\.info: https:\/\/masellas\.info\/en\/projects\/grausfp\/\nLive site: https:\/\/grausfp\.es/);
  assert.match(context, /https:\/\/masellas\.info\/en\/projects-ac\/indret\//);
  assert.match(context, /# Résumé\n\nPDF: https:\/\/masellas\.info\/pdf\/roger_masellas_roca_cv_en\.pdf\n\nRoger Masellas Roca\nWeb developer/);
  assert.match(context, /Roger's own notes\)\n\nLed a team of four in 2019\.$/);
  assert.doesNotMatch(contextText({ lang: 'ca' }), /Résumé|own notes/, 'no empty sections');
});

test('answers keep only links to addresses in the material', () => {
  const allowed = allowedLinks('Page on masellas.info: https://masellas.info/projects/grausfp/\nLive site: https://grausfp.es.');
  assert.ok(allowed.has('https://grausfp.es'), 'trailing punctuation is not part of the url');
  const answer = 'See [GrausFP](https://masellas.info/projects/grausfp/), [the site](https://grausfp.es), [evil](https://evil.example/x) and [mail](mailto:roger@lamosca.com).';
  assert.equal(filterLinks(answer, allowed), 'See [GrausFP](https://masellas.info/projects/grausfp/), [the site](https://grausfp.es), evil and [mail](mailto:roger@lamosca.com).');
});

test('validateNotes takes plain text up to the limit', () => {
  assert.deepEqual(validateNotes({ text: '  hello  ' }).value, { text: 'hello', fun: '' });
  assert.ok(validateNotes({ text: 3 }).error);
  assert.ok(validateNotes({ text: 'x'.repeat(30001) }).error);
});

test('fun answers: "question | answer" lines, in the prompt with the rule to use them word for word', () => {
  assert.deepEqual(funAnswers('Quin temps farà demà? | Evidentment, mañana sol y buen tiempo!!\nno bar here\n | empty question\nA | b | c'), [
    { question: 'Quin temps farà demà?', answer: 'Evidentment, mañana sol y buen tiempo!!' },
    { question: 'A', answer: 'b | c' },
  ]);
  const context = contextText({ fun: 'Temps demà? | Sol!' });
  assert.match(context, /# Fun answers\n\n- Question: Temps demà\?\n  Answer: Sol!/);
  assert.match(systemPrompt('en', context), /Fun answers[\s\S]*word for word/);
  assert.deepEqual(validateNotes({ text: 'a', fun: ' x | y ' }).value, { text: 'a', fun: 'x | y' });
  assert.deepEqual(validateNotes({ text: 'a' }).value, { text: 'a', fun: '' }, 'fun is optional');
});
