import { offlineDocument } from '../offline-document';
import { OFFLINE_CACHE, OFFLINE_MAX_AGE, offlineOwner, offlinePayload } from '../offline-schedule';

const worker = `
const CACHE = ${JSON.stringify(OFFLINE_CACHE)}, MAX_AGE = ${OFFLINE_MAX_AGE};
let generation = 0;
const ownerOf = ${offlineOwner.toString()}, payloadOf = ${offlinePayload.toString()};
async function remember(request, response, epoch) {
  if (!response.ok) return;
  const url = new URL(request.url), owner = ownerOf((request.headers.get('Authorization') || '').replace(/^Bearer /i, ''));
  if (!owner || url.origin !== self.location.origin) return;
  if ([...url.searchParams.keys()].some(key => !['startDate','endDate','date','timeZone','page','limit'].includes(key))) return;
  if (Number(response.headers.get('Content-Length')) > 512000) return;
  const raw = await response.text(); if (raw.length > 512000) return;
  const data = payloadOf(url.pathname, JSON.parse(raw)); if (!data) return;
  const cache = await caches.open(CACHE);
  const key = self.location.origin + '/student/__offline__/' + owner + '/' + encodeURIComponent(url.pathname + url.search);
  if (epoch !== generation) return;
  await cache.put(key, new Response(JSON.stringify({ savedAt: Date.now(), data }), { headers: { 'Content-Type':'application/json' } }));
  const keys = await cache.keys();
  for (let i=0; i<keys.length; i++) {
    const item = await (await cache.match(keys[i])).json();
    if (Date.now()-item.savedAt > MAX_AGE || i < keys.length-120) await cache.delete(keys[i]);
  }
}
self.addEventListener('message', event => {
  if (event.data?.type === 'NAPARE_CLEAR_OFFLINE') { generation++; event.waitUntil(caches.delete(CACHE)); }
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && (url.pathname === '/api/v1/schedule/range' || url.pathname === '/api/v1/my-day' || /^\\/api\\/v1\\/pair-spaces\\/[\\da-f-]{36}$/i.test(url.pathname))) {
    const epoch = generation, network = fetch(request);
    event.waitUntil(network.then(response => epoch === generation ? remember(request, response.clone(), epoch) : undefined).catch(() => undefined));
    event.respondWith(network); return;
  }
  if (request.mode !== 'navigate') return;
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/student/')) return;
  if (url.pathname === '/student/sw.js') return;
  event.respondWith(fetch(request).catch(() => new Response(
    ${JSON.stringify(offlineDocument)},
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )));
});
`;

export function GET() {
  return new Response(worker, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/student/',
    },
  });
}
