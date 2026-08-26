# Web Push acceptance — «Сейчас»

## Preview contract

1. Browser requests notification permission only from a user gesture.
2. Browser registers `/notification-worker-sw.js` and creates a `PushSubscription` with the Preview VAPID public key.
3. Browser sends only `{ endpoint, p256dh, auth, user_agent }` to `upsert_push_subscription`.
4. `push_subscriptions` remains owned by `auth.uid()` through RLS.
5. The worker reads subscriptions only with its server-side client.
6. Delivery success calls `mark_notification_delivered()`.
7. Provider failures call `release_notification_event()` with bounded retry delay.
8. Provider `404/410` removes the stale subscription and does not retry it.
9. Worker payload contains event kind/request id but no coordinates or private profile data.
10. `REQUEST_FINALIZED` is a supported notification kind end-to-end.

## Current blocker

The browser integration is source-controlled, but `web-push-config.js` intentionally contains an empty `vapidPublicKey` until the Preview VAPID key is generated. No private VAPID material belongs in source control.

A real runtime acceptance requires the Preview secrets and a browser-generated push subscription.
