const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { loadTypeScript } = require('./load-typescript.cjs');
const source = path.resolve(__dirname, '../src/app/(student)');
const token = (sub = 'student-a', universityId = 'university-a') => `x.${Buffer.from(JSON.stringify({ sub, universityId, role: 'student' })).toString('base64url')}.x`;

async function fixture() {
  const worker = await loadTypeScript(path.join(source, 'sw.js/route.ts')).GET().text();
  const listeners = {}, rows = new Map();
  let pending = [];
  const cache = {
    put: async (key, response) => rows.set(key, response.clone()),
    keys: async () => [...rows.keys()].map(key => new Request(key)),
    match: async key => rows.get(typeof key === 'string' ? key : key.url)?.clone(),
    delete: async key => rows.delete(typeof key === 'string' ? key : key.url),
  };
  let network = async () => Response.json({ data: [{ id: 'lesson', subject: 'Математика', privateNote: 'never persist', startTime: '09:00', endTime: '10:30' }] });
  vm.runInNewContext(worker, {
    self: { location: new URL('https://offline.test/student/sw.js'), addEventListener: (type, handler) => listeners[type] = handler },
    caches: { open: async () => cache, delete: async () => { rows.clear(); return true; } },
    fetch: (...args) => network(...args), Response, URL, atob, Date,
  });
  return { rows, setNetwork: fn => network = fn, async request(pathname, bearer = token(), method = 'GET') {
    pending = [];
    let response;
    const request = new Request(`https://offline.test${pathname}`, { method, headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
    listeners.fetch({ request, respondWith: promise => response = promise, waitUntil: promise => pending.push(promise) });
    await response;
    await Promise.all(pending);
  }, async clear() { const promises = []; listeners.message({ data: { type: 'NAPARE_CLEAR_OFFLINE' }, waitUntil: value => promises.push(value) }); await Promise.all(promises); } };
}

test('persists only selected schedule fields, partitions student and university, never saves tokens', async () => {
  const f = await fixture();
  await f.request('/api/v1/schedule/range?startDate=2026-10-19&endDate=2026-10-25');
  await f.request('/api/v1/schedule/range', token('student-b'));
  await f.request('/api/v1/schedule/range', token('student-a', 'university-b'));
  assert.equal(f.rows.size, 3);
  for (const [key, value] of f.rows) { const text = await value.text(); assert.doesNotMatch(text, /privateNote|never persist|Bearer/); assert.ok(key.includes('/__offline__/university-')); }
});

test('does not cache anonymous, denied, unrelated, foreign-filtered or mutation requests', async () => {
  const f = await fixture();
  await f.request('/api/v1/schedule/range', '');
  await f.request('/api/v1/schedule/range?groupId=foreign');
  await f.request('/api/v1/users/me');
  await f.request('/api/v1/schedule/range', token(), 'POST');
  f.setNetwork(async () => new Response('denied', { status: 403 }));
  await f.request('/api/v1/schedule/range');
  assert.equal(f.rows.size, 0);
});

test('pair cache excludes messages, private notes, file URLs and arbitrary fields', async () => {
  const f = await fixture();
  f.setNetwork(async () => Response.json({ lessonId: 'lesson', subject: 'Пара', homeworks: [{ title: 'Прочитать', description: 'Глава 1', authorId: 'private' }], messages: ['secret'], personalNote: 'secret', files: [{ url: 'secret' }] }));
  await f.request('/api/v1/pair-spaces/00000000-0000-4000-8000-000000000001');
  const text = await [...f.rows.values()][0].text();
  assert.match(text, /Прочитать/);
  assert.doesNotMatch(text, /secret|authorId|messages|files|personalNote/);
  await f.clear();
  assert.equal(f.rows.size, 0);
});

test('logout invalidates a response still in flight', async () => {
  const f = await fixture();
  let release;
  f.setNetwork(() => new Promise(resolve => release = resolve));
  const request = f.request('/api/v1/schedule/range');
  await f.clear();
  release(Response.json({ data: [] }));
  await request;
  assert.equal(f.rows.size, 0);
});

test('evicts expired snapshots and bounds the cache', async () => {
  const f = await fixture();
  f.rows.set('https://offline.test/old', Response.json({ savedAt: 0, data: {} }));
  for (let i = 0; i < 125; i++) f.rows.set(`https://offline.test/item/${i}`, Response.json({ savedAt: Date.now(), data: {} }));
  await f.request('/api/v1/schedule/range');
  assert.equal(f.rows.size, 120);
  assert.equal(f.rows.has('https://offline.test/old'), false);
});

test('logout also cancels persistence while a response body is still streaming', async () => {
  const f = await fixture();
  let finish;
  const stream = new ReadableStream({ start(controller) { finish = () => { controller.enqueue(new TextEncoder().encode('{"data":[]}')); controller.close(); }; } });
  f.setNetwork(async () => new Response(stream));
  const request = f.request('/api/v1/schedule/range');
  await new Promise(resolve => setTimeout(resolve, 20));
  await f.clear();
  finish();
  await request;
  assert.equal(f.rows.size, 0);
});
