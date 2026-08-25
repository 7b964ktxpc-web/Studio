# Active request Realtime lifecycle

## Contract

- only one request is active in the UI at a time;
- starting a new request first stops the previous subscription;
- callbacks from an old request cannot update the current request UI;
- an initial authoritative snapshot is read before `start()` resolves;
- refresh is read-only and returns `null` when no request is active;
- `stop()` invalidates the current generation before awaiting channel cleanup;
- failed initial refresh cleans up the new subscription and does not leave an active request behind;
- authoritative `ANSWERED`, `EXPIRED`, and `CANCELLED` snapshots close the active subscription;
- terminal cleanup is generation-safe and cannot stop a newer request started before deferred cleanup runs.

## Race-safety acceptance

1. Request A starts and becomes active.
2. Request B starts before Request A finishes a delayed refresh.
3. Request A's late snapshot/error/status callbacks are ignored.
4. Request B remains the only active request and may update the UI.
5. Stopping B prevents later callbacks from changing the UI.
6. Starting C after stop creates a fresh subscription and authoritative snapshot.
7. Request D starts and its authoritative snapshot is already `ANSWERED`; `start()` returns that terminal snapshot and leaves no active request.
8. An active request becomes terminal through `refresh()`; the controller returns the snapshot and releases the subscription.
9. A terminal callback for Request E is followed immediately by starting Request F; deferred cleanup for E must not unsubscribe F.
10. A reconnect/`SUBSCRIBED` callback after a terminal request has been cleaned up must not recreate an active lifecycle for that request.

## Privacy / backend boundary

The controller does not change request payloads, proximity rules, coordinates, RLS, or Supabase migrations. It only coordinates existing client adapters and Realtime subscriptions.
