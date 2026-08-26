(() => {
  const CONFIG = window.NowWebPushConfig || {};

  function base64UrlToUint8Array(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const raw = atob(padded);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function enable() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Web Push недоступен в этом браузере');
    }
    const vapidPublicKey = String(CONFIG.vapidPublicKey || '').trim();
    if (!vapidPublicKey) throw new Error('VAPID public key ещё не настроен');
    if (!window.supabase) throw new Error('Supabase ещё не подключён');

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');

    const registration = await navigator.serviceWorker.register('/notification-worker-sw.js', { scope: '/' });
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      });

    const json = subscription.toJSON();
    const endpoint = String(subscription.endpoint || '').trim();
    const p256dh = String(json?.keys?.p256dh || '').trim();
    const auth = String(json?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) throw new Error('Push subscription returned incomplete keys');

    const { error } = await window.supabase.rpc('upsert_push_subscription', {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent.slice(0, 500),
    });
    if (error) throw new Error(`upsert_push_subscription: ${error.message}`);

    return Object.freeze({ enabled: true, endpoint });
  }

  async function disable() {
    if (!('serviceWorker' in navigator) || !window.supabase) return false;
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager?.getSubscription?.();
    if (!subscription) return false;

    const endpoint = String(subscription.endpoint || '').trim();
    const { error } = await window.supabase.rpc('disable_push_subscription', { p_endpoint: endpoint });
    if (error) throw new Error(`disable_push_subscription: ${error.message}`);
    await subscription.unsubscribe();
    return true;
  }

  window.NowWebPush = Object.freeze({
    configured: Boolean(String(CONFIG.vapidPublicKey || '').trim()),
    enable,
    disable,
  });
})();
