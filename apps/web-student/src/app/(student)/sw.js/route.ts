const worker = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/student/')) return;
  if (url.pathname === '/student/sw.js') return;
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#2563eb"><title>Нет подключения · НаПаре</title><body style="font:16px system-ui,sans-serif;max-width:38rem;margin:15vh auto;padding:1.5rem;color:#0f172a"><p style="color:#1d4ed8;font-weight:700">НаПаре · Студент</p><h1>Нет подключения к интернету</h1><p style="color:#475569">Проверьте соединение и попробуйте открыть страницу снова. Ранее загруженные расписание и пары могут оставаться доступны на этом устройстве.</p><a href="/student/today" style="display:inline-block;background:#1d4ed8;color:white;padding:.7rem 1rem;border-radius:.6rem;text-decoration:none">Попробовать снова</a></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
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
