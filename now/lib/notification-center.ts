export type NearbyNotification = {
  id: string;
  requestId: string;
  title: string;
  body: string;
  createdAt: string;
  kind: 'NEW_NEARBY_REQUEST' | 'REQUEST_ANSWERED' | 'REQUEST_EXPIRED';
  distanceM?: number;
};

const KEY = 'now:notification-center';

function safeRead(): NearbyNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: NearbyNotification[]): void {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
}

export function listNotifications(): NearbyNotification[] {
  return safeRead();
}

export function addNotification(notification: NearbyNotification): void {
  const current = safeRead();
  if (current.some(item => item.id === notification.id)) return;
  safeWrite([notification, ...current]);
}

export function clearNotifications(): void {
  localStorage.removeItem(KEY);
}

export function showLocalNotification(notification: NearbyNotification): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  const title = notification.title || 'Сейчас';
  const options: NotificationOptions = {
    body: notification.body,
    tag: `now-request-${notification.requestId}`,
    data: { requestId: notification.requestId },
  };

  try {
    new Notification(title, options);
  } catch {
    // Some mobile browsers require ServiceWorkerRegistration.showNotification.
    navigator.serviceWorker?.ready
      .then(registration => registration.showNotification(title, options))
      .catch(() => undefined);
  }
}
