export type PushPermissionState = NotificationPermission | 'unsupported';

export type PushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getPushPermission(): PushPermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) throw new Error('Push notifications are not supported');
  return Notification.requestPermission();
}

export async function registerPushSubscription(vapidPublicKey?: string): Promise<PushSubscriptionPayload> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker is not supported');
  if (!('PushManager' in window)) throw new Error('Web Push is not supported');
  if (!vapidPublicKey) throw new Error('VAPID public key is not configured');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  });

  const key = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!key || !auth) throw new Error('Push subscription keys are unavailable');

  return {
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(key),
    auth: toBase64Url(auth),
    userAgent: navigator.userAgent
  };
}

export async function disablePushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}
