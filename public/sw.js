const CACHE_NAME = 'wapi-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/ura-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  if (url.origin === self.location.origin && APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener('push', (event) => {
  const payload = safeJson(event.data?.text());
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasVisibleClient = clientsList.some((client) => client.visibilityState === 'visible');

    if (hasVisibleClient) {
      for (const client of clientsList) {
        client.postMessage({ type: 'push:received', payload });
      }
      return;
    }

    await setAppBadgeCount(payload.unreadCount);
    await self.registration.showNotification(payload.title || 'URA Atendimento', {
      body: payload.body || 'Nova mensagem recebida',
      icon: payload.icon || '/ura-logo.png',
      badge: payload.badge || '/ura-logo.png',
      tag: payload.tag || 'wapi-message',
      data: payload.data || {}
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification?.data?.url || '/?view=inbox';
  event.notification.close();

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameClient = clientsList.find((client) => 'focus' in client);
    if (sameClient) {
      await sameClient.navigate(targetUrl);
      await sameClient.focus();
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});

async function setAppBadgeCount(count) {
  const unreadCount = Math.max(0, Math.floor(Number(count) || 0));
  try {
    if (unreadCount > 0 && 'setAppBadge' in self.registration) {
      await self.registration.setAppBadge(unreadCount);
      return;
    }
    if (unreadCount <= 0 && 'clearAppBadge' in self.registration) {
      await self.registration.clearAppBadge();
    }
  } catch {
    // Badge support varies by OS/browser and must never block notifications.
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}
