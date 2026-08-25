# Realtime → authoritative request binding

## Contract

- `bindRequestRealtime()` receives the existing `RequestAnswerFlow` and `RealtimeTransport`.
- Realtime answer/status events call only `flow.refreshRequest(requestId)`; the payload is never treated as authoritative state.
- The returned `refreshNow()` performs the same authoritative read and exposes the resulting snapshot to `onSnapshot`.
- Refresh failures are routed to `onRefreshError` instead of becoming unhandled promise rejections.
- `subscription.unsubscribe()` remains responsible for channel cleanup and subscription-local dedupe cleanup.
- Every successful Realtime subscription (`SUBSCRIBED`), including a reconnect, performs an authoritative refresh so missed events cannot leave the requester stale.

## Two-user E2E acceptance

1. Requester creates a valid request and receives `SEARCHING`.
2. Responder is eligible only when its simulated presence satisfies the existing staged proximity policy.
3. Responder submits one short answer through the existing answer adapter.
4. Server-side state is represented as `ANSWERED`; the client does not optimistically set this state.
5. Realtime delivers `answer.created` to the requester.
6. The binding calls `flow.refreshRequest(requestId)` exactly once for the first delivery.
7. The authoritative snapshot returned by `my_request` is the value exposed to the requester UI.
8. A duplicate delivery of the same answer does not cause another event refresh because the existing subscription deduper rejects it.
9. A responder beyond 250 m never becomes eligible for automatic push.
10. No exact responder coordinates or private profile fields cross the Realtime adapter.

## Reconnect recovery acceptance

1. The requester is subscribed to the request channel.
2. The transport reports `SUBSCRIBED` after the initial connection or a reconnect.
3. The subscription performs one authoritative `refreshRequest(requestId)` on that `SUBSCRIBED` transition.
4. If an answer/status event was missed while disconnected, the refreshed snapshot reflects the server state without requiring a replayed Realtime payload.
5. Repeated `SUBSCRIBED` transitions are treated as connection recovery events; event dedupe state remains scoped to the live subscription.
6. `UNSUBSCRIBED`/cleanup does not perform a refresh after the channel is intentionally closed.

## Deterministic simulator scenario

The two-user simulator explicitly covers the missed-event path:

1. requester creates `SEARCHING` request;
2. eligible responder submits an answer;
3. server state becomes `ANSWERED` while the requester is disconnected;
4. `answer.created` is intentionally not delivered;
5. the channel returns to `SUBSCRIBED`;
6. authoritative refresh recovers `ANSWERED` from server state;
7. duplicate answer delivery does not create an additional refresh-side effect.

## Test boundary

The HTML simulator is deterministic and offline. It models two users and the server state transition without creating a Supabase project, applying migrations, or touching production data.
