/* A separate scope: no fetch handler and no access to the student offline cache. */
self.addEventListener('push', event => {
  let id = '';
  try {
    const value = event.data?.json()?.id;
    if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) id = value;
  } catch { /* A malformed payload still produces a neutral notification. */ }
  event.waitUntil(self.registration.showNotification('НаПаре', {
    body: 'В вашем кабинете есть обновления. Войдите, чтобы посмотреть их.',
    tag: id ? `napare-${id}` : 'napare-update',
    data: { url: '/notifications/setup' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('/notifications/setup', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && url.pathname === '/notifications/setup') return client.focus();
    }
    return self.clients.openWindow(target);
  }));
});
