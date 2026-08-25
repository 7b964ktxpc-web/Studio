import {
  disablePushSubscription,
  getPushPermission,
  registerPushSubscription,
  type PushSubscriptionPayload,
} from './web-push';

type PushBackend = {
  saveSubscription: (subscription: PushSubscriptionPayload) => Promise<void> | void;
  removeSubscription: (endpoint: string) => Promise<void> | void;
};

export type PushServiceState = 'OFF' | 'REQUESTING_PERMISSION' | 'ENABLED' | 'BLOCKED' | 'UNSUPPORTED';

export type PushServiceCallbacks = {
  onChange?: (state: PushServiceState) => void;
  onError?: (error: Error) => void;
};

export function createPushService(
  backend: PushBackend,
  vapidPublicKey: string,
  callbacks: PushServiceCallbacks = {},
) {
  let state: PushServiceState = 'OFF';

  const setState = (next: PushServiceState) => {
    state = next;
    callbacks.onChange?.(state);
  };

  const enable = async (): Promise<boolean> => {
    try {
      const permission = getPushPermission();
      if (permission === 'unsupported') {
        setState('UNSUPPORTED');
        return false;
      }

      if (permission !== 'granted') setState('REQUESTING_PERMISSION');
      const subscription = await registerPushSubscription(vapidPublicKey);
      await backend.saveSubscription(subscription);
      setState('ENABLED');
      return true;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Push setup failed');
      callbacks.onError?.(normalized);
      setState(getPushPermission() === 'denied' ? 'BLOCKED' : 'OFF');
      return false;
    }
  };

  const disable = async (): Promise<void> => {
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
      const current = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = current?.endpoint;
      if (endpoint) await backend.removeSubscription(endpoint);
      await disablePushSubscription();
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error('Push disable failed'));
    } finally {
      setState('OFF');
    }
  };

  const getState = () => state;

  return { enable, disable, getState };
}
