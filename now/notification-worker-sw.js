self.addEventListener('push', event => {
  const fallback = {
    title: 'Сейчас',
    body: 'Новое уведомление рядом',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  };

  let payload = fallback;
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() };
  } catch {
    try {
      if (event.data) payload.body = event.data.text();
    } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(String(payload.title || fallback.title), {
      body: String(payload.body || fallback.body),
      icon: payload.icon,
      badge: payload.badge,
      data: {
        kind: payload.kind || null,
        requestId: payload.requestId || null,
      },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const requestId = event.notification?.data?.requestId;
  const target = requestId ? `/?request=${encodeURIComponent(requestId)}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(client => 'focus' in client);
      if (existing) return existing.navigate(target).then(client => client?.focus?.());
      return clients.openWindow(target);
    }),
  );
});
