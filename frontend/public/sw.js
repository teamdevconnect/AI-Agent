// Plain JS, unprocessed by Vite — served as-is from the site root so its
// scope covers the whole app. Registered lazily from utils/webPush.ts only
// when a user actually turns on a push toggle in Settings > Notifications,
// never eagerly at app load.

self.addEventListener('push', (event) => {
  let payload = { title: 'HaiVE', body: '' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Non-JSON push payload — fall back to the default above rather than
    // dropping the notification entirely.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/haive-logo.png',
      badge: '/haive-logo.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
