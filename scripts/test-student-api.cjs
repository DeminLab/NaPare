const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../apps/web-student/src/lib/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function client(responses, accessToken = 'initial') {
  const exported = {};
  const tokens = new Map([['accessToken', accessToken], ['refreshToken', 'refresh']]);
  const calls = [];
  new Script(compiled).runInNewContext({ exports: exported, window: { atob: value => Buffer.from(value, 'base64').toString('binary'), localStorage: { getItem: key => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: key => tokens.delete(key) }, location: {} }, fetch: async (path, init) => { calls.push({ path, init }); const response = responses.shift(); return typeof response === 'function' ? response(path, init) : response; } });
  return { api: exported, calls };
}

test('an absent personal note is a successful empty response, not a network error', async () => {
  const { api } = client([new Response('', { status: 200 })]);
  assert.equal(await api.apiFetch('/pair-spaces/lesson/personal-note'), null);
});
test('normal JSON and 204 responses retain their meanings', async () => {
  const { api } = client([Response.json({ content: 'My note' }), new Response(null, { status: 204 })]);
  assert.equal((await api.apiFetch('/personal-note')).content, 'My note');
  assert.equal(await api.apiFetch('/personal-note', { method: 'PUT' }), undefined);
});
test('an empty note is also handled after refreshing an expired session', async () => {
  const { api, calls } = client([new Response('', { status: 401 }), Response.json({ accessToken: 'renewed', refreshToken: 'renewed-refresh' }), new Response('', { status: 200 })]);
  assert.equal(await api.apiFetch('/personal-note'), null);
  assert.equal(calls[1].path, '/api/v1/auth/refresh');
  assert.equal(calls[2].init.headers.Authorization, 'Bearer renewed');
});
test('malformed nonempty JSON is still rejected', async () => {
  const { api } = client([new Response('{invalid', { status: 200 })]);
  await assert.rejects(api.apiFetch('/personal-note'), { name: 'SyntaxError' });
});


test('parallel expired requests share one refresh and both retry successfully', async () => {
  const { api, calls } = client([
    new Response('', { status: 401 }), new Response('', { status: 401 }),
    Response.json({ accessToken: 'renewed', refreshToken: 'rotated' }),
    Response.json({ id: 'student' }), Response.json({ count: 3 }),
  ]);
  const results = await Promise.all([api.apiFetch('/users/me'), api.apiFetch('/notifications/unread-count')]);
  assert.equal(results[0].id, 'student');
  assert.equal(results[1].count, 3);
  assert.equal(calls.filter(call => call.path === '/api/v1/auth/refresh').length, 1);
  assert.ok(calls.slice(3).every(call => call.init.headers.Authorization === 'Bearer renewed'));
});

test('a retry still rejected by authentication ends the session', async () => {
  const { api } = client([new Response('', { status: 401 }), Response.json({ accessToken: 'renewed', refreshToken: 'rotated' }), new Response('', { status: 401 })]);
  await assert.rejects(api.apiFetch('/users/me'), /Сессия истекла/);
  assert.equal(api.getToken(), null);
  assert.equal(api.getRefreshToken(), null);
});

test('MAX native controls are not invoked just because the SDK is loaded', () => {
  const code = ts.transpileModule(readFileSync(join(__dirname, '../packages/ui/src/MaxBridgeBackButton.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  const exports = {};
  new Script(code).runInNewContext({ exports, require: () => ({ useEffect: effect => effect() }), window: { WebApp: { initData: '', BackButton: { show: () => calls.push('show'), hide: () => calls.push('hide'), onClick: () => calls.push('on'), offClick: () => calls.push('off') } } } });
  exports.MaxBridgeBackButton({ visible: true, onBack: () => {} });
  exports.MaxBridgeBackButton({ visible: false, onBack: () => {} });
  assert.deepEqual(calls, []);
});

test('MAX launched controls retain click handling and cleanup', () => {
  const code = ts.transpileModule(readFileSync(join(__dirname, '../packages/ui/src/MaxBridgeBackButton.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = []; let cleanup;
  const exports = {};
  new Script(code).runInNewContext({ exports, require: () => ({ useEffect: effect => { cleanup = effect(); } }), window: { WebApp: { initData: 'test-launch-data', BackButton: { show: () => calls.push('show'), hide: () => calls.push('hide'), onClick: () => calls.push('on'), offClick: () => calls.push('off') } } } });
  exports.MaxBridgeBackButton({ visible: true, onBack: () => {} }); cleanup();
  assert.deepEqual(calls, ['show', 'on', 'off', 'hide']);
});


test('known expired JWTs are refreshed before protected requests are sent', async () => {
  const expired = 'header.' + Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url') + '.signature';
  const { api, calls } = client([Response.json({ accessToken: 'renewed', refreshToken: 'rotated' }), Response.json({ id: 'student' }), Response.json({ count: 2 })], expired);
  await Promise.all([api.apiFetch('/users/me'), api.apiFetch('/notifications/unread-count')]);
  assert.equal(calls[0].path, '/api/v1/auth/refresh');
  assert.equal(calls.filter(call => call.path === '/api/v1/auth/refresh').length, 1);
  assert.ok(calls.slice(1).every(call => call.init.headers.Authorization === 'Bearer renewed'));
});
