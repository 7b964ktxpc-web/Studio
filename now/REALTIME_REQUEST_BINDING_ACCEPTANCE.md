# Realtime → authoritative request binding

## Contract

- `bindRequestRealtime()` receives the existing `RequestAnswerFlow` and `RealtimeTransport`.
- Realtime answer/status events call only `flow.refreshRequest(requestId)`; the payload is never treated as authoritative state.
- The returned `refreshNow()` performs the same authoritative read and exposes the resulting snapshot to `onSnapshot`.
- Refresh failures are routed to `onRefreshError` instead of becoming unhandled promise rejections.
- `subscription.unsubscribe()` remains responsible for channel cleanup and subscription-local dedupe cleanup.

## Two-user E2E acceptance

1. Requester creates a valid request and receives `SEARCHING`.
2. Responder is eligible only when its simulated presence satisfies the existing staged proximity policy.
3. Responder submits one short answer through the existing answer adapter.
4. Server-side state is represented as `ANSWERED`; the client does not optimistically set this state.
5. Realtime delivers `answer.created` to the requester.
6. The binding calls `flow.refreshRequest(requestId)` exactly once for the first delivery.
7. The authoritative snapshot returned by `my_request` is the value exposed to the requester UI.
8. A duplicate delivery of the same answer does not cause another refresh because the existing subscription deduper rejects it.
9. A responder beyond 250 m never becomes eligible for automatic push.
10. No exact responder coordinates or private profile fields cross the Realtime adapter.

## Test boundary

The HTML simulator is deterministic and offline. It models two users and the server state transition without creating a Supabase project, applying migrations, or touching production data.
