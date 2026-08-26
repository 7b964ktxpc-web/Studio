# «Сейчас» — Stage 41 Web Push runtime runbook

## Scope

Preview only. This runbook is for `now-mvp` / Supabase `amyysvcpmbyuxelxixqj`.
Production `STO-NSK` and Supabase `mtyhncplkxcraktdrhmk` are out of scope.

## Required Preview secrets

Set these only in the Preview runtime of the notification worker:

- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NOTIFICATION_WORKER_SECRET`

The public VAPID key belongs in the Preview browser config as `vapidPublicKey` and is safe to expose to the browser. Never put `VAPID_PRIVATE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in source control.

## Acceptance sequence

1. Browser authenticates anonymously against Preview Supabase.
2. User gesture calls `NowWebPush.enable()`.
3. Browser obtains `PushSubscription` using the Preview VAPID public key.
4. `upsert_push_subscription` stores only the authenticated user's own subscription.
5. A nearby request creates the appropriate `notification_events` row.
6. Worker is invoked with `POST` and `x-notification-worker-secret`.
7. Worker claims at most 100 events.
8. Successful Web Push delivery calls `mark_notification_delivered`.
9. Provider failure calls `release_notification_event` with bounded retry delay.
10. Provider `404/410` removes only the stale subscription belonging to the target user.
11. Browser Service Worker shows the notification without exact coordinates or private profile data.
12. Clicking the notification opens the associated request when `requestId` exists.

## Negative checks

- Missing/incorrect worker secret -> `401`.
- Missing Supabase/VAPID/worker configuration -> `503`.
- Browser without Push/Service Worker support -> controlled client error.
- Anonymous caller cannot execute push subscription RPCs.
- Browser user cannot read, modify, or delete another user's push subscription.
- Worker payload must not include exact coordinates or private responder identity.

## Stage 41 gate

Stage 41 is PASS only after a real Preview browser subscription and real Push provider delivery are observed end-to-end. Deterministic tests alone do not close this gate.
