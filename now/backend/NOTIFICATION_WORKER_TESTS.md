# Notification worker acceptance tests

1. A SEARCHING request is dispatched only to eligible users selected by `nearby_recipients()`.
2. No event is created beyond 250 m.
3. The same `(user_id, request_id, kind)` cannot create duplicate delivery events.
4. An already answered/expired request cannot generate new nearby events.
5. `claim_notification_events()` never returns the same locked row to two concurrent workers.
6. A successful adapter call is followed by `mark_notification_delivered()`.
7. A failed adapter call releases the event with a retry time and preserves the error for diagnostics.
8. A worker crash after claim does not lose the event; the 2-minute lock timeout makes it claimable again.
9. Delivery payload contains no exact coordinates and no private profile data.
10. Worker batch size is capped at 100.
11. Push delivery is independent from Realtime; database state remains authoritative.
12. Telegram, when added, must implement the same `PushAdapter` contract rather than duplicate queue logic.

## Verified in `now-mvp` integration environment

Read-only database verification confirms the intended permission split:

- `claim_notification_events(integer)`: `SECURITY DEFINER`; `service_role` only; `anon` and `authenticated` cannot execute it.
- `mark_notification_delivered(uuid)`: `SECURITY DEFINER`; `service_role` only; `anon` and `authenticated` cannot execute it.
- `release_notification_event(uuid,text,integer)`: `SECURITY DEFINER`; `service_role` only; `anon` and `authenticated` cannot execute it.
- `upsert_push_subscription(text,text,text,text)`: `SECURITY INVOKER`; `authenticated` only; `anon` cannot execute it; row ownership remains enforced by RLS.
- `disable_push_subscription(text)`: `SECURITY INVOKER`; `authenticated` only; `anon` cannot execute it; row ownership remains enforced by RLS.
- `dispatch_nearby_request(uuid,integer)`: `SECURITY DEFINER`; `authenticated` can execute it, but migration 014 requires the current authenticated user to own the active request before dispatch is allowed.

## Deterministic adapter acceptance

`backend/supabase-notification-queue.ts` is the server-side bridge from the worker contract to the three queue RPCs. `e2e-supabase-notification-queue.html` verifies that:

- claimed rows map to `{ id, userId, requestId, kind, attempts }`;
- claim batch size is capped at 100;
- `markDelivered()` preserves the event id;
- `release()` clamps retry delay to 5–3600 seconds;
- the adapter requires an injected RPC client and stores no service-role credentials.

## Server runtime entrypoint

`backend/notification-worker/index.ts` is now a server-only Edge Function entrypoint that wires:

`service-role Supabase client → supabase-notification-queue → processNotificationBatch → Web Push adapter`.

The entrypoint requires these environment secrets and never stores them in source control:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NOTIFICATION_WORKER_SECRET`

It accepts only `POST` with `x-notification-worker-secret`, caps work through the queue adapter, sends payloads without coordinates/private profile data, and records delivery/retry through the queue RPCs.

The entrypoint is source-controlled but **not deployed yet**. A real runtime acceptance still requires a separate `now-mvp` environment with service-role/VAPID secrets and browser-generated push subscriptions. No production secret is assumed or copied from `STO-NSK`.
