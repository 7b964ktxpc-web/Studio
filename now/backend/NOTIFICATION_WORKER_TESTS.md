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
