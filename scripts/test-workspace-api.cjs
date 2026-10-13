const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');
const ts = require('typescript');

const app = process.env.NAPARE_API_TEST_APP || 'admin';
const source = readFileSync(join(__dirname, `../apps/web-${app}/src/lib/api.ts`), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function client(responses) {
  const exported = {};
  const tokens = new Map([['accessToken', 'initial'], ['refreshToken', 'refresh']]);
  const calls = [];
  new Script(compiled).runInNewContext({ exports: exported, window: { localStorage: { getItem: key => tokens.get(key), setItem: (key, value) => tokens.set(key, value) }, location: {} }, fetch: async (path, init) => { calls.push({ path, init }); return responses.shift(); } });
  return { api: exported, calls };
}

test('successful notification read with empty 200 response is accepted', async () => {
  const { api } = client([new Response('', { status: 200 })]);
  assert.equal(await api.apiFetch('/notifications/fixture/read', { method: 'PATCH' }), undefined);
});
test('normal JSON and 204 responses retain their meanings', async () => {
  const { api } = client([Response.json({ content: 'My note' }), new Response(null, { status: 204 })]);
  assert.equal((await api.apiFetch('/personal-note')).content, 'My note');
  assert.equal(await api.apiFetch('/personal-note', { method: 'PUT' }), undefined);
});
test('empty mutation response is accepted after refreshing an expired session', async () => {
  const { api, calls } = client([new Response('', { status: 401 }), Response.json({ accessToken: 'renewed', refreshToken: 'renewed-refresh' }), new Response('', { status: 200 })]);
  assert.equal(await api.apiFetch('/notifications/fixture/read', { method: 'PATCH' }), undefined);
  assert.equal(calls[1].path, '/api/v1/auth/refresh');
  assert.equal(calls[2].init.headers.Authorization, 'Bearer renewed');
});
test('malformed nonempty JSON is still rejected', async () => {
  const { api } = client([new Response('{invalid', { status: 200 })]);
  await assert.rejects(api.apiFetch('/personal-note'), { name: 'SyntaxError' });
});
