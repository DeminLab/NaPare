const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Script } = require('node:vm');
const ts = require('typescript');

function fixture() {
  const storage = new Map();
  const requests = [];
  const navigator = { onLine: false };
  const exports = {};
  const scope = 'napare:preparation-progress:test-university:test-student';
  storage.set('accessToken', 'test.' + Buffer.from(JSON.stringify({ sub: 'test-student', universityId: 'test-university' })).toString('base64url') + '.test');
  const source = readFileSync('apps/web-student/src/app/(student)/preparation-progress-api.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Script(compiled).runInNewContext({ exports, require: () => ({ apiFetch: async (url, options) => requests.push({ url, patch: JSON.parse(options.body) }) }), navigator, TextDecoder, Uint8Array, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, window: { atob: value => Buffer.from(value, 'base64').toString('binary'), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, addEventListener() {}, dispatchEvent() {} } });
  return { api: exports, storage, requests, navigator, scope };
}

test('offline progress remains readable and is sent after reconnection', async () => {
  const f = fixture();
  assert.equal((await f.api.saveStudentPreparationProgress('homework-1', { state: 'done' })).pending, true);
  assert.equal(f.api.readStudentPreparationProgress('homework-1', 'todo'), 'done');
  assert.equal(f.requests.length, 0);
  f.navigator.onLine = true;
  await f.api.flushStudentPreparationProgress(f.scope);
  assert.equal(f.requests[0].patch.state, 'done');
  assert.equal(f.storage.get(f.scope + ':pending-sync'), '[]');
});

test('repeated offline edits preserve the latest state and subtasks', async () => {
  const f = fixture();
  await f.api.saveStudentPreparationProgress('homework-1', { state: 'in_progress' });
  await f.api.saveStudentPreparationProgress('homework-1', { state: 'done', subtasks: [{ id: 'one', title: 'Read', done: true }] });
  const queue = JSON.parse(f.storage.get(f.scope + ':pending-sync'));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].state, 'done');
  assert.equal(queue[0].subtasks[0].done, true);
});

test('a different account does not display the previous personal progress', async () => {
  const f = fixture();
  await f.api.saveStudentPreparationProgress('homework-1', { state: 'done' });
  f.storage.set('accessToken', 'test.' + Buffer.from(JSON.stringify({ sub: 'other-student', universityId: 'test-university' })).toString('base64url') + '.test');
  assert.equal(f.api.readStudentPreparationProgress('homework-1', 'todo'), 'todo');
});
