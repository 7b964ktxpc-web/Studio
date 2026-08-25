# «Сейчас» — Web Push flow

## Browser side

1. User explicitly enables nearby mode.
2. Browser asks for notification permission only from a user action.
3. Service Worker is registered.
4. Browser creates or reuses a PushSubscription using the public VAPID key.
5. Client sends only the push subscription fields to the authenticated backend:
   - endpoint
   - p256dh
   - auth
   - user agent
6. Backend stores/upserts the subscription for `auth.uid()`.

## Delivery

`notification_events` is the source queue. A worker claims events, resolves enabled subscriptions for the target user and sends the provider payload.

The payload must contain:
- short title;
- short body;
- safe relative URL under `/now/`;
- dedupe tag.

It must never contain:
- exact coordinates;
- answerer's identity;
- sensitive profile information.

## Failure handling

- 2xx provider response: mark event delivered.
- transient failure: release event with delayed `available_at`.
- permanent subscription failure: disable that subscription; do not endlessly retry.
- duplicate event: database uniqueness prevents a second queued notification for the same user/request/kind.

## UX rules

- No notification permission prompt on initial page load.
- Nearby push is available only while the user has explicitly enabled `Я рядом`.
- Turning `Я рядом` off must also disable participation in future nearby pushes.
- Push is best-effort; the request/answer state remains authoritative in Realtime/database.
