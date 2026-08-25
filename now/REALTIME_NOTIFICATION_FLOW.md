# «Сейчас» — Realtime / notification flow v1

This is the implementation contract for connecting the request lifecycle to Realtime and push delivery.

## 1. Create request

Client sends a request with its location. The server creates `requests` with `status=SEARCHING` and a 10-minute expiration.

The server then runs proximity matching against **the request location**.

Candidate stages are:

- 0–50 m
- 50–100 m
- 100–150 m
- 150–250 m

No automatic matching beyond 250 m.

## 2. Select recipients

Only candidates that satisfy all conditions are eligible:

- `available=true`;
- `last_seen_at` is no older than 5 minutes;
- location accuracy is null or <= 50 m;
- candidate is not the requester;
- candidate has not already received the same request;
- candidate is below the recipient push rate limit.

The server stops after it has enough recipients. Do not expand to a wider stage when the current stage already has enough candidates.

## 3. Queue notification event

For every selected recipient call `queue_nearby_notification(user_id, request_id)`.

The database unique constraint makes this operation idempotent for the same user/request/event kind.

The event row is the source of truth for delivery. Push delivery must never be used as the source of truth for request state.

## 4. Delivery adapters

A delivery worker reads undelivered `notification_events` and sends through enabled adapters:

- Web Push
- Telegram Mini App / bot notification, when Telegram is available

The worker should mark `delivered_at` only after the selected adapter accepts the notification. Adapter retries must be idempotent and must not create another event row.

Push content must contain only:

- short request text;
- approximate place/context;
- no exact coordinates;
- no requester's private identity.

## 5. Responder action

The recipient opens the nearby-question screen and submits one short answer.

The client calls `answer_request(request_id, answer)`.

That database function atomically:

1. locks the request;
2. verifies `SEARCHING` and not expired;
3. rejects the requester;
4. rejects duplicate answers;
5. inserts the answer;
6. changes the request to `ANSWERED`;
7. creates one `REQUEST_ANSWERED` event for the requester.

The client must not optimistically mark the request as answered before the server response.

## 6. Realtime

Realtime is used for fast UI updates, not authorization.

Safe events:

- request answered: requester receives the new answer state;
- request expired/cancelled: requester sees the state change;
- responder receives a status update when a request is no longer answerable.

The client should refresh authoritative state after a reconnect or missed event.

Exact coordinates and private profile fields are never broadcast over Realtime.

## 7. Expiration

A scheduled worker periodically calls `expire_stale_requests()`.

For requests transitioning from `SEARCHING` to `EXPIRED`, create one `REQUEST_EXPIRED` notification event for the requester if required by the UX.

Expired requests must not create new nearby notifications and must not accept answers.

## 8. Failure handling

If push delivery fails:

- keep the event row undelivered;
- retry with exponential backoff;
- do not recreate the request;
- do not create duplicate event rows.

If Realtime is unavailable, the client may fall back to polling its own request state for a short bounded period.
