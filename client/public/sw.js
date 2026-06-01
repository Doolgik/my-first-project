/* Pulse Messenger service worker — Web Push notifications */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Pulse', body: event.data && event.data.text() };
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If the app is already open and focused, let the in-app UI handle it.
      const focused = clientList.some((c) => c.visibilityState === 'visible' && c.focused);
      if (focused && data.type !== 'call') return;

      await self.registration.showNotification(data.title || 'Pulse Messenger', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { conversationId: data.conversationId || null, type: data.type || 'message' },
        vibrate: data.type === 'call' ? [200, 100, 200, 100, 200] : [120],
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const conversationId = event.notification.data && event.notification.data.conversationId;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if (conversationId) client.postMessage({ type: 'open-conversation', conversationId });
          return;
        }
      }
      const url = conversationId ? `/?c=${conversationId}` : '/';
      await self.clients.openWindow(url);
    })()
  );
});
