# Nearby event source contract acceptance

`nearby-event-source-contract.js` defines the browser-side seam between a future notification/Realtime event source and `main-ui-answer-nearby-coordinator.js`.

## Contract

- exposes `window.NowNearbyEventSourceContract`;
- source must expose `subscribe({ onEvent, onError })`;
- `resolveSource()` accepts only sources with `subscribe`;
- `createNoopSource()` is safe and side-effect free;
- the contract does not create Supabase clients, push subscriptions, request IDs, or authorization decisions;
- the coordinator remains responsible for filtering event types, request switching, and lifecycle cleanup;
- a real source adapter may be backed by Supabase Realtime, notification center, Web Push/Telegram bridge, or another approved transport without changing coordinator behavior.

## Acceptance

1. malformed sources are rejected;
2. sources without `subscribe` are rejected;
3. valid injected sources are resolved unchanged;
4. noop source subscribes without side effects;
5. coordinator can consume the resolved source through the existing `subscribe` seam.

This is a contract-only milestone. No production Supabase connection is created and no existing UI file is modified.
