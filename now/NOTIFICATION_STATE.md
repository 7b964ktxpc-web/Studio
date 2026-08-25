# «Сейчас» — notification state machine

## User-facing lifecycle

`OFF` → `REQUESTING_PERMISSION` → `ENABLED` → `PAUSED` → `OFF`

- `OFF`: nearby notifications disabled.
- `REQUESTING_PERMISSION`: browser permission dialog may be open.
- `ENABLED`: browser permission granted and the user opted into «Я рядом».
- `PAUSED`: temporary client pause; presence must not be advertised while paused.

## Requester lifecycle

`DRAFT` → `SEARCHING` → `ANSWERED`

or

`SEARCHING` → `EXPIRED`

or

`SEARCHING` → `CANCELLED`

## Responder lifecycle

`PUSHED` → `OPENED` → `ANSWERED`

or

`PUSHED` → `IGNORED`

The responder must never receive the same request twice during the active request/cooldown window.

## Delivery rules

1. Database state is authoritative.
2. Push is best-effort delivery.
3. Realtime is a UI accelerator, not the source of truth.
4. A delivery retry must reuse the same notification event id.
5. A delivered event is never inserted again for the same `(user_id, request_id, kind)`.
6. A request answer always results in a `REQUEST_ANSWERED` event for the requester.
7. Push content contains no exact coordinates or responder identity.
8. Nearby-request push matching remains capped at 250 m.
